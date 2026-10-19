import json
import random
from datetime import datetime, date, timedelta
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.auth import User
from app.models.household import Household
from app.models.recipe import Recipe, RecipeVariant, RecipeIngredient, RecipeStep
from app.models.meal_plan import MealPlan, MealSlot, PlannedRecipe
from app.models.nutrition import NutritionProfile, NutritionConsent, DietitianReport
from app.schemas.nutrition import (
    NutritionProfileResponse, NutritionProfileUpdate,
    NutritionConsentRequest, NutritionAdviceRequest,
    DietitianReportResponse, DietitianReportUpdate,
    ApplyReportToWeekRequest, DietitianReportWeek,
    ReportVersionUpdateRequest
)
from app.api.deps import get_current_user, get_current_household
from app.services.gemini_service import gemini_service

router = APIRouter(prefix="/nutrition", tags=["Mi Alimentación Saludable"])


def _compute_profile_metrics(profile: NutritionProfile):
    bmr = None
    target_cals = profile.target_calories
    
    if profile.weight_kg and profile.height_cm and profile.age and profile.sex:
        if str(profile.sex).lower() in ["hombre", "male", "m"]:
            bmr = round(10.0 * float(profile.weight_kg) + 6.25 * float(profile.height_cm) - 5.0 * int(profile.age) + 5.0)
        else:
            bmr = round(10.0 * float(profile.weight_kg) + 6.25 * float(profile.height_cm) - 5.0 * int(profile.age) - 161.0)
        
        if not target_cals:
            act = str(profile.physical_activity or "").lower()
            if any(k in act for k in ["intenso", "alta", "deportista", "atleta"]):
                mult = 1.725
            elif "moderad" in act:
                mult = 1.55
            elif "liger" in act:
                mult = 1.375
            else:
                mult = 1.2
            
            tdee = bmr * mult
            g = str(profile.dietary_goal or "").lower()
            if any(k in g for k in ["deficit", "perder", "grasa", "peso"]):
                adj = -400
            elif any(k in g for k in ["superavit", "ganar", "volumen", "musculo"]):
                adj = 300
            else:
                adj = 0
            
            target_cals = int(round(tdee + adj + (profile.calorie_offset or 0)))

    # Compute daily distribution based on target_cals (default to 2000 if not set yet)
    effective_cals = target_cals or 2000
    breakdown = {
        "desayuno": int(round(effective_cals * 0.20)),
        "almuerzo": int(round(effective_cals * 0.10)),
        "comida": int(round(effective_cals * 0.35)),
        "merienda": int(round(effective_cals * 0.10)),
        "cena": int(round(effective_cals * 0.25))
    }
    return bmr, target_cals, breakdown


@router.get("/profile", response_model=NutritionProfileResponse)
def get_nutrition_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    profile = db.query(NutritionProfile).filter(NutritionProfile.user_id == current_user.id).first()
    if not profile:
        profile = NutritionProfile(user_id=current_user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)

    consent = db.query(NutritionConsent).filter(
        NutritionConsent.user_id == current_user.id,
        NutritionConsent.ai_data_consent == True
    ).first()

    bmr, target_cals, breakdown = _compute_profile_metrics(profile)

    resp = NutritionProfileResponse.model_validate(profile)
    resp.has_ai_consent = consent is not None
    resp.calculated_bmr = bmr
    resp.target_calories = target_cals
    resp.daily_meal_breakdown = breakdown
    return resp


@router.put("/profile", response_model=NutritionProfileResponse)
def update_nutrition_profile(
    prof_up: NutritionProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    profile = db.query(NutritionProfile).filter(NutritionProfile.user_id == current_user.id).first()
    if not profile:
        profile = NutritionProfile(user_id=current_user.id)
        db.add(profile)

    if prof_up.dietary_goals is not None:
        profile.dietary_goals = prof_up.dietary_goals
    if prof_up.cooking_habits is not None:
        profile.cooking_habits = prof_up.cooking_habits
    if prof_up.available_time_min is not None:
        profile.available_time_min = prof_up.available_time_min
    if prof_up.meal_frequency is not None:
        profile.meal_frequency = prof_up.meal_frequency
    if prof_up.physical_activity is not None:
        profile.physical_activity = prof_up.physical_activity
    if prof_up.sex is not None:
        profile.sex = prof_up.sex
    if prof_up.age is not None:
        profile.age = prof_up.age
    if prof_up.weight_kg is not None:
        profile.weight_kg = prof_up.weight_kg
    if prof_up.height_cm is not None:
        profile.height_cm = prof_up.height_cm
    if prof_up.dietary_goal is not None:
        profile.dietary_goal = prof_up.dietary_goal
    if prof_up.target_calories is not None:
        profile.target_calories = prof_up.target_calories
    if prof_up.calorie_offset is not None:
        profile.calorie_offset = prof_up.calorie_offset
    if prof_up.preferred_foods is not None:
        profile.preferred_foods = prof_up.preferred_foods
    if prof_up.excluded_foods is not None:
        profile.excluded_foods = prof_up.excluded_foods
    if prof_up.focus_on_healthy is not None:
        profile.focus_on_healthy = prof_up.focus_on_healthy
    if prof_up.notes is not None:
        profile.notes = prof_up.notes

    profile.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(profile)

    consent = db.query(NutritionConsent).filter(
        NutritionConsent.user_id == current_user.id,
        NutritionConsent.ai_data_consent == True
    ).first()

    bmr, target_cals, breakdown = _compute_profile_metrics(profile)

    resp = NutritionProfileResponse.model_validate(profile)
    resp.has_ai_consent = consent is not None
    resp.calculated_bmr = bmr
    resp.target_calories = target_cals
    resp.daily_meal_breakdown = breakdown
    return resp


@router.post("/consent")
def update_ai_consent(
    req: NutritionConsentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    consent = db.query(NutritionConsent).filter(NutritionConsent.user_id == current_user.id).first()
    if not consent:
        consent = NutritionConsent(
            user_id=current_user.id,
            ai_data_consent=req.consent,
            consent_date=datetime.utcnow()
        )
        db.add(consent)
    else:
        consent.ai_data_consent = req.consent
        if req.consent:
            consent.consent_date = datetime.utcnow()
            consent.revoked_date = None
        else:
            consent.revoked_date = datetime.utcnow()

    db.commit()
    return {
        "ai_data_consent": req.consent,
        "message": "Consentimiento de procesamiento de IA actualizado" if req.consent else "Consentimiento revocado"
    }


@router.post("/advice")
def get_nutrition_advice(
    req: NutritionAdviceRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Acts as an intelligent Dietary and Culinary Assistant.
    Provides healthy dietary recommendations, recipe adaptations and smart swaps.
    """
    profile = db.query(NutritionProfile).filter(NutritionProfile.user_id == current_user.id).first()
    dietary_goals = profile.dietary_goals if profile else "Dieta mediterránea saludable y equilibrada"
    preferred_foods = profile.preferred_foods if profile else None
    excluded_foods = profile.excluded_foods if profile else None

    recipe_data = None
    if req.target_recipe_id:
        rec = db.query(Recipe).filter(Recipe.id == req.target_recipe_id).first()
        if rec:
            recipe_data = {
                "title": rec.title,
                "prep_time_min": rec.prep_time_min,
                "cook_time_min": rec.cook_time_min,
                "ingredients": [
                    {"name": ing.name, "amount": ing.amount, "unit": ing.unit}
                    for v in rec.variants for ing in v.ingredients if v.is_default or len(rec.variants) == 1
                ],
                "steps": [
                    {"step_number": s.step_number, "instruction": s.instruction}
                    for v in rec.variants for s in v.steps if v.is_default or len(rec.variants) == 1
                ]
            }

    result = gemini_service.generate_dietary_advice_and_recipe_modifications(
        dietary_goals=dietary_goals,
        user_query=req.query,
        recipe=recipe_data,
        preferred_foods=preferred_foods,
        excluded_foods=excluded_foods
    )

    return {
        "advice": result.get("advice"),
        "suggested_modifications": result.get("suggested_modifications", []),
        "healthy_recipe_variant": result.get("healthy_recipe_variant"),
        "disclaimer": "Orientación culinaria y nutricional familiar orientativa. No constituye prescripción médica.",
        "disclaimer_acknowledged": True
    }


def _format_report_response(report: DietitianReport, db: Session) -> Dict[str, Any]:
    guidelines = []
    if report.dietary_guidelines:
        try:
            parsed = json.loads(report.dietary_guidelines)
            if isinstance(parsed, list):
                guidelines = [str(x) for x in parsed if str(x).strip()]
            elif isinstance(parsed, str):
                guidelines = [parsed]
        except Exception:
            guidelines = [g.strip() for g in str(report.dietary_guidelines).split("\n") if g.strip()]

    plan_days = []
    weeks_list = []
    if report.raw_plan_data:
        try:
            parsed_raw = json.loads(report.raw_plan_data)
            if isinstance(parsed_raw, list):
                if parsed_raw and isinstance(parsed_raw[0], dict) and "week_number" in parsed_raw[0]:
                    weeks_list = parsed_raw
                    plan_days = parsed_raw[-1].get("days", [])
                else:
                    plan_days = parsed_raw
                    weeks_list = [{
                        "week_number": 1,
                        "week_title": "Semana 1",
                        "days": plan_days
                    }]
        except Exception:
            plan_days = []
            weeks_list = []

    created_recipe_ids = []
    if report.created_recipes_ids:
        try:
            created_recipe_ids = json.loads(report.created_recipes_ids)
        except Exception:
            created_recipe_ids = []

    recipes_list = []
    if created_recipe_ids:
        recs = db.query(Recipe).filter(Recipe.id.in_(created_recipe_ids)).all()
        for r in recs:
            cats = []
            if r.categories:
                try:
                    cats = json.loads(r.categories)
                except Exception:
                    cats = []
            recipes_list.append({
                "id": r.id,
                "title": r.title,
                "image_url": r.image_url,
                "prep_time_min": r.prep_time_min,
                "cook_time_min": r.cook_time_min,
                "nutrition_calories": r.nutrition_calories,
                "difficulty": r.difficulty,
                "dish_type": r.dish_type,
                "categories": cats,
                "is_private": r.is_private
            })

    return {
        "id": report.id,
        "household_id": report.household_id,
        "user_id": report.user_id,
        "diner_id": report.diner_id,
        "title": report.title,
        "version": report.version or 1,
        "patient_name": report.patient_name,
        "target_calories": report.target_calories,
        "dietary_goal": report.dietary_goal,
        "habits": report.habits,
        "dietary_guidelines": guidelines,
        "preferred_foods": report.preferred_foods,
        "excluded_foods": report.excluded_foods,
        "notes": report.notes,
        "raw_plan_data": plan_days,
        "weeks": weeks_list,
        "created_recipes_ids": created_recipe_ids,
        "recipes": recipes_list,
        "household_servings": report.household_servings,
        "is_active": report.is_active,
        "created_at": report.created_at,
        "updated_at": report.updated_at
    }


@router.get("/active-report", response_model=Optional[DietitianReportResponse])
def get_active_dietitian_report(
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """
    Returns the currently active dietitian report for the active household.
    If none is explicitly active, returns the latest uploaded report if any.
    """
    report = db.query(DietitianReport).filter(
        DietitianReport.household_id == household.id,
        DietitianReport.is_active == True
    ).order_by(DietitianReport.created_at.desc()).first()

    if not report:
        report = db.query(DietitianReport).filter(
            DietitianReport.household_id == household.id
        ).order_by(DietitianReport.created_at.desc()).first()

    if not report:
        return None

    return _format_report_response(report, db)


@router.get("/reports", response_model=List[DietitianReportResponse])
def list_dietitian_reports(
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """
    Lists all dietitian reports uploaded in the household.
    """
    reports = db.query(DietitianReport).filter(
        DietitianReport.household_id == household.id
    ).order_by(DietitianReport.created_at.desc()).all()

    return [_format_report_response(r, db) for r in reports]


@router.get("/reports/{report_id}", response_model=DietitianReportResponse)
def get_dietitian_report_by_id(
    report_id: int,
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    report = db.query(DietitianReport).filter(
        DietitianReport.id == report_id,
        DietitianReport.household_id == household.id
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Informe de dietista no encontrado")
    return _format_report_response(report, db)


@router.put("/reports/{report_id}", response_model=DietitianReportResponse)
def update_dietitian_report(
    report_id: int,
    req: DietitianReportUpdate,
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    report = db.query(DietitianReport).filter(
        DietitianReport.id == report_id,
        DietitianReport.household_id == household.id
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Informe de dietista no encontrado")

    if req.title is not None:
        report.title = req.title.strip()
    if req.patient_name is not None:
        report.patient_name = req.patient_name.strip()
    if req.target_calories is not None:
        report.target_calories = req.target_calories
    if req.dietary_goal is not None:
        report.dietary_goal = req.dietary_goal.strip()
    if req.habits is not None:
        report.habits = req.habits.strip()
    if req.dietary_guidelines is not None:
        report.dietary_guidelines = json.dumps(req.dietary_guidelines, ensure_ascii=False)
    if req.preferred_foods is not None:
        report.preferred_foods = req.preferred_foods.strip()
    if req.excluded_foods is not None:
        report.excluded_foods = req.excluded_foods.strip()
    if req.notes is not None:
        report.notes = req.notes.strip()
    if req.is_active is not None:
        if req.is_active:
            db.query(DietitianReport).filter(
                DietitianReport.household_id == household.id,
                DietitianReport.id != report.id
            ).update({"is_active": False})
        report.is_active = req.is_active

    report.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(report)

    return _format_report_response(report, db)


@router.delete("/reports/{report_id}")
def delete_dietitian_report(
    report_id: int,
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    report = db.query(DietitianReport).filter(
        DietitianReport.id == report_id,
        DietitianReport.household_id == household.id
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Informe no encontrado")

    db.delete(report)
    db.commit()
    return {"message": "Informe de dietista eliminado correctamente"}


@router.post("/reports/{report_id}/apply-to-week")
def apply_report_to_week(
    report_id: int,
    req: ApplyReportToWeekRequest,
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """
    Applies the proposed weekly menu from the dietitian report to a chosen calendar week.
    Creates or reuses the MealPlan for that Monday-Sunday week and populates slots.
    """
    report = db.query(DietitianReport).filter(
        DietitianReport.id == report_id,
        DietitianReport.household_id == household.id
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Informe no encontrado")

    try:
        target_date = datetime.strptime(req.target_start_date, "%Y-%m-%d").date()
    except Exception:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido. Utilice AAAA-MM-DD")

    monday = target_date - timedelta(days=target_date.weekday())
    sunday = monday + timedelta(days=6)
    servings = req.household_servings or report.household_servings or 2

    plan = db.query(MealPlan).filter(
        MealPlan.household_id == household.id,
        MealPlan.start_date == monday
    ).first()

    if not plan:
        plan = MealPlan(
            household_id=household.id,
            title=f"{report.title} ({monday.strftime('%d/%m')} - {sunday.strftime('%d/%m')})",
            start_date=monday,
            end_date=sunday,
            is_template=False
        )
        db.add(plan)
        db.flush()

    days_data = []
    if report.raw_plan_data:
        try:
            parsed_raw = json.loads(report.raw_plan_data)
            if isinstance(parsed_raw, list):
                if parsed_raw and isinstance(parsed_raw[0], dict) and "week_number" in parsed_raw[0]:
                    target_w = req.week_number or (parsed_raw[-1].get("week_number", 1))
                    for w in parsed_raw:
                        if w.get("week_number") == target_w:
                            days_data = w.get("days", [])
                            break
                    if not days_data and parsed_raw:
                        days_data = parsed_raw[0].get("days", [])
                else:
                    days_data = parsed_raw
        except Exception:
            days_data = []

    day_offsets = {
        "lunes": 0, "martes": 1, "miercoles": 2, "miércoles": 2,
        "jueves": 3, "viernes": 4, "sabado": 5, "sábado": 5, "domingo": 6
    }

    planned_count = 0
    for idx, d in enumerate(days_data):
        d_name = str(d.get("day_name", "")).strip().lower()
        offset = day_offsets.get(d_name, idx if idx < 7 else 6)
        slot_date = monday + timedelta(days=offset)

        for m in d.get("meals", []):
            m_type = str(m.get("meal_type", "comida")).strip().lower()
            if m_type not in ["desayuno", "almuerzo", "comida", "merienda", "cena", "snacks"]:
                m_type = "comida"

            slot = db.query(MealSlot).filter(
                MealSlot.meal_plan_id == plan.id,
                MealSlot.slot_date == slot_date,
                MealSlot.meal_type == m_type
            ).first()

            if not slot:
                slot = MealSlot(
                    meal_plan_id=plan.id,
                    slot_date=slot_date,
                    meal_type=m_type,
                    servings=servings
                )
                db.add(slot)
                db.flush()

            rec_id = m.get("recipe_id")
            if not rec_id and m.get("title"):
                found_rec = db.query(Recipe).filter(
                    Recipe.title.ilike(f"%{m.get('title').strip()}%"),
                    Recipe.review_status == "approved"
                ).first()
                if found_rec:
                    rec_id = found_rec.id

            planned = PlannedRecipe(
                meal_slot_id=slot.id,
                recipe_id=rec_id,
                custom_recipe_name=m.get("title") if not rec_id else None,
                custom_calories=m.get("calories"),
                servings=servings
            )
            db.add(planned)
            planned_count += 1

    db.commit()
    db.refresh(plan)

    return {
        "message": f"Menú del informe aplicado con éxito para la semana del {monday.strftime('%d/%m/%Y')}.",
        "meal_plan_id": plan.id,
        "start_date": str(monday),
        "end_date": str(sunday),
        "meals_planned": planned_count
    }


@router.post("/reports/{report_id}/update-version", response_model=DietitianReportResponse)
def update_report_version(
    report_id: int,
    req: ReportVersionUpdateRequest,
    household: Household = Depends(get_current_household),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Updates a dietitian report by either appending a new revision (version 2, new week of menu, additional recipes, extra tips)
    or replacing the report contents entirely.
    """
    report = db.query(DietitianReport).filter(
        DietitianReport.id == report_id,
        DietitianReport.household_id == household.id
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Informe no encontrado")

    servings = req.household_servings or report.household_servings or 2

    # 1. Create missing recipes if requested
    created_recipes_cache = {}
    new_recipe_ids = []

    for d in req.days:
        meals = d.get("meals", []) if isinstance(d, dict) else getattr(d, "meals", [])
        for m in meals:
            m_dict = m if isinstance(m, dict) else m.model_dump()
            is_rec = m_dict.get("is_recipe", False)
            title = str(m_dict.get("title", "")).strip()
            final_rec_id = m_dict.get("recipe_id")

            if req.create_missing_recipes and is_rec and not final_rec_id and title:
                if title in created_recipes_cache:
                    final_rec_id = created_recipes_cache[title]
                else:
                    new_rec = Recipe(
                        title=title,
                        description=m_dict.get("description") or f"Receta de revisión del plan nutricional ({m_dict.get('meal_type', 'comida')}) adaptada para {servings} raciones.",
                        prep_time_min=10,
                        cook_time_min=20,
                        total_time_min=30,
                        difficulty="facil",
                        base_servings=servings,
                        nutrition_calories=m_dict.get("calories"),
                        categories=json.dumps(["Comidas", "Plan Nutricional"], ensure_ascii=False),
                        tags=json.dumps(["saludable", "plan_nutricional", "dietista", "revision_ia"], ensure_ascii=False),
                        dish_type="Plato Principal" if m_dict.get("meal_type") in ["comida", "cena"] else "Desayuno / Snack",
                        meal_type="desayuno" if m_dict.get("meal_type") == "desayuno" else ("comida_cena" if m_dict.get("meal_type") in ["comida", "cena"] else "almuerzo_merienda"),
                        source_type="plan_nutricional_ia",
                        review_status="approved",
                        created_by_id=current_user.id
                    )
                    db.add(new_rec)
                    db.flush()

                    variant = RecipeVariant(
                        recipe_id=new_rec.id,
                        variant_type="traditional",
                        title=f"Preparación para {servings} raciones",
                        is_default=True
                    )
                    db.add(variant)
                    db.flush()

                    for idx_ing, ing in enumerate(m_dict.get("ingredients", [])):
                        ing_amt = ing.get("amount") if isinstance(ing, dict) else getattr(ing, "amount", None)
                        scaled_amt = round(float(ing_amt) * servings, 2) if ing_amt is not None else None
                        db.add(RecipeIngredient(
                            variant_id=variant.id,
                            name=ing.get("name", "") if isinstance(ing, dict) else getattr(ing, "name", ""),
                            amount=scaled_amt,
                            unit=ing.get("unit") if isinstance(ing, dict) else getattr(ing, "unit", None),
                            order_index=idx_ing
                        ))

                    steps = m_dict.get("steps", [])
                    if steps:
                        for st in steps:
                            st_num = st.get("step_number") if isinstance(st, dict) else getattr(st, "step_number", 1)
                            st_ins = st.get("instruction") if isinstance(st, dict) else getattr(st, "instruction", "")
                            db.add(RecipeStep(variant_id=variant.id, step_number=st_num, instruction=st_ins))
                    else:
                        db.add(RecipeStep(variant_id=variant.id, step_number=1, instruction=f"Preparar los ingredientes adaptados para {servings} raciones y cocinar siguiendo pautas saludables."))

                    db.flush()
                    final_rec_id = new_rec.id
                    created_recipes_cache[title] = new_rec.id
                    new_recipe_ids.append(new_rec.id)

            if isinstance(m, dict):
                m["recipe_id"] = final_rec_id

    # Parse existing recipes
    current_rec_ids = []
    if report.created_recipes_ids:
        try:
            current_rec_ids = json.loads(report.created_recipes_ids)
        except Exception:
            current_rec_ids = []

    # Parse existing guidelines
    current_guidelines = []
    if report.dietary_guidelines:
        try:
            parsed_g = json.loads(report.dietary_guidelines)
            if isinstance(parsed_g, list):
                current_guidelines = parsed_g
        except Exception:
            current_guidelines = [g.strip() for g in str(report.dietary_guidelines).split("\n") if g.strip()]

    now_str = datetime.utcnow().strftime("%d/%m/%Y")

    if req.mode == "replace":
        # Full replacement
        report.title = req.week_title or f"Informe Nutricional (Actualizado {now_str})"
        report.version = (report.version or 1) + 1
        if req.target_calories is not None:
            report.target_calories = req.target_calories
        if req.dietary_goal is not None:
            report.dietary_goal = req.dietary_goal
        if req.habits is not None:
            report.habits = req.habits
        if req.preferred_foods is not None:
            report.preferred_foods = req.preferred_foods
        if req.excluded_foods is not None:
            report.excluded_foods = req.excluded_foods
        if req.notes is not None:
            report.notes = req.notes
        report.dietary_guidelines = json.dumps(req.new_guidelines or [], ensure_ascii=False)
        report.created_recipes_ids = json.dumps(list(set(new_recipe_ids)), ensure_ascii=False)
        report.raw_plan_data = json.dumps([
            {"week_number": 1, "week_title": "Semana 1", "days": req.days}
        ], ensure_ascii=False, default=str)
    else:
        # Incremental update (version 2, add week, append tips and recipes)
        report.version = (report.version or 1) + 1

        # Merge guidelines without duplicates
        existing_norm = {g.strip().lower() for g in current_guidelines}
        merged_guidelines = list(current_guidelines)
        for ng in req.new_guidelines:
            if ng.strip() and ng.strip().lower() not in existing_norm:
                merged_guidelines.append(ng.strip())
                existing_norm.add(ng.strip().lower())
        report.dietary_guidelines = json.dumps(merged_guidelines, ensure_ascii=False)

        # Merge recipe IDs
        all_rec_ids = list(set(current_rec_ids + new_recipe_ids))
        report.created_recipes_ids = json.dumps(all_rec_ids, ensure_ascii=False)

        # Merge weeks
        existing_weeks = []
        if report.raw_plan_data:
            try:
                parsed_raw = json.loads(report.raw_plan_data)
                if isinstance(parsed_raw, list):
                    if parsed_raw and isinstance(parsed_raw[0], dict) and "week_number" in parsed_raw[0]:
                        existing_weeks = parsed_raw
                    else:
                        existing_weeks = [{"week_number": 1, "week_title": "Semana 1", "days": parsed_raw}]
            except Exception:
                existing_weeks = []

        new_week_num = len(existing_weeks) + 1
        new_week_title = req.week_title or f"Semana {new_week_num} (Revisión {now_str})"
        existing_weeks.append({
            "week_number": new_week_num,
            "week_title": new_week_title,
            "days": req.days
        })
        report.raw_plan_data = json.dumps(existing_weeks, ensure_ascii=False, default=str)

        # Update metadata if new values given
        if req.target_calories is not None:
            report.target_calories = req.target_calories
        if req.dietary_goal is not None:
            report.dietary_goal = req.dietary_goal
        if req.habits:
            report.habits = f"{report.habits or ''}\n[Revisión v{report.version}]: {req.habits}".strip()
        if req.notes:
            report.notes = f"{report.notes or ''}\n[Revisión v{report.version}]: {req.notes}".strip()
        if req.preferred_foods:
            report.preferred_foods = f"{report.preferred_foods or ''}, {req.preferred_foods}".strip(", ")
        if req.excluded_foods:
            report.excluded_foods = f"{report.excluded_foods or ''}, {req.excluded_foods}".strip(", ")

    report.household_servings = servings
    report.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(report)

    return _format_report_response(report, db)


@router.get("/daily-tip")
def get_daily_tip(
    seed: Optional[int] = None,
    household: Household = Depends(get_current_household),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns a smart rotating tip or guideline for the home page.
    Uses guidelines from the active dietitian report if available;
    otherwise uses habits from profile or Mediterranean guidelines.
    """
    report = db.query(DietitianReport).filter(
        DietitianReport.household_id == household.id,
        DietitianReport.is_active == True
    ).order_by(DietitianReport.created_at.desc()).first()

    if not report:
        report = db.query(DietitianReport).filter(
            DietitianReport.household_id == household.id
        ).order_by(DietitianReport.created_at.desc()).first()

    tips = []
    report_title = None
    report_id = None
    patient_name = None

    if report:
        report_title = report.title
        report_id = report.id
        patient_name = report.patient_name
        if report.dietary_guidelines:
            try:
                parsed = json.loads(report.dietary_guidelines)
                if isinstance(parsed, list):
                    tips.extend([str(t).strip() for t in parsed if str(t).strip()])
            except Exception:
                pass
        if not tips and report.habits:
            tips.extend([h.strip() for h in report.habits.split("\n") if len(h.strip()) > 5])

    if not tips:
        prof = db.query(NutritionProfile).filter(NutritionProfile.user_id == current_user.id).first()
        if prof and prof.cooking_habits:
            tips.extend([h.strip() for h in prof.cooking_habits.split("\n") if len(h.strip()) > 5])

    if not tips:
        tips = [
            "Prioriza verduras frescas o al vapor en la comida y la cena.",
            "Mantente hidratado: bebe un vaso de agua antes de cada comida principal.",
            "Elige aceite de oliva virgen extra (AOVE) en crudo como grasa principal.",
            "Incorpora legumbres al menos 3 veces por semana como fuente de proteína y fibra.",
            "Cena ligero al menos 2 horas antes de acostarte para favorecer el descanso digestivo.",
            "Opta por piezas de fruta fresca entera en vez de zumos industriales.",
            "Utiliza especias y hierbas aromáticas para potenciar el sabor y reducir el uso de sal.",
            "Planifica tus tuppers y batch cooking con antelación para no recurrir a ultraprocesados."
        ]

    if seed is not None:
        idx = seed % len(tips)
    else:
        day_of_year = datetime.utcnow().timetuple().tm_yday
        idx = day_of_year % len(tips)

    return {
        "tip": tips[idx],
        "index": idx,
        "total_tips": len(tips),
        "all_tips": tips,
        "has_dietitian_report": report is not None,
        "report_id": report_id,
        "report_title": report_title,
        "patient_name": patient_name,
        "source": "dietitian_report" if report else "general_mediterranean"
    }
