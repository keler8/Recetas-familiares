import json
from datetime import datetime, date, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.auth import User
from app.models.household import Household
from app.models.recipe import Recipe, RecipeVariant, RecipeIngredient, RecipeStep
from app.models.meal_plan import MealPlan, MealSlot, PlannedRecipe, Leftover
from app.models.nutrition import NutritionProfile
from app.schemas.meal_plan import (
    MealPlanCreate, MealPlanResponse, AddRecipeToSlotRequest,
    AiMenuGenerateRequest, LeftoverCreate, LeftoverResponse,
    NutritionPlanParsedResponse, ApplyNutritionPlanRequest,
    NutritionPlanDay, NutritionPlanMeal, NutritionPlanIngredient, NutritionPlanStep
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
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    plans = db.query(MealPlan).filter(MealPlan.household_id == household.id).order_by(MealPlan.start_date.desc()).all()
    return [_format_plan_response(p, db) for p in plans]


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
            custom_calories=float(prop["calories"]) if prop.get("calories") is not None else None,
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

    # Pre-fetch existing approved recipes for matching
    all_recipes = db.query(Recipe).filter(Recipe.review_status == "approved").all()

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
    Optionally creates missing recipes automatically into the user's cookbook.
    Populates the weekly MealPlan, MealSlots, and PlannedRecipes.
    """
    start_date = req.start_date
    end_date = start_date + timedelta(days=6)

    # Check if a meal plan already exists for this week or create one
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
                    new_rec = Recipe(
                        title=clean_title,
                        description=m.description or f"Receta importada del plan nutricional ({m.meal_type})",
                        prep_time_min=10,
                        cook_time_min=20,
                        total_time_min=30,
                        difficulty="facil",
                        base_servings=4,
                        nutrition_calories=m.calories,
                        categories=json.dumps(["Comidas", "Plan Nutricional"], ensure_ascii=False),
                        tags=json.dumps(["saludable", "plan_nutricional", "importado_ia"], ensure_ascii=False),
                        dish_type="Plato Principal" if m.meal_type in ["comida", "cena"] else "Desayuno / Snack",
                        meal_type="desayuno" if m.meal_type == "desayuno" else ("comida_cena" if m.meal_type in ["comida", "cena"] else "almuerzo_merienda"),
                        source_type="plan_nutricional_ia",
                        review_status="approved",
                        created_by_id=current_user.id
                    )
                    db.add(new_rec)
                    db.flush()

                    # Add traditional variant
                    variant = RecipeVariant(
                        recipe_id=new_rec.id,
                        variant_type="traditional",
                        title="Preparación recomendada",
                        is_default=True
                    )
                    db.add(variant)
                    db.flush()

                    # Add ingredients
                    for idx, ing in enumerate(m.ingredients):
                        db.add(RecipeIngredient(
                            variant_id=variant.id,
                            name=ing.name,
                            amount=ing.amount,
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
                            instruction=f"Preparar los ingredientes y cocinar siguiendo pautas saludables a la plancha, al vapor o al horno."
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
                    servings=4
                )
                db.add(slot)
                db.flush()

            # Add planned recipe
            planned = PlannedRecipe(
                meal_slot_id=slot.id,
                recipe_id=final_recipe_id,
                custom_recipe_name=m.title if not final_recipe_id else None,
                custom_calories=m.calories,
                servings=4
            )
            db.add(planned)

    db.commit()
    db.refresh(plan)

    return {
        "message": f"Plan nutricional aplicado con éxito. Se planificaron {len(req.days)} días.",
        "meal_plan_id": plan.id,
        "recipes_created": recipes_created_count
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
