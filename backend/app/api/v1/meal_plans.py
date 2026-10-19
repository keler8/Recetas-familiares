import json
import logging
from datetime import datetime, date, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.database import get_db
from app.models.auth import User
from app.models.household import Household
from app.models.recipe import Recipe, RecipeVariant, RecipeIngredient, RecipeStep
from app.models.meal_plan import MealPlan, MealSlot, PlannedRecipe, Leftover
from app.models.nutrition import NutritionProfile, DietitianReport

logger = logging.getLogger(__name__)
from app.schemas.meal_plan import (
    MealPlanCreate, MealPlanResponse, AddRecipeToSlotRequest,
    AiMenuGenerateRequest, LeftoverCreate, LeftoverResponse,
    NutritionPlanParsedResponse, ApplyNutritionPlanRequest,
    NutritionPlanDay, NutritionPlanMeal, NutritionPlanIngredient, NutritionPlanStep,
    PlannedRecipeResponse, MealSlotResponse,
    MovePlannedRecipeRequest, SaveTemplateRequest, ApplyTemplateRequest, CopyWeekRequest
)
from app.api.deps import get_current_user, get_current_household
from app.services.gemini_service import gemini_service

router = APIRouter(prefix="/meal-plans", tags=["Planificador de Menús"])


def _format_plan_response(plan: MealPlan, db: Session) -> MealPlanResponse:
    slot_resps = []
    for s in plan.slots:
        p_resps = []
        slot_cals = 0.0
        for p in s.planned_recipes:
            rec_title = p.custom_recipe_name
            cal = p.custom_calories
            if p.recipe_id:
                rec = db.query(Recipe).filter(Recipe.id == p.recipe_id).first()
                if rec:
                    rec_title = rec.title
                    if rec.nutrition_calories:
                        cal = round(float(rec.nutrition_calories) * (p.servings / (rec.base_servings or 4)), 1)
            
            if cal is not None:
                slot_cals += float(cal)

            p_resps.append(PlannedRecipeResponse(
                id=p.id,
                recipe_id=p.recipe_id,
                custom_recipe_name=p.custom_recipe_name,
                custom_calories=p.custom_calories,
                calories=round(cal, 1) if cal is not None else None,
                servings=p.servings,
                is_cooked=p.is_cooked,
                recipe_title=rec_title
            ))
        slot_resps.append(MealSlotResponse(
            id=s.id,
            slot_date=s.slot_date,
            meal_type=s.meal_type,
            servings=s.servings,
            notes=s.notes,
            total_calories=round(slot_cals, 1) if slot_cals > 0 else None,
            planned_recipes=p_resps
        ))
    return MealPlanResponse(
        id=plan.id,
        household_id=plan.household_id,
        title=plan.title,
        start_date=plan.start_date,
        end_date=plan.end_date,
        is_template=plan.is_template,
        created_at=plan.created_at,
        slots=slot_resps
    )


@router.get("", response_model=List[MealPlanResponse])
def list_meal_plans(
    include_templates: bool = False,
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    query = db.query(MealPlan).filter(MealPlan.household_id == household.id)
    if not include_templates:
        query = query.filter(MealPlan.is_template == False)
    plans = query.order_by(MealPlan.start_date.desc()).all()
    return [_format_plan_response(p, db) for p in plans]


@router.get("/active")
def get_active_meal_plan(
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    today = date.today()
    # Try finding plan covering today
    plan = db.query(MealPlan).filter(
        MealPlan.household_id == household.id,
        MealPlan.start_date <= today,
        MealPlan.end_date >= today
    ).order_by(MealPlan.id.desc()).first()

    if not plan:
        # Fallback to latest plan
        plan = db.query(MealPlan).filter(
            MealPlan.household_id == household.id
        ).order_by(MealPlan.start_date.desc()).first()

    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active meal plan found")

    DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
    items = []
    for s in plan.slots:
        day_name = DAY_NAMES[s.slot_date.weekday()]
        for p in s.planned_recipes:
            rec_obj = None
            if p.recipe_id:
                rec = db.query(Recipe).filter(Recipe.id == p.recipe_id).first()
                if rec:
                    rec_obj = {
                        "id": rec.id,
                        "title": rec.title,
                        "cuisine": rec.cuisine,
                        "image_url": rec.main_image_url
                    }
            items.append({
                "id": p.id,
                "meal_type": s.meal_type,
                "slot_date": s.slot_date.isoformat(),
                "day_of_week": day_name,
                "recipe_id": p.recipe_id,
                "custom_meal_title": p.custom_recipe_name,
                "recipe": rec_obj
            })

    formatted = _format_plan_response(plan, db)
    res_dict = formatted.model_dump() if hasattr(formatted, "model_dump") else formatted.dict()
    res_dict["items"] = items
    return res_dict


@router.post("", response_model=MealPlanResponse)
def create_meal_plan(
    plan_in: MealPlanCreate,
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    existing = db.query(MealPlan).filter(
        MealPlan.household_id == household.id,
        MealPlan.start_date == plan_in.start_date,
        MealPlan.end_date == plan_in.end_date
    ).first()
    if existing:
        return _format_plan_response(existing, db)

    plan = MealPlan(
        household_id=household.id,
        title=plan_in.title,
        start_date=plan_in.start_date,
        end_date=plan_in.end_date,
        is_template=plan_in.is_template
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return _format_plan_response(plan, db)


@router.post("/{plan_id}/add-recipe")
def add_recipe_to_slot(
    plan_id: int,
    req: AddRecipeToSlotRequest,
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    plan = db.query(MealPlan).filter(MealPlan.id == plan_id, MealPlan.household_id == household.id).first()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan de menú no encontrado")

    slot = db.query(MealSlot).filter(
        MealSlot.meal_plan_id == plan.id,
        MealSlot.slot_date == req.slot_date,
        MealSlot.meal_type == req.meal_type
    ).first()

    if not slot:
        slot = MealSlot(
            meal_plan_id=plan.id,
            slot_date=req.slot_date,
            meal_type=req.meal_type,
            servings=req.servings
        )
        db.add(slot)
        db.flush()

    planned = PlannedRecipe(
        meal_slot_id=slot.id,
        recipe_id=req.recipe_id,
        custom_recipe_name=req.custom_recipe_name,
        custom_calories=req.custom_calories,
        servings=req.servings
    )
    db.add(planned)
    db.commit()
    return {"message": "Alimento o receta añadido con éxito al plan"}


@router.delete("/planned-recipes/{planned_id}")
def delete_planned_recipe(
    planned_id: int,
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    planned = db.query(PlannedRecipe).join(MealSlot).join(MealPlan).filter(
        PlannedRecipe.id == planned_id,
        MealPlan.household_id == household.id
    ).first()
    if not planned:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Elemento no encontrado en el menú")

    slot_id = planned.meal_slot_id
    db.delete(planned)
    db.commit()

    # If slot has no more items, clean it up
    remaining = db.query(PlannedRecipe).filter(PlannedRecipe.meal_slot_id == slot_id).count()
    if remaining == 0:
        db.query(MealSlot).filter(MealSlot.id == slot_id).delete()
        db.commit()

    return {"message": "Elemento eliminado correctamente del menú"}


@router.post("/move-item")
def move_planned_recipe_item(
    req: MovePlannedRecipeRequest,
    household: Household = Depends(get_current_household),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    planned = db.query(PlannedRecipe).join(MealSlot).join(MealPlan).filter(
        PlannedRecipe.id == req.planned_recipe_id,
        MealPlan.household_id == household.id
    ).first()
    if not planned:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Elemento no encontrado")

    old_slot_id = planned.meal_slot_id
    old_slot = db.query(MealSlot).filter(MealSlot.id == old_slot_id).first()

    # Si ya está en la misma fecha y tipo de comida, no hay nada que mover
    if old_slot and old_slot.slot_date == req.target_date and old_slot.meal_type == req.target_meal_type:
        return {"success": True, "message": "El elemento ya se encuentra en esa posición", "new_slot_id": old_slot_id}

    # Buscar el plan que cubre la fecha destino
    target_plan = db.query(MealPlan).filter(
        MealPlan.household_id == household.id,
        MealPlan.start_date <= req.target_date,
        MealPlan.end_date >= req.target_date,
        MealPlan.is_template == False
    ).first()

    if not target_plan:
        weekday = req.target_date.weekday()
        monday = req.target_date - timedelta(days=weekday)
        sunday = monday + timedelta(days=6)
        target_plan = MealPlan(
            household_id=household.id,
            title=f"Semana ({monday.strftime('%d/%m')} - {sunday.strftime('%d/%m')})",
            start_date=monday,
            end_date=sunday,
            is_template=False,
            created_by_id=current_user.id
        )
        db.add(target_plan)
        db.flush()

    # Buscar o crear el slot destino
    target_slot = db.query(MealSlot).filter(
        MealSlot.meal_plan_id == target_plan.id,
        MealSlot.slot_date == req.target_date,
        MealSlot.meal_type == req.target_meal_type
    ).first()

    if not target_slot:
        target_slot = MealSlot(
            meal_plan_id=target_plan.id,
            slot_date=req.target_date,
            meal_type=req.target_meal_type,
            servings=planned.servings
        )
        db.add(target_slot)
        db.flush()

    # Reasignar la receta planificada al nuevo slot
    planned.meal_slot_id = target_slot.id
    db.flush()

    # Limpiar el slot origen si quedó vacío
    remaining = db.query(PlannedRecipe).filter(PlannedRecipe.meal_slot_id == old_slot_id).count()
    if remaining == 0:
        db.query(MealSlot).filter(MealSlot.id == old_slot_id).delete()

    db.commit()
    return {
        "success": True,
        "message": f"Elemento movido a {req.target_meal_type} del {req.target_date.strftime('%d/%m')}",
        "new_slot_id": target_slot.id
    }


@router.get("/templates", response_model=List[MealPlanResponse])
def list_meal_plan_templates(
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    templates = db.query(MealPlan).filter(
        MealPlan.household_id == household.id,
        MealPlan.is_template == True
    ).order_by(MealPlan.created_at.desc()).all()
    return [_format_plan_response(t, db) for t in templates]


@router.post("/save-template", response_model=MealPlanResponse)
def save_meal_plan_as_template(
    req: SaveTemplateRequest,
    household: Household = Depends(get_current_household),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    source_plan = None
    if req.plan_id:
        source_plan = db.query(MealPlan).filter(MealPlan.id == req.plan_id, MealPlan.household_id == household.id).first()
    elif req.source_start_date:
        source_plan = db.query(MealPlan).filter(
            MealPlan.household_id == household.id,
            MealPlan.start_date <= req.source_start_date,
            MealPlan.end_date >= req.source_start_date,
            MealPlan.is_template == False
        ).first()

    if not source_plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No se encontró el menú semanal para guardar como plantilla")

    ref_start = date(2000, 1, 3)  # Lunes base de referencia
    template = MealPlan(
        household_id=household.id,
        title=req.title.strip() if req.title.strip() else f"Plantilla {source_plan.title}",
        start_date=ref_start,
        end_date=ref_start + timedelta(days=6),
        is_template=True,
        created_by_id=current_user.id
    )
    db.add(template)
    db.flush()

    for s in source_plan.slots:
        offset_days = (s.slot_date - source_plan.start_date).days % 7
        tpl_slot_date = ref_start + timedelta(days=offset_days)
        new_slot = MealSlot(
            meal_plan_id=template.id,
            slot_date=tpl_slot_date,
            meal_type=s.meal_type,
            servings=s.servings,
            notes=s.notes
        )
        db.add(new_slot)
        db.flush()
        for p in s.planned_recipes:
            db.add(PlannedRecipe(
                meal_slot_id=new_slot.id,
                recipe_id=p.recipe_id,
                custom_recipe_name=p.custom_recipe_name,
                custom_calories=p.custom_calories,
                servings=p.servings
            ))

    db.commit()
    db.refresh(template)
    return _format_plan_response(template, db)


@router.post("/apply-template", response_model=MealPlanResponse)
def apply_meal_plan_template(
    req: ApplyTemplateRequest,
    household: Household = Depends(get_current_household),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    template = db.query(MealPlan).filter(
        MealPlan.id == req.template_id,
        MealPlan.household_id == household.id,
        MealPlan.is_template == True
    ).first()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plantilla no encontrada")

    target_start = req.target_start_date
    target_end = target_start + timedelta(days=6)

    target_plan = db.query(MealPlan).filter(
        MealPlan.household_id == household.id,
        MealPlan.start_date == target_start,
        MealPlan.end_date == target_end,
        MealPlan.is_template == False
    ).first()

    if not target_plan:
        target_plan = MealPlan(
            household_id=household.id,
            title=f"Semana ({target_start.strftime('%d/%m')} - {target_end.strftime('%d/%m')})",
            start_date=target_start,
            end_date=target_end,
            is_template=False,
            created_by_id=current_user.id
        )
        db.add(target_plan)
        db.flush()

    if req.mode == "replace":
        db.query(MealSlot).filter(MealSlot.meal_plan_id == target_plan.id).delete()
        db.flush()

    for s in template.slots:
        offset_days = (s.slot_date - template.start_date).days % 7
        actual_date = target_start + timedelta(days=offset_days)
        slot = db.query(MealSlot).filter(
            MealSlot.meal_plan_id == target_plan.id,
            MealSlot.slot_date == actual_date,
            MealSlot.meal_type == s.meal_type
        ).first()

        if not slot:
            slot = MealSlot(
                meal_plan_id=target_plan.id,
                slot_date=actual_date,
                meal_type=s.meal_type,
                servings=s.servings,
                notes=s.notes
            )
            db.add(slot)
            db.flush()

        for p in s.planned_recipes:
            db.add(PlannedRecipe(
                meal_slot_id=slot.id,
                recipe_id=p.recipe_id,
                custom_recipe_name=p.custom_recipe_name,
                custom_calories=p.custom_calories,
                servings=p.servings
            ))

    db.commit()
    db.refresh(target_plan)
    return _format_plan_response(target_plan, db)


@router.post("/copy-week", response_model=MealPlanResponse)
def copy_week_meal_plan(
    req: CopyWeekRequest,
    household: Household = Depends(get_current_household),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    source_plan = db.query(MealPlan).filter(
        MealPlan.household_id == household.id,
        MealPlan.start_date <= req.source_start_date,
        MealPlan.end_date >= req.source_start_date,
        MealPlan.is_template == False
    ).first()
    if not source_plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No se encontró el menú de la semana origen")

    target_start = req.target_start_date
    target_end = target_start + timedelta(days=6)

    target_plan = db.query(MealPlan).filter(
        MealPlan.household_id == household.id,
        MealPlan.start_date == target_start,
        MealPlan.end_date == target_end,
        MealPlan.is_template == False
    ).first()

    if not target_plan:
        target_plan = MealPlan(
            household_id=household.id,
            title=f"Semana ({target_start.strftime('%d/%m')} - {target_end.strftime('%d/%m')})",
            start_date=target_start,
            end_date=target_end,
            is_template=False,
            created_by_id=current_user.id
        )
        db.add(target_plan)
        db.flush()

    if req.mode == "replace":
        db.query(MealSlot).filter(MealSlot.meal_plan_id == target_plan.id).delete()
        db.flush()

    for s in source_plan.slots:
        offset_days = (s.slot_date - source_plan.start_date).days % 7
        actual_date = target_start + timedelta(days=offset_days)
        slot = db.query(MealSlot).filter(
            MealSlot.meal_plan_id == target_plan.id,
            MealSlot.slot_date == actual_date,
            MealSlot.meal_type == s.meal_type
        ).first()

        if not slot:
            slot = MealSlot(
                meal_plan_id=target_plan.id,
                slot_date=actual_date,
                meal_type=s.meal_type,
                servings=s.servings,
                notes=s.notes
            )
            db.add(slot)
            db.flush()

        for p in s.planned_recipes:
            db.add(PlannedRecipe(
                meal_slot_id=slot.id,
                recipe_id=p.recipe_id,
                custom_recipe_name=p.custom_recipe_name,
                custom_calories=p.custom_calories,
                servings=p.servings
            ))

    db.commit()
    db.refresh(target_plan)
    return _format_plan_response(target_plan, db)


@router.delete("/templates/{template_id}")
def delete_meal_plan_template(
    template_id: int,
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    template = db.query(MealPlan).filter(
        MealPlan.id == template_id,
        MealPlan.household_id == household.id,
        MealPlan.is_template == True
    ).first()
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plantilla no encontrada")

    db.delete(template)
    db.commit()
    return {"success": True, "message": "Plantilla eliminada correctamente"}


@router.post("/generate-ai")
def generate_ai_menu(
    req: AiMenuGenerateRequest,
    household: Household = Depends(get_current_household),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Fetch approved recipes (public or owned by user)
    recipes = db.query(Recipe).filter(
        Recipe.review_status == "approved",
        or_(Recipe.is_private == False, Recipe.created_by_id == current_user.id)
    ).limit(30).all()
    recipes_data = [{"id": r.id, "title": r.title, "dish_type": r.dish_type, "nutrition_calories": r.nutrition_calories} for r in recipes]

    # Gather diners restrictions
    restrictions = []
    for diner in household.diners:
        for r in diner.restrictions:
            restrictions.append(f"{diner.name}: {r.restriction_type} ({r.details})")

    # Gather user nutrition profile & habits
    nut_profile = db.query(NutritionProfile).filter(NutritionProfile.user_id == current_user.id).first()

    prefs = {
        "focus_healthy": req.focus_healthy,
        "quick_meals_only": req.quick_meals_only,
        "use_pantry_items": req.use_pantry_items,
        "appliances": req.appliances,
        "restrictions": restrictions,
        "dietary_goals": nut_profile.dietary_goals if nut_profile else None,
        "cooking_habits": nut_profile.cooking_habits if nut_profile else None,
        "preferred_foods": nut_profile.preferred_foods if nut_profile else None,
        "excluded_foods": nut_profile.excluded_foods if nut_profile else None,
        "available_time_min": nut_profile.available_time_min if nut_profile else 45,
        "notes": nut_profile.notes if nut_profile else None
    }

    proposals = gemini_service.generate_meal_plan_suggestions(recipes_data, prefs)

    # Check if a meal plan already exists for this household and this date range
    plan = db.query(MealPlan).filter(
        MealPlan.household_id == household.id,
        MealPlan.start_date == req.start_date,
        MealPlan.end_date == req.end_date
    ).first()

    if plan:
        # Clear existing slots to regenerate cleanly
        db.query(MealSlot).filter(MealSlot.meal_plan_id == plan.id).delete()
        db.flush()
    else:
        plan = MealPlan(
            household_id=household.id,
            title=f"Menú Inteligente ({req.start_date.strftime('%d/%m')} - {req.end_date.strftime('%d/%m')})",
            start_date=req.start_date,
            end_date=req.end_date,
            is_template=False
        )
        db.add(plan)
        db.flush()

    day_map = {
        "lunes": 0, "dia 1": 0, "1": 0, "monday": 0,
        "martes": 1, "dia 2": 1, "2": 1, "tuesday": 1,
        "miercoles": 2, "miércoles": 2, "dia 3": 2, "3": 2, "wednesday": 2,
        "jueves": 3, "dia 4": 3, "4": 3, "thursday": 3,
        "viernes": 4, "dia 5": 4, "5": 4, "friday": 4,
        "sabado": 5, "sábado": 5, "dia 6": 5, "6": 5, "saturday": 5,
        "domingo": 6, "dia 7": 6, "7": 6, "sunday": 6,
    }

    curr_fallback_date = req.start_date
    for prop in proposals:
        day_raw = str(prop.get("day", "")).strip().lower()
        offset = day_map.get(day_raw)
        if offset is not None and 0 <= offset <= 6:
            slot_date = req.start_date + timedelta(days=offset)
        else:
            slot_date = curr_fallback_date

        meal_raw = str(prop.get("meal_type", "comida")).strip().lower()
        if meal_raw in ["media mañana", "mediamanana", "almuerzo", "midmorning"]:
            meal_type = "almuerzo"
        elif meal_raw in ["desayuno", "breakfast"]:
            meal_type = "desayuno"
        elif meal_raw in ["comida", "almuerzo_mediodia", "lunch"]:
            meal_type = "comida"
        elif meal_raw in ["merienda", "snack_tarde", "afternoon_snack"]:
            meal_type = "merienda"
        elif meal_raw in ["cena", "dinner"]:
            meal_type = "cena"
        elif meal_raw in ["snack", "snacks", "fruta"]:
            meal_type = "snacks"
        else:
            meal_type = "comida"

        if meal_type == "cena" and offset is None:
            curr_fallback_date = min(req.end_date, curr_fallback_date + timedelta(days=1))

        # Check if slot already exists for that date and meal_type
        slot = db.query(MealSlot).filter(
            MealSlot.meal_plan_id == plan.id,
            MealSlot.slot_date == slot_date,
            MealSlot.meal_type == meal_type
        ).first()

        if not slot:
            slot = MealSlot(
                meal_plan_id=plan.id,
                slot_date=slot_date,
                meal_type=meal_type,
                servings=4
            )
            db.add(slot)
            db.flush()

        planned = PlannedRecipe(
            meal_slot_id=slot.id,
            recipe_id=prop.get("recipe_id"),
            custom_recipe_name=prop.get("title") if not prop.get("recipe_id") else None,
            custom_calories=float(prop["calories"]) if prop.get("calories") is not None else None,
            servings=4
        )
        db.add(planned)

    db.commit()
    db.refresh(plan)
    return {"message": "Menú semanal sugerido con éxito", "meal_plan_id": plan.id}


DAY_OFFSETS = {
    "lunes": 0, "dia 1": 0, "1": 0,
    "martes": 1, "dia 2": 1, "2": 1,
    "miercoles": 2, "miércoles": 2, "dia 3": 2, "3": 2,
    "jueves": 3, "dia 4": 3, "4": 3,
    "viernes": 4, "dia 5": 4, "5": 4,
    "sabado": 5, "sábado": 5, "dia 6": 5, "6": 5,
    "domingo": 6, "dia 7": 6, "7": 6,
}

VALID_MEAL_TYPES = ["desayuno", "almuerzo", "comida", "merienda", "cena", "snacks"]


@router.post("/import-nutrition-image", response_model=NutritionPlanParsedResponse)
async def import_nutrition_image(
    file: UploadFile = File(...),
    start_date: Optional[str] = Form(None),
    household: Household = Depends(get_current_household),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Parses a photo, screenshot or PDF of a weekly nutrition plan/diet sheet.
    Uses Gemini Vision (gemini-3.8-flash) to extract structured days and meals.
    Matches extracted meals against existing recipes in the user's cookbook.
    """
    content = await file.read()
    if not content or len(content) < 10:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Archivo vacío o no válido")

    mime_type = file.content_type or "image/jpeg"
    if "pdf" in file.filename.lower() or "pdf" in mime_type.lower():
        mime_type = "application/pdf"
    elif "png" in file.filename.lower():
        mime_type = "image/png"
    elif "webp" in file.filename.lower():
        mime_type = "image/webp"

    parsed_raw = gemini_service.extract_nutrition_plan_from_image(content, mime_type)

    # Determine baseline Monday
    if start_date:
        try:
            monday = datetime.strptime(start_date, "%Y-%m-%d").date()
        except ValueError:
            today = date.today()
            monday = today - timedelta(days=today.weekday())
    else:
        today = date.today()
        monday = today - timedelta(days=today.weekday())

    # Pre-fetch existing approved recipes for matching (public or owned by user)
    all_recipes = db.query(Recipe).filter(
        Recipe.review_status == "approved",
        or_(Recipe.is_private == False, Recipe.created_by_id == current_user.id)
    ).all()

    clean_days: List[NutritionPlanDay] = []
    days_data = parsed_raw.get("days", [])

    for idx, d_data in enumerate(days_data):
        d_name_raw = str(d_data.get("day_name", "")).strip().lower()
        offset = DAY_OFFSETS.get(d_name_raw, idx if idx < 7 else 6)
        day_date = monday + timedelta(days=offset)
        std_day_name = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"][offset]

        meals_list: List[NutritionPlanMeal] = []
        for m_data in d_data.get("meals", []):
            m_type = str(m_data.get("meal_type", "comida")).strip().lower()
            if m_type not in VALID_MEAL_TYPES:
                if "desay" in m_type:
                    m_type = "desayuno"
                elif "merien" in m_type:
                    m_type = "merienda"
                elif "cena" in m_type:
                    m_type = "cena"
                elif "almuer" in m_type or "media" in m_type:
                    m_type = "almuerzo"
                elif "snack" in m_type or "pico" in m_type:
                    m_type = "snacks"
                else:
                    m_type = "comida"

            title = str(m_data.get("title", "")).strip()
            if not title:
                continue

            cal = m_data.get("calories")
            cal_val = float(cal) if cal is not None and str(cal).replace('.', '', 1).isdigit() else None
            is_rec = bool(m_data.get("is_recipe", False))

            # Match against existing recipes
            matched_recipe = None
            for r in all_recipes:
                if r.title.strip().lower() == title.lower():
                    matched_recipe = r
                    break
            if not matched_recipe:
                for r in all_recipes:
                    if len(r.title) > 4 and (r.title.lower() in title.lower() or title.lower() in r.title.lower()):
                        matched_recipe = r
                        break

            recipe_id = matched_recipe.id if matched_recipe else None
            matched_title = matched_recipe.title if matched_recipe else None
            is_existing = bool(matched_recipe)
            if is_existing:
                is_rec = True

            ingredients_list = []
            for ing in m_data.get("ingredients", []):
                if isinstance(ing, dict) and ing.get("name"):
                    amt = ing.get("amount")
                    ingredients_list.append(NutritionPlanIngredient(
                        name=str(ing["name"]).strip(),
                        amount=float(amt) if amt is not None and str(amt).replace('.', '', 1).isdigit() else None,
                        unit=str(ing.get("unit")) if ing.get("unit") else None
                    ))

            steps_list = []
            for s_idx, st in enumerate(m_data.get("steps", [])):
                if isinstance(st, dict) and st.get("instruction"):
                    steps_list.append(NutritionPlanStep(
                        step_number=int(st.get("step_number", s_idx + 1)),
                        instruction=str(st["instruction"]).strip()
                    ))

            meals_list.append(NutritionPlanMeal(
                meal_type=m_type,
                title=title,
                calories=cal_val,
                is_recipe=is_rec,
                recipe_id=recipe_id,
                matched_recipe_title=matched_title,
                is_existing=is_existing,
                description=m_data.get("description"),
                ingredients=ingredients_list,
                steps=steps_list
            ))

        clean_days.append(NutritionPlanDay(
            day_name=std_day_name,
            date=day_date,
            meals=meals_list
        ))

    return NutritionPlanParsedResponse(
        plan_title=parsed_raw.get("plan_title", "Plan Nutricional Extraído"),
        patient_name=parsed_raw.get("patient_name"),
        target_calories=parsed_raw.get("target_calories"),
        dietary_goal=parsed_raw.get("dietary_goal"),
        habits=parsed_raw.get("habits"),
        dietary_guidelines=parsed_raw.get("dietary_guidelines") or [],
        preferred_foods=parsed_raw.get("preferred_foods"),
        excluded_foods=parsed_raw.get("excluded_foods"),
        notes=parsed_raw.get("notes"),
        days=clean_days
    )


@router.post("/apply-imported-nutrition-plan")
def apply_imported_nutrition_plan(
    req: ApplyNutritionPlanRequest,
    household: Household = Depends(get_current_household),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Applies an imported and reviewed nutrition plan to the specified week.
    Optionally updates the target diner's nutritional profile and habits with dietitian advice.
    Scales recipe servings and quantities for household cohabitants (household_servings).
    Populates the weekly MealPlan, MealSlots, and PlannedRecipes.
    """
    start_date = req.start_date
    end_date = start_date + timedelta(days=6)
    household_servings = max(1, req.household_servings or 2)

    # 1. Update Diner / NutritionProfile if requested
    if req.update_diner_profile:
        try:
            from app.models.household import Diner
            diner = None
            if req.target_diner_id:
                diner = db.query(Diner).filter(Diner.id == req.target_diner_id, Diner.household_id == household.id).first()
            elif req.patient_name:
                diner = db.query(Diner).filter(
                    Diner.household_id == household.id,
                    Diner.name.ilike(f"%{req.patient_name.strip()}%")
                ).first()

            if diner:
                if req.target_calories:
                    diner.target_calories = req.target_calories
                if req.dietary_goal:
                    diner.dietary_goal = req.dietary_goal
                if req.habits or req.notes:
                    extra = f"\n[Pautas Dietista]: {req.habits or ''} {req.notes or ''}".strip()
                    diner.notes = ((diner.notes or "") + "\n" + extra).strip()

            # Also update current user NutritionProfile
            nut_prof = db.query(NutritionProfile).filter(NutritionProfile.user_id == current_user.id).first()
            if not nut_prof:
                nut_prof = NutritionProfile(user_id=current_user.id)
                db.add(nut_prof)
            if req.target_calories:
                nut_prof.target_calories = req.target_calories
            if req.dietary_goal:
                nut_prof.dietary_goal = req.dietary_goal
            if req.habits:
                nut_prof.cooking_habits = req.habits
            if req.preferred_foods:
                nut_prof.preferred_foods = req.preferred_foods
            if req.excluded_foods:
                nut_prof.excluded_foods = req.excluded_foods
            if req.notes:
                nut_prof.notes = ((nut_prof.notes or "") + f"\n[Pautas Dietista]: {req.notes}").strip()
        except Exception as e:
            logger.warning(f"Could not update nutrition profile or diner: {e}")

    # 2. Check if a meal plan already exists for this week or create one
    plan = db.query(MealPlan).filter(
        MealPlan.household_id == household.id,
        MealPlan.start_date == start_date
    ).first()

    if not plan:
        plan_title = req.plan_title or f"Plan Nutricional ({start_date.strftime('%d/%m')} - {end_date.strftime('%d/%m')})"
        plan = MealPlan(
            household_id=household.id,
            title=plan_title,
            start_date=start_date,
            end_date=end_date,
            is_template=False
        )
        db.add(plan)
        db.flush()

    recipes_created_count = 0
    created_recipes_cache = {}

    for d in req.days:
        slot_date = d.date or start_date
        for m in d.meals:
            final_recipe_id = m.recipe_id

            # Create recipe if requested and missing
            if req.create_missing_recipes and m.is_recipe and not final_recipe_id:
                clean_title = m.title.strip()
                if clean_title in created_recipes_cache:
                    final_recipe_id = created_recipes_cache[clean_title]
                else:
                    dish_type = "Plato Principal" if m.meal_type in ["comida", "cena"] else "Desayuno / Snack"
                    # Search image matching recipe title with AI
                    img_url = gemini_service.generate_or_find_recipe_image(clean_title, dish_type)

                    # AI review: tips and nutrition estimation
                    ing_names = [ing.name for ing in m.ingredients]
                    tips = gemini_service.suggest_recipe_tips(clean_title, ing_names, dish_type)
                    ing_lines = [f"{ing.amount or ''} {ing.unit or ''} {ing.name}".strip() for ing in m.ingredients]
                    nut = gemini_service.estimate_recipe_nutrition(clean_title, ing_lines, base_servings=household_servings, dish_type=dish_type)

                    new_rec = Recipe(
                        title=clean_title,
                        description=m.description or f"Receta importada del plan nutricional ({m.meal_type}) adaptada para {household_servings} raciones.",
                        main_image_url=img_url,
                        prep_time_min=10,
                        cook_time_min=20,
                        total_time_min=30,
                        difficulty="facil",
                        base_servings=household_servings,
                        nutrition_calories=m.calories or (nut.get("calories") if nut else None),
                        nutrition_protein=nut.get("protein") if nut else None,
                        nutrition_carbs=nut.get("carbs") if nut else None,
                        nutrition_fat=nut.get("fat") if nut else None,
                        chef_notes=tips.get("chef_notes"),
                        preservation_tips=tips.get("preservation_tips"),
                        freezing_tips=tips.get("freezing_tips"),
                        reheating_tips=tips.get("reheating_tips"),
                        categories=json.dumps(["Comidas", "Plan Nutricional"], ensure_ascii=False),
                        tags=json.dumps(["saludable", "plan_nutricional", "dietista", "importado_ia"], ensure_ascii=False),
                        dish_type=dish_type,
                        meal_type="desayuno" if m.meal_type == "desayuno" else ("comida_cena" if m.meal_type in ["comida", "cena"] else "almuerzo_merienda"),
                        source_type="plan_nutricional_ia",
                        review_status="approved",
                        is_private=True,
                        created_by_id=current_user.id
                    )
                    db.add(new_rec)
                    db.flush()

                    # Add traditional variant
                    variant = RecipeVariant(
                        recipe_id=new_rec.id,
                        variant_type="traditional",
                        title=f"Preparación para {household_servings} raciones",
                        is_default=True
                    )
                    db.add(variant)
                    db.flush()

                    # Add ingredients scaled to household servings
                    for idx, ing in enumerate(m.ingredients):
                        scaled_amount = None
                        if ing.amount is not None:
                            scaled_amount = round(float(ing.amount) * household_servings, 2)
                        db.add(RecipeIngredient(
                            variant_id=variant.id,
                            name=ing.name,
                            amount=scaled_amount,
                            unit=ing.unit,
                            order_index=idx
                        ))

                    # Add steps
                    if m.steps:
                        for st in m.steps:
                            db.add(RecipeStep(
                                variant_id=variant.id,
                                step_number=st.step_number,
                                instruction=st.instruction
                            ))
                    else:
                        db.add(RecipeStep(
                            variant_id=variant.id,
                            step_number=1,
                            instruction=f"Preparar los ingredientes adaptados para {household_servings} raciones y cocinar siguiendo pautas saludables a la plancha, al vapor o al horno."
                        ))

                    db.flush()
                    final_recipe_id = new_rec.id
                    created_recipes_cache[clean_title] = new_rec.id
                    recipes_created_count += 1

            # Find or create slot
            slot = db.query(MealSlot).filter(
                MealSlot.meal_plan_id == plan.id,
                MealSlot.slot_date == slot_date,
                MealSlot.meal_type == m.meal_type
            ).first()

            if not slot:
                slot = MealSlot(
                    meal_plan_id=plan.id,
                    slot_date=slot_date,
                    meal_type=m.meal_type,
                    servings=household_servings
                )
                db.add(slot)
                db.flush()

            # Add planned recipe
            planned = PlannedRecipe(
                meal_slot_id=slot.id,
                recipe_id=final_recipe_id,
                custom_recipe_name=m.title if not final_recipe_id else None,
                custom_calories=m.calories,
                servings=household_servings
            )
            db.add(planned)

    # 3. Create or update DietitianReport entity so it's always accessible in /nutrition and Home
    new_report_id = None
    try:
        # Mark previous active reports as inactive for this household
        db.query(DietitianReport).filter(
            DietitianReport.household_id == household.id,
            DietitianReport.is_active == True
        ).update({"is_active": False})

        # Collect all recipe IDs linked/created
        all_linked_recipe_ids = list(set(
            [m.recipe_id for d in req.days for m in d.meals if m.recipe_id] +
            list(created_recipes_cache.values())
        ))

        raw_days = [d.model_dump() for d in req.days]

        report = DietitianReport(
            household_id=household.id,
            user_id=current_user.id,
            diner_id=req.target_diner_id,
            title=req.plan_title or f"Informe Nutricional ({start_date.strftime('%d/%m/%Y')})",
            patient_name=req.patient_name,
            target_calories=req.target_calories,
            dietary_goal=req.dietary_goal,
            habits=req.habits,
            dietary_guidelines=json.dumps(req.dietary_guidelines or [], ensure_ascii=False),
            preferred_foods=req.preferred_foods,
            excluded_foods=req.excluded_foods,
            notes=req.notes,
            raw_plan_data=json.dumps(raw_days, ensure_ascii=False, default=str),
            created_recipes_ids=json.dumps(all_linked_recipe_ids, ensure_ascii=False),
            household_servings=household_servings,
            is_active=True
        )
        db.add(report)
        db.flush()
        new_report_id = report.id
    except Exception as e:
        logger.error(f"Error saving DietitianReport: {e}")

    db.commit()
    db.refresh(plan)

    return {
        "message": f"Plan nutricional aplicado con éxito. Se planificaron {len(req.days)} días adaptados para {household_servings} raciones.",
        "meal_plan_id": plan.id,
        "recipes_created": recipes_created_count,
        "report_id": new_report_id
    }


# Leftovers endpoints
@router.get("/leftovers", response_model=List[LeftoverResponse])
def get_leftovers(
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    leftovers = db.query(Leftover).filter(
        Leftover.household_id == household.id,
        Leftover.is_consumed == False
    ).all()
    return leftovers


@router.post("/leftovers", response_model=LeftoverResponse)
def add_leftover(
    req: LeftoverCreate,
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    lo = Leftover(
        household_id=household.id,
        name=req.name,
        recipe_id=req.recipe_id,
        portions=req.portions,
        location=req.location,
        expiry_date=req.expiry_date,
        notes=req.notes
    )
    db.add(lo)
    db.commit()
    db.refresh(lo)
    return lo


@router.put("/leftovers/{leftover_id}/consume")
def consume_leftover(
    leftover_id: int,
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    lo = db.query(Leftover).filter(Leftover.id == leftover_id, Leftover.household_id == household.id).first()
    if not lo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sobra no encontrada")
    lo.is_consumed = True
    db.commit()
    return {"message": "Sobra marcada como consumida"}
