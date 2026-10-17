from datetime import datetime
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.auth import User
from app.models.recipe import Recipe
from app.models.nutrition import NutritionProfile, NutritionConsent
from app.schemas.nutrition import (
    NutritionProfileResponse, NutritionProfileUpdate,
    NutritionConsentRequest, NutritionAdviceRequest
)
from app.api.deps import get_current_user
from app.services.gemini_service import gemini_service

router = APIRouter(prefix="/nutrition", tags=["Mi Alimentación Saludable"])


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

    resp = NutritionProfileResponse.model_validate(profile)
    resp.has_ai_consent = consent is not None
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

    resp = NutritionProfileResponse.model_validate(profile)
    resp.has_ai_consent = consent is not None
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
