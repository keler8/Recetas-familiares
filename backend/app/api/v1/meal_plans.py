from datetime import datetime, date, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.auth import User
from app.models.household import Household
from app.models.recipe import Recipe
from app.models.meal_plan import MealPlan, MealSlot, PlannedRecipe, Leftover
from app.models.nutrition import NutritionProfile
from app.schemas.meal_plan import (
    MealPlanCreate, MealPlanResponse, AddRecipeToSlotRequest,
    AiMenuGenerateRequest, LeftoverCreate, LeftoverResponse
)
from app.api.deps import get_current_user, get_current_household
from app.services.gemini_service import gemini_service

router = APIRouter(prefix="/meal-plans", tags=["Planificador de Menús"])


@router.get("", response_model=List[MealPlanResponse])
def list_meal_plans(
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    plans = db.query(MealPlan).filter(MealPlan.household_id == household.id).order_by(MealPlan.start_date.desc()).all()
    return plans


@router.post("", response_model=MealPlanResponse)
def create_meal_plan(
    plan_in: MealPlanCreate,
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
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
    return plan


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
        servings=req.servings
    )
    db.add(planned)
    db.commit()
    return {"message": "Receta añadida al plan de comidas"}


@router.post("/generate-ai")
def generate_ai_menu(
    req: AiMenuGenerateRequest,
    household: Household = Depends(get_current_household),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Fetch approved recipes
    recipes = db.query(Recipe).filter(Recipe.review_status == "approved").limit(30).all()
    recipes_data = [{"id": r.id, "title": r.title, "dish_type": r.dish_type} for r in recipes]

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

    # Create a draft meal plan for review
    plan = MealPlan(
        household_id=household.id,
        title=f"Menú Inteligente ({req.start_date.strftime('%d/%m')} - {req.end_date.strftime('%d/%m')})",
        start_date=req.start_date,
        end_date=req.end_date,
        is_template=False
    )
    db.add(plan)
    db.flush()

    curr_date = req.start_date
    for prop in proposals:
        slot = MealSlot(
            meal_plan_id=plan.id,
            slot_date=curr_date,
            meal_type=prop.get("meal_type", "comida"),
            servings=4
        )
        db.add(slot)
        db.flush()

        planned = PlannedRecipe(
            meal_slot_id=slot.id,
            recipe_id=prop.get("recipe_id"),
            custom_recipe_name=prop.get("title") if not prop.get("recipe_id") else None,
            servings=4
        )
        db.add(planned)

        if prop.get("meal_type") == "cena":
            curr_date += timedelta(days=1)
            if curr_date > req.end_date:
                break

    db.commit()
    db.refresh(plan)
    return {"message": "Menú semanal sugerido con éxito", "meal_plan_id": plan.id}


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
