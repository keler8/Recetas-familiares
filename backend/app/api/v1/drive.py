import os
import json
import uuid
import base64
import secrets
import logging
from typing import Dict, Any, List, Optional
from urllib.parse import quote
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request, BackgroundTasks
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.config import settings
from app.api.deps import get_current_user
from app.models.auth import User
from app.models.import_job import ImportBatch, RecipeDraft
from app.models.recipe import Recipe, RecipeVariant, RecipeIngredient, RecipeStep
from app.schemas.import_job import ImportBatchResponse
from app.services.drive_service import drive_service
from app.services.storage_guard import storage_guard
from app.services.ocr_service import ocr_service
from app.services.gemini_service import gemini_service
from app.api.v1.imports import _format_batch_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/drive", tags=["Integración Google Drive"])


class DriveImportRequest(BaseModel):
    file_id: str
    file_name: str
    mime_type: Optional[str] = None
    web_view_link: Optional[str] = None


class DriveFolderImportRequest(BaseModel):
    folder_id: str
    folder_name: str
    drive_id: Optional[str] = None
    auto_approve: bool = False



@router.get("/status")
def get_drive_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = drive_service.load_from_db(db)
    return service.get_status(db)


@router.get("/auth-url")
def get_drive_auth_url(
    origin: Optional[str] = None,
    return_to: Optional[str] = "/imports",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = drive_service.load_from_db(db)
    if not service.is_configured:
        return {
            "configured": False,
            "message": "Falta configurar Client ID y Client Secret de Google Drive en Administración."
        }
    state_data = {
        "nonce": secrets.token_hex(16),
        "user_id": current_user.id,
        "origin": origin or "https://recetas.danesti.es",
        "return_to": return_to or "/imports"
    }
    state_str = base64.urlsafe_b64encode(json.dumps(state_data).encode()).decode()
    url = service.get_auth_url(state=state_str)
    return {"configured": True, "auth_url": url}


@router.get("/login")
def drive_login(
    request: Request,
    origin: Optional[str] = None,
    return_to: Optional[str] = "/imports",
    db: Session = Depends(get_db)
):
    service = drive_service.load_from_db(db)
    if not service.is_configured:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Falta configurar Client ID y Client Secret de Google Drive en Administración."
        )

    client_origin = origin or request.headers.get("referer") or str(request.base_url).rstrip("/")
    if client_origin.endswith("/login") or client_origin.endswith("/imports"):
        client_origin = client_origin.split("/login")[0].split("/imports")[0]
    if not client_origin:
        client_origin = "https://recetas.danesti.es"

    state_data = {
        "nonce": secrets.token_hex(16),
        "origin": client_origin,
        "return_to": return_to or "/imports"
    }
    state_str = base64.urlsafe_b64encode(json.dumps(state_data).encode()).decode()
    auth_url = service.get_auth_url(state=state_str)
    if not auth_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo generar la URL de autorización de Google Drive"
        )
    return RedirectResponse(url=auth_url)


@router.get("/callback")
def drive_oauth_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: Session = Depends(get_db)
):
    service = drive_service.load_from_db(db)

    target_origin = "https://recetas.danesti.es"
    return_path = "/imports"
    if state:
        try:
            state_data = json.loads(base64.urlsafe_b64decode(state.encode()).decode())
            if state_data.get("origin"):
                target_origin = state_data["origin"].rstrip("/")
            if state_data.get("return_to"):
                return_path = state_data["return_to"]
        except Exception:
            pass

    if error:
        return RedirectResponse(url=f"{target_origin}{return_path}?drive_error={quote(f'Google Drive: {error}')}")

    if not code:
        return RedirectResponse(url=f"{target_origin}{return_path}?drive_error={quote('No se recibió código de autorización de Google')}")

    try:
        token_data = service.exchange_code(code)
        service.save_tokens(db, token_data)
        email = quote(token_data.get("account_email") or "")
        return RedirectResponse(url=f"{target_origin}{return_path}?drive_connected=1&email={email}")
    except Exception as e:
        logger.error(f"Error exchanging Drive OAuth code: {e}")
        return RedirectResponse(url=f"{target_origin}{return_path}?drive_error={quote(str(e))}")


@router.post("/disconnect")
def drive_disconnect(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = drive_service.load_from_db(db)
    service.disconnect(db)
    return {"message": "Google Drive desconectado con éxito"}


@router.get("/shared-drives")
def get_shared_drives(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = drive_service.load_from_db(db)
    if not service.is_authorized:
        return []
    return service.list_shared_drives(db)


@router.get("/files")
def list_drive_files(
    folder_id: Optional[str] = None,
    query: Optional[str] = None,
    section: str = Query("my_drive"),
    drive_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = drive_service.load_from_db(db)
    if not service.is_authorized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google Drive no está vinculado con una cuenta autorizada"
        )
    files = service.list_files(
        db,
        folder_id=folder_id,
        query=query,
        section=section,
        drive_id=drive_id
    )
    return files


def _publish_recipe_from_draft_data(
    db: Session,
    data: Dict[str, Any],
    user_id: int,
    image_url: Optional[str],
    source_type: str,
    source_name: str,
    source_url: Optional[str] = None
) -> Recipe:
    """Helper to persist a published Recipe with its default variant, ingredients and steps."""
    cal = data.get("nutrition_calories")
    prot = data.get("nutrition_protein")
    carbs = data.get("nutrition_carbs")
    fat = data.get("nutrition_fat")
    if cal is None or float(cal or 0) <= 0:
        est = gemini_service.estimate_recipe_nutrition(
            title=data.get("title", "Receta sin título"),
            ingredients=data.get("ingredients", []),
            base_servings=data.get("base_servings", 4),
            dish_type=data.get("dish_type", "Plato principal")
        )
        cal = est.get("calories")
        prot = est.get("protein")
        carbs = est.get("carbs")
        fat = est.get("fat")

    new_recipe = Recipe(
        title=data.get("title", "Receta sin título"),
        description=data.get("description"),
        summary=data.get("description", "")[:150] if data.get("description") else None,
        main_image_url=image_url,
        categories=json.dumps(data.get("categories", ["Comidas"]), ensure_ascii=False),
        tags=json.dumps(data.get("tags", []), ensure_ascii=False),
        dish_type=data.get("dish_type", "Plato principal"),
        cuisine=data.get("cuisine", "Mediterránea"),
        prep_time_min=data.get("prep_time_min", 15),
        cook_time_min=data.get("cook_time_min", 20),
        total_time_min=data.get("total_time_min", 35),
        difficulty=data.get("difficulty", "media"),
        base_servings=data.get("base_servings", 4),
        nutrition_calories=cal,
        nutrition_protein=prot,
        nutrition_carbs=carbs,
        nutrition_fat=fat,
        allergens=json.dumps(data.get("allergens", []), ensure_ascii=False),
        source_type=source_type,
        source_url=source_url or source_name,
        review_status="approved",
        created_by_id=user_id
    )
    db.add(new_recipe)
    db.flush()

    variant = RecipeVariant(
        recipe_id=new_recipe.id,
        variant_type="traditional",
        title="Preparación tradicional",
        is_default=True
    )
    db.add(variant)
    db.flush()

    for idx, ing in enumerate(data.get("ingredients", [])):
        db.add(RecipeIngredient(
            variant_id=variant.id,
            name=ing.get("name", "Ingrediente"),
            amount=ing.get("amount"),
            unit=ing.get("unit"),
            notes=ing.get("notes"),
            order_index=idx
        ))

    for step in data.get("steps", []):
        db.add(RecipeStep(
            variant_id=variant.id,
            step_number=step.get("step_number", 1),
            instruction=step.get("instruction", ""),
            timer_seconds=step.get("timer_seconds"),
            tip=step.get("tip")
        ))

    return new_recipe


def _process_single_file_content(
    db: Session,
    batch: ImportBatch,
    file_bytes: bytes,
    file_name: str,
    mime_type: Optional[str],
    user_id: int,
    auto_approve: bool = False,
    source_url: Optional[str] = None
):
    orig_ext = os.path.splitext(file_name)[1].lower()
    temp_filename = f"drive_{uuid.uuid4().hex[:10]}_{file_name}"
    temp_file_path = os.path.join(settings.TEMP_PATH, temp_filename)

    with open(temp_file_path, "wb") as f:
        f.write(file_bytes)

    source_image_url = None
    is_image = bool(mime_type and "image" in mime_type.lower()) or orig_ext in [".jpg", ".jpeg", ".png", ".webp"]
    if is_image:
        img_name = f"drive_img_{uuid.uuid4().hex[:12]}{orig_ext or '.jpg'}"
        storage_dest = os.path.join(settings.STORAGE_PATH, "recipes", img_name)
        os.makedirs(os.path.join(settings.STORAGE_PATH, "recipes"), exist_ok=True)
        with open(storage_dest, "wb") as f_img:
            f_img.write(file_bytes)
        source_image_url = f"/api/media/recipes/{img_name}"

    try:
        extracted_text = ocr_service.process_document(temp_file_path)
        extracted_recipes = gemini_service.extract_recipes_from_text(extracted_text, source_hint=file_name)

        for r_data in extracted_recipes:
            title = r_data.get("title", "Receta sin título").strip()
            dup = None
            if source_url:
                dup = db.query(Recipe).filter(Recipe.source_url == source_url).first()
            if not dup:
                dup = db.query(Recipe).filter(Recipe.title.ilike(title)).first()
            dup_id = dup.id if dup else None

            # Determine best appetizing recipe image
            img_url = source_image_url or gemini_service.generate_or_find_recipe_image(
                title=title,
                dish_type=r_data.get("dish_type"),
                cuisine=r_data.get("cuisine")
            )

            batch.total_detected += 1

            if dup:
                batch.duplicate_count += 1
                draft_status = "duplicate"
            elif auto_approve:
                draft_status = "approved"
                batch.approved_count += 1
            else:
                draft_status = "pending_review"
                batch.pending_count += 1

            approved_rec_id = None
            if auto_approve and not dup:
                published_rec = _publish_recipe_from_draft_data(
                    db=db,
                    data=r_data,
                    user_id=user_id,
                    image_url=img_url,
                    source_type=batch.source_type,
                    source_name=batch.source_name,
                    source_url=source_url
                )
                approved_rec_id = published_rec.id

            draft = RecipeDraft(
                batch_id=batch.id,
                title=title,
                raw_text=extracted_text[:2000] if extracted_text else None,
                extracted_json=json.dumps(r_data, ensure_ascii=False),
                source_image_url=source_image_url,
                proposed_image_url=img_url,
                source_url=source_url,
                status=draft_status,
                duplicate_recipe_id=dup_id,
                approved_recipe_id=approved_rec_id,
                ai_confidence=0.95 if gemini_service.is_configured() else 0.75,
                uncertainty_notes=json.dumps(r_data.get("uncertainty_notes", []), ensure_ascii=False) if r_data.get("uncertainty_notes") else None
            )
            db.add(draft)

    finally:
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception:
                pass


@router.post("/import-file", response_model=ImportBatchResponse)
def import_drive_file(
    req: DriveImportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = drive_service.load_from_db(db)
    if not service.is_authorized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google Drive no está vinculado con una cuenta autorizada"
        )

    if not storage_guard.can_start_heavy_task():
        raise HTTPException(
            status_code=status.HTTP_507_INSUFFICIENT_STORAGE,
            detail="Espacio libre en disco crítico en el servidor. Importaciones temporalmente pausadas."
        )

    try:
        content, forced_ext = service.download_file(db, req.file_id, mime_type=req.mime_type)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error al descargar el archivo desde Google Drive: {e}"
        )

    clean_filename = req.file_name
    if forced_ext and not clean_filename.lower().endswith(forced_ext):
        clean_filename = f"{clean_filename}{forced_ext}"

    file_doc_url = service.get_file_web_view_link(
        req.file_id,
        mime_type=req.mime_type,
        web_view_link=req.web_view_link
    )

    batch = ImportBatch(
        user_id=current_user.id,
        source_type="google_drive",
        source_name=clean_filename,
        source_url=file_doc_url,
        status="processing"
    )
    db.add(batch)
    db.flush()

    try:
        _process_single_file_content(
            db=db,
            batch=batch,
            file_bytes=content,
            file_name=clean_filename,
            mime_type=req.mime_type,
            user_id=current_user.id,
            auto_approve=False,
            source_url=file_doc_url
        )

        batch.status = "completed" if batch.pending_count == 0 else "pending_review"
        db.commit()
        db.refresh(batch)
        return _format_batch_response(batch, db)
    except Exception as e:
        db.rollback()
        logger.error(f"Error processing Drive file import: {e}")
        batch.status = "error"
        batch.error_message = str(e)
        db.commit()
        db.refresh(batch)
        return _format_batch_response(batch, db)


def _process_drive_folder_background(
    batch_id: int,
    user_id: int,
    auto_approve: bool,
    files_to_process: list
):
    from app.database import SessionLocal
    bg_db = SessionLocal()
    try:
        service = drive_service.load_from_db(bg_db)
        batch = bg_db.query(ImportBatch).filter(ImportBatch.id == batch_id).first()
        if not batch:
            return

        for file_item in files_to_process:
            try:
                content, forced_ext = service.download_file(bg_db, file_item["id"], mime_type=file_item.get("mimeType"))
                orig_name = file_item.get("name") or "archivo"
                if forced_ext and not orig_name.lower().endswith(forced_ext):
                    orig_name = f"{orig_name}{forced_ext}"

                file_doc_url = service.get_file_web_view_link(
                    file_item["id"],
                    mime_type=file_item.get("mimeType"),
                    web_view_link=file_item.get("webViewLink")
                )

                _process_single_file_content(
                    db=bg_db,
                    batch=batch,
                    file_bytes=content,
                    file_name=orig_name,
                    mime_type=file_item.get("mimeType"),
                    user_id=user_id,
                    auto_approve=auto_approve,
                    source_url=file_doc_url
                )
                bg_db.commit()
            except Exception as file_err:
                bg_db.rollback()
                logger.warning(f"Skipping error in file {file_item.get('name')}: {file_err}")

        # Update final batch status
        batch = bg_db.query(ImportBatch).filter(ImportBatch.id == batch_id).first()
        if batch:
            batch.status = "completed" if batch.pending_count == 0 else "pending_review"
            bg_db.commit()
    except Exception as e:
        logger.error(f"Error processing Drive folder in background: {e}")
        bg_db.rollback()
        batch = bg_db.query(ImportBatch).filter(ImportBatch.id == batch_id).first()
        if batch:
            batch.status = "error"
            batch.error_message = str(e)
            bg_db.commit()
    finally:
        bg_db.close()


@router.post("/import-folder", response_model=ImportBatchResponse)
def import_drive_folder(
    req: DriveFolderImportRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = drive_service.load_from_db(db)
    if not service.is_authorized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google Drive no está vinculado con una cuenta autorizada"
        )

    if not storage_guard.can_start_heavy_task():
        raise HTTPException(
            status_code=status.HTTP_507_INSUFFICIENT_STORAGE,
            detail="Espacio libre en disco crítico en el servidor. Importaciones temporalmente pausadas."
        )

    files = service.list_folder_all_files(db, req.folder_id, drive_id=req.drive_id)
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se encontraron recetas ni documentos compatibles en la carpeta '{req.folder_name}'."
        )

    folder_url = f"https://drive.google.com/drive/folders/{req.folder_id}"

    batch = ImportBatch(
        user_id=current_user.id,
        source_type="google_drive_folder",
        source_name=req.folder_name,
        source_url=folder_url,
        status="processing",
        total_detected=0,
        pending_count=0,
        duplicate_count=0
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)

    background_tasks.add_task(
        _process_drive_folder_background,
        batch_id=batch.id,
        user_id=current_user.id,
        auto_approve=req.auto_approve,
        files_to_process=files[:50]
    )

    return _format_batch_response(batch, db)

