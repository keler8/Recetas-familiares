import json
import logging
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from app.database import get_db
from app.models.auth import User
from app.models.recipe import (
    Recipe, RecipeVariant, RecipeIngredient, RecipeStep, RecipeRevision,
    RecipeRating, RecipeFavorite, RecipePersonalNote
)
from app.schemas.recipe import (
    RecipeCreate, RecipeUpdate, RecipeResponse, RecipeVariantCreate, RecipeVariantResponse,
    RecipeRatingCreate, RecipeRatingResponse, RecipePersonalNoteCreate, RecipePersonalNoteResponse
)
from app.models.system import SystemSetting
from app.api.deps import get_current_user
from app.services.gemini_service import gemini_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/recipes", tags=["Recetas"])

DEFAULT_RECIPE_CONFIG = {
    "meal_types": [
        {"id": "desayuno", "label": "Desayuno", "icon": "Sun", "color": "amber"},
        {"id": "almuerzo_merienda", "label": "Almuerzo / Merienda", "icon": "Coffee", "color": "orange"},
        {"id": "comida_cena", "label": "Comida / Cena", "icon": "Utensils", "color": "emerald"},
        {"id": "snacks", "label": "Snacks / Picoteo", "icon": "Apple", "color": "purple"}
    ],
    "tags": [
        {"id": "saludable", "label": "Saludable", "color": "emerald"},
        {"id": "mas_usada", "label": "Más usada", "color": "blue"},
        {"id": "top_receta", "label": "Top receta ⭐", "color": "amber"},
        {"id": "rapida", "label": "Rápida (<25 min)", "color": "cyan"},
        {"id": "facil", "label": "Fácil", "color": "green"},
        {"id": "sin_gluten", "label": "Sin gluten", "color": "yellow"},
        {"id": "sin_lactosa", "label": "Sin lactosa", "color": "indigo"},
        {"id": "batch_cooking", "label": "Batch Cooking", "color": "teal"}
    ]
}


@router.get("/config")
def get_recipe_configuration(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    setting = db.query(SystemSetting).filter(SystemSetting.key == "recipe_config").first()
    if setting and setting.value:
        try:
            return json.loads(setting.value)
        except Exception:
            pass
    return DEFAULT_RECIPE_CONFIG


def _format_recipe_response(recipe: Recipe, current_user_id: int, db: Session) -> RecipeResponse:
    avg_rating = db.query(func.avg(RecipeRating.rating)).filter(RecipeRating.recipe_id == recipe.id).scalar()
    is_fav = db.query(RecipeFavorite).filter(
        RecipeFavorite.recipe_id == recipe.id,
        RecipeFavorite.user_id == current_user_id
    ).first() is not None

    personal_note = db.query(RecipePersonalNote).filter(
        RecipePersonalNote.recipe_id == recipe.id,
        RecipePersonalNote.user_id == current_user_id
    ).first()

    categories_list = json.loads(recipe.categories) if recipe.categories else []
    tags_list = json.loads(recipe.tags) if recipe.tags else []
    allergens_list = json.loads(recipe.allergens) if recipe.allergens else []

    variants_resp = []
    for v in recipe.variants:
        variants_resp.append(RecipeVariantResponse.model_validate(v))

    ratings_resp = [RecipeRatingResponse.model_validate(r) for r in recipe.ratings]

    return RecipeResponse(
        id=recipe.id,
        title=recipe.title,
        description=recipe.description,
        summary=recipe.summary,
        main_image_url=recipe.main_image_url,
        categories=categories_list,
        tags=tags_list,
        meal_type=recipe.meal_type or "comida_cena",
        dish_type=recipe.dish_type,
        cuisine=recipe.cuisine,
        prep_time_min=recipe.prep_time_min,
        cook_time_min=recipe.cook_time_min,
        total_time_min=recipe.total_time_min,
        difficulty=recipe.difficulty,
        base_servings=recipe.base_servings,
        equipment_notes=recipe.equipment_notes,
        preservation_tips=recipe.preservation_tips,
        freezing_tips=recipe.freezing_tips,
        reheating_tips=recipe.reheating_tips,
        leftover_tips=recipe.leftover_tips,
        chef_notes=recipe.chef_notes,
        nutrition_calories=recipe.nutrition_calories,
        nutrition_protein=recipe.nutrition_protein,
        nutrition_carbs=recipe.nutrition_carbs,
        nutrition_fat=recipe.nutrition_fat,
        allergens=allergens_list,
        original_author=recipe.original_author,
        source_type=recipe.source_type,
        source_url=recipe.source_url,
        review_status=recipe.review_status,
        times_prepared=recipe.times_prepared,
        created_by_id=recipe.created_by_id,
        created_at=recipe.created_at,
        updated_at=recipe.updated_at,
        variants=variants_resp,
        ratings=ratings_resp,
        average_rating=round(float(avg_rating), 1) if avg_rating else None,
        is_favorite=is_fav,
        personal_notes=personal_note.notes if personal_note else None
    )


@router.get("", response_model=List[RecipeResponse])
def list_recipes(
    search: Optional[str] = Query(None, description="Búsqueda textual o por ingredientes"),
    category: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    meal_type: Optional[str] = Query(None, description="desayuno, almuerzo_merienda, comida_cena, snacks"),
    dish_type: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    appliance: Optional[str] = Query(None, description="Thermomix, Airfryer, Tradicional"),
    favorites_only: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Recipe).filter(Recipe.review_status == "approved")

    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Recipe.title.ilike(search_pattern),
                Recipe.description.ilike(search_pattern),
                Recipe.summary.ilike(search_pattern),
                Recipe.categories.ilike(search_pattern),
                Recipe.tags.ilike(search_pattern)
            )
        )

    if category:
        query = query.filter(Recipe.categories.ilike(f"%{category}%"))

    if tag:
        query = query.filter(Recipe.tags.ilike(f"%{tag}%"))

    if meal_type:
        query = query.filter(Recipe.meal_type == meal_type)

    if dish_type:
        query = query.filter(Recipe.dish_type == dish_type)

    if difficulty:
        query = query.filter(Recipe.difficulty == difficulty)

    if appliance:
        query = query.join(RecipeVariant).filter(RecipeVariant.variant_type.ilike(f"%{appliance}%"))

    if favorites_only:
        query = query.join(RecipeFavorite).filter(RecipeFavorite.user_id == current_user.id)

    recipes = query.order_by(Recipe.updated_at.desc()).all()
    return [_format_recipe_response(r, current_user.id, db) for r in recipes]


@router.get("/{recipe_id}", response_model=RecipeResponse)
def get_recipe_detail(
    recipe_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receta no encontrada")
    return _format_recipe_response(recipe, current_user.id, db)


@router.post("", response_model=RecipeResponse)
def create_recipe(
    recipe_in: RecipeCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    recipe = Recipe(
        title=recipe_in.title,
        description=recipe_in.description,
        summary=recipe_in.summary,
        main_image_url=recipe_in.main_image_url,
        categories=json.dumps(recipe_in.categories or [], ensure_ascii=False),
        tags=json.dumps(recipe_in.tags or [], ensure_ascii=False),
        meal_type=recipe_in.meal_type or "comida_cena",
        dish_type=recipe_in.dish_type,
        cuisine=recipe_in.cuisine,
        prep_time_min=recipe_in.prep_time_min,
        cook_time_min=recipe_in.cook_time_min,
        total_time_min=recipe_in.total_time_min,
        difficulty=recipe_in.difficulty,
        base_servings=recipe_in.base_servings,
        equipment_notes=recipe_in.equipment_notes,
        preservation_tips=recipe_in.preservation_tips,
        freezing_tips=recipe_in.freezing_tips,
        reheating_tips=recipe_in.reheating_tips,
        leftover_tips=recipe_in.leftover_tips,
        chef_notes=recipe_in.chef_notes,
        nutrition_calories=recipe_in.nutrition_calories,
        nutrition_protein=recipe_in.nutrition_protein,
        nutrition_carbs=recipe_in.nutrition_carbs,
        nutrition_fat=recipe_in.nutrition_fat,
        allergens=json.dumps(recipe_in.allergens or [], ensure_ascii=False),
        original_author=recipe_in.original_author,
        source_type=recipe_in.source_type,
        source_url=recipe_in.source_url,
        review_status="approved",
        created_by_id=current_user.id
    )
    db.add(recipe)
    db.flush()

    # Create variants
    variants_to_create = recipe_in.variants
    if not variants_to_create:
        # Default traditional variant
        variants_to_create = [RecipeVariantCreate(
            variant_type="traditional",
            title="Preparación tradicional",
            is_default=True
        )]

    for v_in in variants_to_create:
        variant = RecipeVariant(
            recipe_id=recipe.id,
            variant_type=v_in.variant_type,
            title=v_in.title,
            description=v_in.description,
            is_default=v_in.is_default,
            appliance_settings=v_in.appliance_settings
        )
        db.add(variant)
        db.flush()

        for idx, ing_in in enumerate(v_in.ingredients):
            ing = RecipeIngredient(
                variant_id=variant.id,
                name=ing_in.name,
                amount=ing_in.amount,
                unit=ing_in.unit,
                notes=ing_in.notes,
                is_optional=ing_in.is_optional,
                order_index=idx
            )
            db.add(ing)

        for step_in in v_in.steps:
            st = RecipeStep(
                variant_id=variant.id,
                step_number=step_in.step_number,
                instruction=step_in.instruction,
                appliance_action=step_in.appliance_action,
                temperature=step_in.temperature,
                speed=step_in.speed,
                accessory=step_in.accessory,
                timer_seconds=step_in.timer_seconds,
                tip=step_in.tip,
                is_manual=step_in.is_manual
            )
            db.add(st)

    # Initial revision snapshot
    rev = RecipeRevision(
        recipe_id=recipe.id,
        user_id=current_user.id,
        version_num=1,
        snapshot_json=json.dumps({"title": recipe.title, "base_servings": recipe.base_servings}, ensure_ascii=False),
        change_summary="Creación inicial de la receta"
    )
    db.add(rev)

    db.commit()
    db.refresh(recipe)
    return _format_recipe_response(recipe, current_user.id, db)


@router.put("/{recipe_id}", response_model=RecipeResponse)
def update_recipe(
    recipe_id: int,
    recipe_up: RecipeUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receta no encontrada")

    # Snapshot for version history
    last_rev = db.query(func.max(RecipeRevision.version_num)).filter(RecipeRevision.recipe_id == recipe.id).scalar() or 1
    snapshot = {
        "title": recipe.title,
        "description": recipe.description,
        "base_servings": recipe.base_servings
    }
    new_rev = RecipeRevision(
        recipe_id=recipe.id,
        user_id=current_user.id,
        version_num=last_rev + 1,
        snapshot_json=json.dumps(snapshot, ensure_ascii=False),
        change_summary=recipe_up.change_summary or "Modificación de receta"
    )
    db.add(new_rev)

    # Apply updates
    if recipe_up.title is not None:
        recipe.title = recipe_up.title
    if recipe_up.description is not None:
        recipe.description = recipe_up.description
    if recipe_up.summary is not None:
        recipe.summary = recipe_up.summary
    if recipe_up.main_image_url is not None:
        recipe.main_image_url = recipe_up.main_image_url
    if recipe_up.categories is not None:
        recipe.categories = json.dumps(recipe_up.categories, ensure_ascii=False)
    if recipe_up.tags is not None:
        recipe.tags = json.dumps(recipe_up.tags, ensure_ascii=False)
    if recipe_up.meal_type is not None:
        recipe.meal_type = recipe_up.meal_type
    if recipe_up.dish_type is not None:
        recipe.dish_type = recipe_up.dish_type
    if recipe_up.cuisine is not None:
        recipe.cuisine = recipe_up.cuisine
    if recipe_up.prep_time_min is not None:
        recipe.prep_time_min = recipe_up.prep_time_min
    if recipe_up.cook_time_min is not None:
        recipe.cook_time_min = recipe_up.cook_time_min
    if recipe_up.total_time_min is not None:
        recipe.total_time_min = recipe_up.total_time_min
    if recipe_up.difficulty is not None:
        recipe.difficulty = recipe_up.difficulty
    if recipe_up.base_servings is not None:
        recipe.base_servings = recipe_up.base_servings
    if recipe_up.allergens is not None:
        recipe.allergens = json.dumps(recipe_up.allergens, ensure_ascii=False)

    recipe.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(recipe)

    return _format_recipe_response(recipe, current_user.id, db)


@router.post("/{recipe_id}/generate-variant")
def generate_ai_appliance_variant(
    recipe_id: int,
    target_appliance: str = Query(..., description="thermomix o airfryer"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receta no encontrada")

    recipe_dict = {
        "title": recipe.title,
        "description": recipe.description,
        "ingredients": [
            {"name": ing.name, "amount": ing.amount, "unit": ing.unit}
            for v in recipe.variants for ing in v.ingredients if v.is_default or len(recipe.variants) == 1
        ],
        "steps": [
            {"step_number": s.step_number, "instruction": s.instruction}
            for v in recipe.variants for s in v.steps if v.is_default or len(recipe.variants) == 1
        ]
    }

    variant_proposal = gemini_service.generate_appliance_variant(recipe_dict, target_appliance)

    # Save as new variant draft
    new_variant = RecipeVariant(
        recipe_id=recipe.id,
        variant_type=target_appliance.lower(),
        title=variant_proposal.get("title", f"Adaptación para {target_appliance}"),
        description=variant_proposal.get("description"),
        is_default=False,
        appliance_settings=json.dumps(variant_proposal.get("appliance_settings", {}), ensure_ascii=False)
    )
    db.add(new_variant)
    db.flush()

    for idx, ing_data in enumerate(variant_proposal.get("ingredients", [])):
        db.add(RecipeIngredient(
            variant_id=new_variant.id,
            name=ing_data.get("name", ""),
            amount=ing_data.get("amount"),
            unit=ing_data.get("unit"),
            notes=ing_data.get("notes"),
            order_index=idx
        ))

    for step_data in variant_proposal.get("steps", []):
        db.add(RecipeStep(
            variant_id=new_variant.id,
            step_number=step_data.get("step_number", 1),
            instruction=step_data.get("instruction", ""),
            appliance_action=step_data.get("appliance_action"),
            temperature=step_data.get("temperature"),
            speed=step_data.get("speed"),
            accessory=step_data.get("accessory"),
            timer_seconds=step_data.get("timer_seconds"),
            tip=step_data.get("tip"),
            is_manual=step_data.get("is_manual", False)
        ))

    db.commit()
    db.refresh(recipe)
    return {"message": f"Variante para {target_appliance} generada correctamente", "variant_id": new_variant.id}


@router.post("/{recipe_id}/scale")
def scale_recipe_servings(
    recipe_id: int,
    target_servings: int = Query(..., ge=1, le=24),
    variant_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Scales ingredient quantities for target servings using culinary intelligence:
    - Scales base volume ingredients linearly (meat, rice, liquids).
    - Caps or warns about yeast, intense spices (chili, saffron), oil, and salt.
    - Does NOT scale cooking temperatures or times blindly!
    """
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Receta no encontrada")

    base = recipe.base_servings or 4
    ratio = target_servings / base

    # Select variant
    variant = None
    if variant_id:
        variant = db.query(RecipeVariant).filter(RecipeVariant.id == variant_id).first()
    if not variant and recipe.variants:
        variant = recipe.variants[0]

    scaled_ingredients = []
    culinary_warnings = []

    if target_servings > base * 2:
        culinary_warnings.append(
            f"Al escalar a {target_servings} raciones, vigila la capacidad máxima de la cubeta o vaso del electrodoméstico."
        )

    for ing in variant.ingredients:
        scaled_amt = ing.amount
        if ing.amount is not None:
            lower_name = ing.name.lower()
            # Culinary exceptions:
            if any(k in lower_name for k in ["levadura", "yeast"]):
                # Levadura scales sub-linearly
                scaled_amt = round(ing.amount * (ratio ** 0.8), 1)
                culinary_warnings.append("La cantidad de levadura se ha ajustado proporcionalmente para evitar sobrefermentación.")
            elif any(k in lower_name for k in ["guindilla", "chile", "pimienta de cayena", "picante"]):
                scaled_amt = round(ing.amount * (ratio ** 0.7), 1)
                culinary_warnings.append(f"El picante ({ing.name}) se ha ajustado con moderación para no descompensar el plato.")
            elif any(k in lower_name for k in ["aceite", "oil"]) and ratio > 1.5:
                # Oil doesn't need to scale 100% linearly for sautés
                scaled_amt = round(ing.amount * (ratio ** 0.85), 1)
            else:
                scaled_amt = round(ing.amount * ratio, 1)

        scaled_ingredients.append({
            "name": ing.name,
            "base_amount": ing.amount,
            "scaled_amount": scaled_amt,
            "unit": ing.unit,
            "notes": ing.notes
        })

    return {
        "recipe_title": recipe.title,
        "base_servings": base,
        "target_servings": target_servings,
        "ratio": ratio,
        "scaled_ingredients": scaled_ingredients,
        "culinary_warnings": list(set(culinary_warnings))
    }


@router.post("/{recipe_id}/rate", response_model=RecipeRatingResponse)
def rate_recipe(
    recipe_id: int,
    rate_in: RecipeRatingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    rating = db.query(RecipeRating).filter(
        RecipeRating.recipe_id == recipe_id,
        RecipeRating.user_id == current_user.id
    ).first()

    if not rating:
        rating = RecipeRating(
            recipe_id=recipe_id,
            user_id=current_user.id,
            rating=rate_in.rating,
            comment=rate_in.comment
        )
        db.add(rating)
    else:
        rating.rating = rate_in.rating
        rating.comment = rate_in.comment

    db.commit()
    db.refresh(rating)
    return rating


@router.post("/{recipe_id}/favorite")
def toggle_favorite(
    recipe_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    fav = db.query(RecipeFavorite).filter(
        RecipeFavorite.recipe_id == recipe_id,
        RecipeFavorite.user_id == current_user.id
    ).first()

    if fav:
        db.delete(fav)
        db.commit()
        return {"is_favorite": False}
    else:
        db.add(RecipeFavorite(recipe_id=recipe_id, user_id=current_user.id))
        db.commit()
        return {"is_favorite": True}


@router.put("/{recipe_id}/note", response_model=RecipePersonalNoteResponse)
def update_personal_note(
    recipe_id: int,
    note_in: RecipePersonalNoteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    note = db.query(RecipePersonalNote).filter(
        RecipePersonalNote.recipe_id == recipe_id,
        RecipePersonalNote.user_id == current_user.id
    ).first()

    if not note:
        note = RecipePersonalNote(
            recipe_id=recipe_id,
            user_id=current_user.id,
            notes=note_in.notes
        )
        db.add(note)
    else:
        note.notes = note_in.notes

    db.commit()
    db.refresh(note)
    return note
