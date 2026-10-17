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
    InstagramImportRequest, UrlImportRequest
)
from app.api.deps import get_current_user
from app.services.storage_guard import storage_guard
from app.services.ocr_service import ocr_service
from app.services.gemini_service import gemini_service
from app.services.instagram_service import instagram_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/imports", tags=["Importador Inteligente"])


def _format_batch_response(batch: ImportBatch) -> ImportBatchResponse:
    drafts_resp = []
    for d in batch.drafts:
        try:
            extracted = json.loads(d.extracted_json) if isinstance(d.extracted_json, str) else d.extracted_json
        except Exception:
            extracted = {}
        drafts_resp.append(RecipeDraftResponse(
            id=d.id,
            batch_id=d.batch_id,
            title=d.title,
            extracted_json=extracted,
            source_image_url=d.source_image_url,
            proposed_image_url=d.proposed_image_url,
            status=d.status,
            duplicate_recipe_id=d.duplicate_recipe_id,
            ai_confidence=d.ai_confidence,
            uncertainty_notes=d.uncertainty_notes,
            created_at=d.created_at
        ))

    return ImportBatchResponse(
        id=batch.id,
        source_type=batch.source_type,
        source_name=batch.source_name,
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

            draft = RecipeDraft(
                batch_id=batch.id,
                title=title,
                raw_text=extracted_text[:2000],
                extracted_json=json.dumps(r_data, ensure_ascii=False),
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

        batch.total_detected = 1
        batch.pending_count = 1 if not dup else 0
        batch.duplicate_count = 1 if dup else 0
        batch.status = "pending_review"

        draft = RecipeDraft(
            batch_id=batch.id,
            title=title,
            raw_text=result.get("description", ""),
            extracted_json=json.dumps(recipe_data, ensure_ascii=False),
            source_image_url=result.get("thumbnail_url"),
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
        batch.status = "error"
        batch.error_message = str(e)
        db.commit()

    return _format_batch_response(batch)


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
            allergens=json.dumps(data.get("allergens", []), ensure_ascii=False),
            source_type=batch.source_type,
            source_url=batch.source_name,
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

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Acción no soportada")
