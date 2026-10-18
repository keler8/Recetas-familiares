import os
import json
import logging
import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.database import get_db
from app.config import settings
from app.models.auth import User
from app.models.import_job import ImportBatch, RecipeDraft
from app.models.recipe import Recipe, RecipeVariant, RecipeIngredient, RecipeStep
from app.schemas.import_job import (
    ImportBatchResponse, RecipeDraftResponse, DraftReviewAction,
    DraftUpdateRequest, InstagramImportRequest, UrlImportRequest
)
from app.api.deps import get_current_user
from app.services.storage_guard import storage_guard
from app.services.ocr_service import ocr_service
from app.services.gemini_service import gemini_service
from app.services.instagram_service import instagram_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/imports", tags=["Importador Inteligente"])


def _format_draft_response(d: RecipeDraft, db: Optional[Session] = None) -> RecipeDraftResponse:
    close_db = False
    if db is None:
        try:
            from app.database import SessionLocal
            db_conn = SessionLocal()
            close_db = True
        except Exception:
            db_conn = None
            close_db = False
    else:
        db_conn = db

    try:
        extracted = json.loads(d.extracted_json) if isinstance(d.extracted_json, str) else d.extracted_json
    except Exception:
        extracted = {}

    u_notes = d.uncertainty_notes
    if u_notes and isinstance(u_notes, str) and u_notes.startswith("["):
        try:
            parsed = json.loads(u_notes)
            if isinstance(parsed, list):
                u_notes = ", ".join(parsed) if parsed else None
        except Exception:
            pass

    existing_rec = None
    existing_id = None
    existing_title = None
    has_changes = None
    dup_reason = None

    if db_conn is not None:
        try:
            if d.approved_recipe_id:
                existing_rec = db_conn.query(Recipe).filter(Recipe.id == d.approved_recipe_id).first()
            if not existing_rec and d.duplicate_recipe_id:
                existing_rec = db_conn.query(Recipe).filter(Recipe.id == d.duplicate_recipe_id).first()
            if not existing_rec and getattr(d, "source_url", None):
                existing_rec = db_conn.query(Recipe).filter(Recipe.source_url == d.source_url).first()
            if not existing_rec and d.title:
                existing_rec = db_conn.query(Recipe).filter(Recipe.title.ilike(d.title.strip())).first()

            if existing_rec:
                existing_id = existing_rec.id
                existing_title = existing_rec.title
                if d.source_url and existing_rec.source_url == d.source_url:
                    dup_reason = "Mismo documento de Google Drive"
                else:
                    dup_reason = f"Mismo título en recetario ('{existing_rec.title}')"

                # Check if there are differences in title, ingredients, or steps
                def_var = next((v for v in existing_rec.variants if v.is_default), existing_rec.variants[0] if existing_rec.variants else None)
                if def_var:
                    ex_ings = [i.name.strip().lower() for i in def_var.ingredients]
                    dr_ings = [i.get("name", "").strip().lower() for i in extracted.get("ingredients", []) if i.get("name")]
                    ex_steps = [s.instruction.strip().lower() for s in def_var.steps]
                    dr_steps = [s.get("instruction", "").strip().lower() for s in extracted.get("steps", []) if s.get("instruction")]
                    title_diff = d.title.strip().lower() != existing_rec.title.strip().lower()
                    if ex_ings != dr_ings or ex_steps != dr_steps or title_diff:
                        has_changes = True
                    else:
                        has_changes = False
                else:
                    has_changes = True
        finally:
            if close_db and db_conn:
                db_conn.close()

    return RecipeDraftResponse(
        id=d.id,
        batch_id=d.batch_id,
        title=d.title,
        extracted_json=extracted or {},
        source_image_url=d.source_image_url,
        proposed_image_url=d.proposed_image_url,
        source_url=getattr(d, "source_url", None),
        status=d.status,
        duplicate_recipe_id=d.duplicate_recipe_id,
        existing_recipe_id=existing_id,
        existing_recipe_title=existing_title,
        has_changes=has_changes,
        duplicate_reason=dup_reason,
        ai_confidence=d.ai_confidence,
        uncertainty_notes=u_notes,
        created_at=d.created_at
    )


def _format_batch_response(batch: ImportBatch, db: Optional[Session] = None) -> ImportBatchResponse:
    drafts_resp = [_format_draft_response(d, db) for d in batch.drafts]
    return ImportBatchResponse(
        id=batch.id,
        source_type=batch.source_type,
        source_name=batch.source_name,
        source_url=getattr(batch, "source_url", None),
        status=batch.status,
        total_detected=batch.total_detected,
        approved_count=batch.approved_count,
        pending_count=batch.pending_count,
        duplicate_count=batch.duplicate_count,
        discarded_count=batch.discarded_count,
        error_message=batch.error_message,
        created_at=batch.created_at,
        drafts=drafts_resp
    )


@router.get("/batches", response_model=List[ImportBatchResponse])
def list_import_batches(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    batches = db.query(ImportBatch).order_by(ImportBatch.created_at.desc()).limit(20).all()
    return [_format_batch_response(b) for b in batches]


@router.get("/batches/{batch_id}", response_model=ImportBatchResponse)
def get_import_batch(
    batch_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    batch = db.query(ImportBatch).filter(ImportBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lote de importación no encontrado")
    return _format_batch_response(batch)


@router.post("/upload", response_model=ImportBatchResponse)
async def upload_document_for_import(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not storage_guard.can_start_heavy_task():
        raise HTTPException(
            status_code=status.HTTP_507_INSUFFICIENT_STORAGE,
            detail="Espacio libre en disco crítico en el servidor. Importaciones temporalmente pausadas."
        )

    # Save uploaded file temporarily
    file_ext = os.path.splitext(file.filename)[1].lower()
    temp_filename = f"upload_{uuid.uuid4().hex[:10]}{file_ext}"
    temp_file_path = os.path.join(settings.TEMP_PATH, temp_filename)

    batch = ImportBatch(
        user_id=current_user.id,
        source_type="file",
        source_name=file.filename,
        status="processing"
    )
    db.add(batch)
    db.flush()

    try:
        content = await file.read()
        with open(temp_file_path, "wb") as f:
            f.write(content)

        # 1. OCR / text extraction
        extracted_text = ocr_service.process_document(temp_file_path)

        # 2. Extract multiple recipes with Gemini or local heuristic
        extracted_recipes = gemini_service.extract_recipes_from_text(extracted_text, source_hint=file.filename)

        total = len(extracted_recipes)
        batch.total_detected = total
        batch.pending_count = total

        for r_data in extracted_recipes:
            title = r_data.get("title", "Receta sin título")

            # Check duplicate by title
            dup = db.query(Recipe).filter(Recipe.title.ilike(title.strip())).first()
            dup_id = dup.id if dup else None
            draft_status = "duplicate" if dup else "pending_review"

            if dup:
                batch.duplicate_count += 1
                batch.pending_count -= 1

            img_url = gemini_service.generate_or_find_recipe_image(
                title=title,
                dish_type=r_data.get("dish_type"),
                cuisine=r_data.get("cuisine")
            )

            draft = RecipeDraft(
                batch_id=batch.id,
                title=title,
                raw_text=extracted_text[:2000],
                extracted_json=json.dumps(r_data, ensure_ascii=False),
                proposed_image_url=img_url,
                status=draft_status,
                duplicate_recipe_id=dup_id,
                ai_confidence=0.95 if gemini_service.is_configured() else 0.70,
                uncertainty_notes=json.dumps(r_data.get("uncertainty_notes", []), ensure_ascii=False)
            )
            db.add(draft)

        batch.status = "pending_review"
        db.commit()
        db.refresh(batch)

    except Exception as e:
        logger.error(f"Error processing upload {file.filename}: {e}")
        batch.status = "error"
        batch.error_message = str(e)
        db.commit()
    finally:
        # Strictly delete temporary uploaded file
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
                logger.info(f"STORAGE GUARD: Deleted uploaded temp file {temp_file_path}")
            except Exception:
                pass

    return _format_batch_response(batch)


@router.post("/instagram", response_model=ImportBatchResponse)
def import_instagram_reel(
    req: InstagramImportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not storage_guard.can_start_heavy_task():
        raise HTTPException(
            status_code=status.HTTP_507_INSUFFICIENT_STORAGE,
            detail="Espacio libre insuficiente para procesar vídeo de Instagram"
        )

    batch = ImportBatch(
        user_id=current_user.id,
        source_type="instagram",
        source_name=req.url,
        status="processing"
    )
    db.add(batch)
    db.flush()

    try:
        result = instagram_service.process_instagram_url(req.url)
        recipe_data = result.get("recipe_data", {})
        title = recipe_data.get("title", "Receta de Instagram")

        dup = db.query(Recipe).filter(Recipe.title.ilike(title.strip())).first()

        batch.source_name = f"Instagram: {result.get('creator') or title}"
        batch.source_url = req.url
        batch.total_detected = 1
        batch.pending_count = 1 if not dup else 0
        batch.duplicate_count = 1 if dup else 0
        batch.status = "pending_review"

        img_url = result.get("thumbnail_url")
        if not img_url:
            img_url = gemini_service.generate_or_find_recipe_image(
                title=title,
                dish_type=recipe_data.get("dish_type"),
                cuisine=recipe_data.get("cuisine")
            )

        draft = RecipeDraft(
            batch_id=batch.id,
            title=title,
            raw_text=result.get("description", ""),
            extracted_json=json.dumps(recipe_data, ensure_ascii=False),
            source_image_url=result.get("thumbnail_url"),
            proposed_image_url=img_url,
            source_url=req.url,
            status="duplicate" if dup else "pending_review",
            duplicate_recipe_id=dup.id if dup else None,
            ai_confidence=0.9 if result.get("transcription") else 0.75,
            uncertainty_notes=json.dumps(["Audio transcrito localmente" if result.get("transcription") else "Solo texto de descripción disponible"], ensure_ascii=False)
        )
        db.add(draft)
        db.commit()
        db.refresh(batch)

    except Exception as e:
        logger.error(f"Error importing Instagram {req.url}: {e}")
        db.rollback()
        try:
            batch.status = "error"
            batch.error_message = str(e)
            db.commit()
        except Exception:
            db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error al procesar el Reel de Instagram: {str(e)}"
        )

    return _format_batch_response(batch, db)


@router.post("/drafts/{draft_id}/review")
def review_recipe_draft(
    draft_id: int,
    action_in: DraftReviewAction,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    draft = db.query(RecipeDraft).filter(RecipeDraft.id == draft_id).first()
    if not draft:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Borrador no encontrado")

    batch = draft.batch

    if action_in.action == "discard":
        draft.status = "discarded"
        draft.reviewed_by_id = current_user.id
        draft.reviewed_at = datetime.utcnow()
        batch.pending_count = max(0, batch.pending_count - 1)
        batch.discarded_count += 1
        db.commit()
        return {"message": "Borrador descartado"}

    elif action_in.action in ["approve", "modify_and_approve"]:
        data = action_in.modified_data or json.loads(draft.extracted_json)

        cal = data.get("nutrition_calories")
        prot = data.get("nutrition_protein")
        carbs = data.get("nutrition_carbs")
        fat = data.get("nutrition_fat")
        if cal is None or float(cal or 0) <= 0:
            est = gemini_service.estimate_recipe_nutrition(
                title=data.get("title", draft.title),
                ingredients=data.get("ingredients", []),
                base_servings=data.get("base_servings", 4),
                dish_type=data.get("dish_type", "Plato principal")
            )
            cal = est.get("calories")
            prot = est.get("protein")
            carbs = est.get("carbs")
            fat = est.get("fat")

        # Create published Recipe
        new_recipe = Recipe(
            title=data.get("title", draft.title),
            description=data.get("description"),
            summary=data.get("description", "")[:150] if data.get("description") else None,
            main_image_url=draft.proposed_image_url or draft.source_image_url,
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
            source_type=batch.source_type,
            source_url=draft.source_url or getattr(batch, "source_url", None) or batch.source_name,
            review_status="approved",
            created_by_id=current_user.id
        )
        db.add(new_recipe)
        db.flush()

        # Variant & ingredients & steps
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

        draft.status = "approved"
        draft.approved_recipe_id = new_recipe.id
        draft.reviewed_by_id = current_user.id
        draft.reviewed_at = datetime.utcnow()

        batch.pending_count = max(0, batch.pending_count - 1)
        batch.approved_count += 1
        db.commit()

        return {"message": "Receta aprobada y publicada en la biblioteca", "recipe_id": new_recipe.id}

    elif action_in.action in ["update_existing", "modify_and_update"]:
        data = action_in.modified_data or json.loads(draft.extracted_json)
        target_id = action_in.target_recipe_id or draft.duplicate_recipe_id or draft.approved_recipe_id
        target_recipe = None
        if target_id:
            target_recipe = db.query(Recipe).filter(Recipe.id == target_id).first()
        if not target_recipe and getattr(draft, "source_url", None):
            target_recipe = db.query(Recipe).filter(Recipe.source_url == draft.source_url).first()
        if not target_recipe and draft.title:
            target_recipe = db.query(Recipe).filter(Recipe.title.ilike(draft.title.strip())).first()

        if not target_recipe:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No se encontró la receta existente para actualizar")

        # Update target recipe
        target_recipe.title = data.get("title", draft.title)
        if data.get("description"):
            target_recipe.description = data.get("description")
            target_recipe.summary = data.get("description", "")[:150]
        if draft.proposed_image_url:
            target_recipe.main_image_url = draft.proposed_image_url
        if getattr(draft, "source_url", None):
            target_recipe.source_url = draft.source_url
        target_recipe.dish_type = data.get("dish_type", target_recipe.dish_type)
        target_recipe.cuisine = data.get("cuisine", target_recipe.cuisine)
        target_recipe.prep_time_min = data.get("prep_time_min", target_recipe.prep_time_min)
        target_recipe.cook_time_min = data.get("cook_time_min", target_recipe.cook_time_min)
        target_recipe.total_time_min = (target_recipe.prep_time_min or 0) + (target_recipe.cook_time_min or 0)
        target_recipe.base_servings = data.get("base_servings", target_recipe.base_servings)

        # Update nutrition
        cal = data.get("nutrition_calories")
        prot = data.get("nutrition_protein")
        carbs = data.get("nutrition_carbs")
        fat = data.get("nutrition_fat")
        if cal is None or float(cal or 0) <= 0:
            est = gemini_service.estimate_recipe_nutrition(
                title=target_recipe.title,
                ingredients=data.get("ingredients", []),
                base_servings=target_recipe.base_servings,
                dish_type=target_recipe.dish_type
            )
            cal = est.get("calories")
            prot = est.get("protein")
            carbs = est.get("carbs")
            fat = est.get("fat")
        target_recipe.nutrition_calories = cal
        target_recipe.nutrition_protein = prot
        target_recipe.nutrition_carbs = carbs
        target_recipe.nutrition_fat = fat
        target_recipe.updated_at = datetime.utcnow()

        # Update variant ingredients & steps
        variant = next((v for v in target_recipe.variants if v.is_default), target_recipe.variants[0] if target_recipe.variants else None)
        if not variant:
            variant = RecipeVariant(recipe_id=target_recipe.id, variant_type="traditional", title="Preparación tradicional", is_default=True)
            db.add(variant)
            db.flush()

        db.query(RecipeIngredient).filter(RecipeIngredient.variant_id == variant.id).delete()
        for idx, ing in enumerate(data.get("ingredients", [])):
            db.add(RecipeIngredient(
                variant_id=variant.id,
                name=ing.get("name", "Ingrediente"),
                amount=ing.get("amount"),
                unit=ing.get("unit"),
                notes=ing.get("notes"),
                order_index=idx
            ))

        db.query(RecipeStep).filter(RecipeStep.variant_id == variant.id).delete()
        for step in data.get("steps", []):
            db.add(RecipeStep(
                variant_id=variant.id,
                step_number=step.get("step_number", 1),
                instruction=step.get("instruction", ""),
                timer_seconds=step.get("timer_seconds"),
                tip=step.get("tip")
            ))

        from sqlalchemy import func
        from app.models.recipe import RecipeRevision
        last_rev = db.query(func.max(RecipeRevision.version_num)).filter(RecipeRevision.recipe_id == target_recipe.id).scalar() or 1
        db.add(RecipeRevision(
            recipe_id=target_recipe.id,
            user_id=current_user.id,
            version_num=last_rev + 1,
            snapshot_json=json.dumps({"title": target_recipe.title, "updated_from_draft": True}, ensure_ascii=False),
            change_summary="Actualizada con cambios desde Google Drive"
        ))

        draft.status = "approved"
        draft.approved_recipe_id = target_recipe.id
        draft.duplicate_recipe_id = None
        draft.reviewed_by_id = current_user.id
        draft.reviewed_at = datetime.utcnow()

        batch.pending_count = max(0, batch.pending_count - 1)
        if batch.duplicate_count > 0:
            batch.duplicate_count = max(0, batch.duplicate_count - 1)
        batch.approved_count += 1
        db.commit()

        return {"message": "Receta existente actualizada con éxito con los cambios de Google Drive", "recipe_id": target_recipe.id}

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Acción no soportada")


@router.post("/batches/{batch_id}/approve-all", response_model=ImportBatchResponse)
def approve_all_batch_drafts(
    batch_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    batch = db.query(ImportBatch).filter(ImportBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lote no encontrado")

    drafts_to_approve = [d for d in batch.drafts if d.status in ["pending_review", "duplicate"]]
    if not drafts_to_approve:
        return _format_batch_response(batch)

    for draft in drafts_to_approve:
        try:
            data = json.loads(draft.extracted_json) if isinstance(draft.extracted_json, str) else draft.extracted_json
        except Exception:
            data = {"title": draft.title}

        # Check if recipe already exists
        existing_recipe = None
        if draft.duplicate_recipe_id:
            existing_recipe = db.query(Recipe).filter(Recipe.id == draft.duplicate_recipe_id).first()
        if not existing_recipe and getattr(draft, "source_url", None):
            existing_recipe = db.query(Recipe).filter(Recipe.source_url == draft.source_url).first()
        if not existing_recipe and draft.title:
            existing_recipe = db.query(Recipe).filter(Recipe.title.ilike(draft.title.strip())).first()

        if existing_recipe:
            # Update existing recipe
            existing_recipe.title = data.get("title", draft.title)
            if data.get("description"):
                existing_recipe.description = data.get("description")
                existing_recipe.summary = data.get("description", "")[:150]
            if draft.proposed_image_url:
                existing_recipe.main_image_url = draft.proposed_image_url
            if getattr(draft, "source_url", None):
                existing_recipe.source_url = draft.source_url
            cal = data.get("nutrition_calories")
            prot = data.get("nutrition_protein")
            carbs = data.get("nutrition_carbs")
            fat = data.get("nutrition_fat")
            if cal is None or float(cal or 0) <= 0:
                est = gemini_service.estimate_recipe_nutrition(
                    title=existing_recipe.title,
                    ingredients=data.get("ingredients", []),
                    base_servings=existing_recipe.base_servings,
                    dish_type=existing_recipe.dish_type
                )
                cal = est.get("calories")
                prot = est.get("protein")
                carbs = est.get("carbs")
                fat = est.get("fat")
            existing_recipe.nutrition_calories = cal
            existing_recipe.nutrition_protein = prot
            existing_recipe.nutrition_carbs = carbs
            existing_recipe.nutrition_fat = fat
            existing_recipe.updated_at = datetime.utcnow()

            variant = next((v for v in existing_recipe.variants if v.is_default), existing_recipe.variants[0] if existing_recipe.variants else None)
            if not variant:
                variant = RecipeVariant(recipe_id=existing_recipe.id, variant_type="traditional", title="Preparación tradicional", is_default=True)
                db.add(variant)
                db.flush()

            db.query(RecipeIngredient).filter(RecipeIngredient.variant_id == variant.id).delete()
            for idx, ing in enumerate(data.get("ingredients", [])):
                db.add(RecipeIngredient(
                    variant_id=variant.id,
                    name=ing.get("name", "Ingrediente"),
                    amount=ing.get("amount"),
                    unit=ing.get("unit"),
                    notes=ing.get("notes"),
                    order_index=idx
                ))

            db.query(RecipeStep).filter(RecipeStep.variant_id == variant.id).delete()
            for step in data.get("steps", []):
                db.add(RecipeStep(
                    variant_id=variant.id,
                    step_number=step.get("step_number", 1),
                    instruction=step.get("instruction", ""),
                    timer_seconds=step.get("timer_seconds"),
                    tip=step.get("tip")
                ))

            draft.status = "approved"
            draft.approved_recipe_id = existing_recipe.id
            draft.duplicate_recipe_id = None
        else:
            cal = data.get("nutrition_calories")
            prot = data.get("nutrition_protein")
            carbs = data.get("nutrition_carbs")
            fat = data.get("nutrition_fat")
            if cal is None or float(cal or 0) <= 0:
                est = gemini_service.estimate_recipe_nutrition(
                    title=data.get("title", draft.title),
                    ingredients=data.get("ingredients", []),
                    base_servings=data.get("base_servings", 4),
                    dish_type=data.get("dish_type", "Plato principal")
                )
                cal = est.get("calories")
                prot = est.get("protein")
                carbs = est.get("carbs")
                fat = est.get("fat")

            new_recipe = Recipe(
                title=data.get("title", draft.title),
                description=data.get("description"),
                summary=data.get("description", "")[:150] if data.get("description") else None,
                main_image_url=draft.proposed_image_url or draft.source_image_url,
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
                source_type=batch.source_type,
                source_url=draft.source_url or getattr(batch, "source_url", None) or batch.source_name,
                review_status="approved",
                created_by_id=current_user.id
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

            draft.status = "approved"
            draft.approved_recipe_id = new_recipe.id

        draft.reviewed_by_id = current_user.id
        draft.reviewed_at = datetime.utcnow()
        batch.approved_count += 1

    batch.pending_count = 0
    batch.duplicate_count = 0
    batch.status = "completed"
    db.commit()
    db.refresh(batch)
    return _format_batch_response(batch, db)


@router.get("/drafts/{draft_id}", response_model=RecipeDraftResponse)
def get_recipe_draft(
    draft_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    draft = db.query(RecipeDraft).filter(RecipeDraft.id == draft_id).first()
    if not draft:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Borrador no encontrado")
    return _format_draft_response(draft)


@router.put("/drafts/{draft_id}", response_model=RecipeDraftResponse)
def update_recipe_draft(
    draft_id: int,
    update_in: DraftUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    draft = db.query(RecipeDraft).filter(RecipeDraft.id == draft_id).first()
    if not draft:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Borrador no encontrado")

    if update_in.title is not None:
        draft.title = update_in.title.strip()
    if update_in.proposed_image_url is not None:
        draft.proposed_image_url = update_in.proposed_image_url.strip() or None
    if update_in.source_url is not None:
        draft.source_url = update_in.source_url.strip() or None
    if update_in.extracted_json is not None:
        draft.extracted_json = json.dumps(update_in.extracted_json, ensure_ascii=False)

    draft.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(draft)
    return _format_draft_response(draft)


@router.post("/drafts/{draft_id}/upload-image", response_model=RecipeDraftResponse)
async def upload_draft_image(
    draft_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    draft = db.query(RecipeDraft).filter(RecipeDraft.id == draft_id).first()
    if not draft:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Borrador no encontrado")

    file_ext = os.path.splitext(file.filename or "")[1].lower() or ".jpg"
    img_name = f"draft_custom_{uuid.uuid4().hex[:12]}{file_ext}"
    recipes_dir = os.path.join(settings.STORAGE_PATH, "recipes")
    os.makedirs(recipes_dir, exist_ok=True)
    filepath = os.path.join(recipes_dir, img_name)

    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    img_url = f"/api/media/recipes/{img_name}"
    draft.proposed_image_url = img_url
    draft.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(draft)
    return _format_draft_response(draft)


@router.get("/drafts/{draft_id}/suggest-images")
def suggest_draft_images(
    draft_id: int,
    query: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    draft = db.query(RecipeDraft).filter(RecipeDraft.id == draft_id).first()
    if not draft:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Borrador no encontrado")

    try:
        extracted = json.loads(draft.extracted_json) if isinstance(draft.extracted_json, str) else draft.extracted_json
    except Exception:
        extracted = {}

    search_term = query.strip() if (query and query.strip()) else draft.title
    dish_type = extracted.get("dish_type")
    cuisine = extracted.get("cuisine")
    candidates = gemini_service.get_food_image_candidates(
        title=search_term,
        dish_type=dish_type,
        cuisine=cuisine,
        count=12
    )
    return {"candidates": candidates, "query": search_term}


@router.post("/drafts/{draft_id}/reformat-with-ai", response_model=RecipeDraftResponse)
def reformat_draft_with_ai(
    draft_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    draft = db.query(RecipeDraft).filter(RecipeDraft.id == draft_id).first()
    if not draft:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Borrador no encontrado")

    text_to_analyze = draft.raw_text
    if not text_to_analyze or len(text_to_analyze.strip()) < 10:
        try:
            ex = json.loads(draft.extracted_json) if isinstance(draft.extracted_json, str) else draft.extracted_json
            text_to_analyze = f"{draft.title}\n{ex.get('description', '')}\n" + "\n".join(
                [f"- {i.get('amount', '')} {i.get('unit', '')} {i.get('name', '')}" for i in ex.get('ingredients', [])]
            ) + "\n" + "\n".join([f"{s.get('step_number', 1)}. {s.get('instruction', '')}" for s in ex.get('steps', [])])
        except Exception:
            text_to_analyze = draft.title

    extracted_list = gemini_service.extract_recipes_from_text(text_to_analyze, source_hint=draft.title)
    if not extracted_list:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No se pudo procesar la receta con Gemini")

    best_recipe = extracted_list[0]
    new_title = best_recipe.get("title", draft.title).strip()
    dish_type = best_recipe.get("dish_type", "Plato principal")
    cuisine = best_recipe.get("cuisine", "Mediterránea")

    new_img = gemini_service.generate_or_find_recipe_image(
        title=new_title,
        dish_type=dish_type,
        cuisine=cuisine
    )

    draft.title = new_title
    draft.extracted_json = json.dumps(best_recipe, ensure_ascii=False)
    draft.proposed_image_url = new_img
    draft.ai_confidence = 0.98 if gemini_service.is_configured() else 0.70
    draft.uncertainty_notes = json.dumps(best_recipe.get("uncertainty_notes", []), ensure_ascii=False) if best_recipe.get("uncertainty_notes") else None
    draft.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(draft)
    return _format_draft_response(draft)


@router.post("/batches/{batch_id}/reformat-all", response_model=ImportBatchResponse)
def reformat_all_batch_drafts(
    batch_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    batch = db.query(ImportBatch).filter(ImportBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lote no encontrado")

    drafts = [d for d in batch.drafts if d.status in ["pending_review", "duplicate"]]
    for draft in drafts:
        try:
            text_to_analyze = draft.raw_text
            if not text_to_analyze or len(text_to_analyze.strip()) < 10:
                try:
                    ex = json.loads(draft.extracted_json) if isinstance(draft.extracted_json, str) else draft.extracted_json
                    text_to_analyze = f"{draft.title}\n{ex.get('description', '')}\n" + "\n".join(
                        [f"- {i.get('amount', '')} {i.get('unit', '')} {i.get('name', '')}" for i in ex.get('ingredients', [])]
                    ) + "\n" + "\n".join([f"{s.get('step_number', 1)}. {s.get('instruction', '')}" for s in ex.get('steps', [])])
                except Exception:
                    text_to_analyze = draft.title

            extracted_list = gemini_service.extract_recipes_from_text(text_to_analyze, source_hint=draft.title)
            if extracted_list:
                best_recipe = extracted_list[0]
                new_title = best_recipe.get("title", draft.title).strip()
                dish_type = best_recipe.get("dish_type", "Plato principal")
                cuisine = best_recipe.get("cuisine", "Mediterránea")

                new_img = gemini_service.generate_or_find_recipe_image(
                    title=new_title,
                    dish_type=dish_type,
                    cuisine=cuisine
                )

                draft.title = new_title
                draft.extracted_json = json.dumps(best_recipe, ensure_ascii=False)
                draft.proposed_image_url = new_img
                draft.ai_confidence = 0.98 if gemini_service.is_configured() else 0.70
                draft.uncertainty_notes = json.dumps(best_recipe.get("uncertainty_notes", []), ensure_ascii=False) if best_recipe.get("uncertainty_notes") else None
                draft.updated_at = datetime.utcnow()
        except Exception as e:
            logger.warning(f"Error re-analyzing draft {draft.id}: {e}")

    db.commit()
    db.refresh(batch)
    return _format_batch_response(batch)

