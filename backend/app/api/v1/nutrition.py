from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.auth import User
from app.models.nutrition import NutritionProfile, NutritionConsent
from app.schemas.nutrition import (
    NutritionProfileResponse, NutritionProfileUpdate,
    NutritionConsentRequest, NutritionAdviceRequest
)
from app.api.deps import get_current_user

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
    Provides general culinary and healthy eating advice.
    Explicitly clarifies it is for culinary orientation and not medical guidance.
    """
    consent = db.query(NutritionConsent).filter(
        NutritionConsent.user_id == current_user.id,
        NutritionConsent.ai_data_consent == True
    ).first()

    if not consent:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Para recibir orientación nutricional de IA es necesario aceptar el consentimiento expreso de privacidad."
        )

    # General healthy advice response
    advice = (
        "Recomendaciones culinarias generales:\n"
        "1. Prioriza alimentos frescos y de temporada, aumentando la base de hortalizas y verduras en platos principales.\n"
        "2. Para técnicas de cocción, el vapor (Thermomix Varoma) y el asado con aire caliente (Airfryer) permiten reducir el aceite añadido manteniendo texturas crujientes y nutrientes.\n"
        "3. Incorpora legumbres dos o tres veces por semana como fuente saciante de proteína vegetal y fibra.\n"
        "\n*Nota legal: Esta información es meramente orientativa y culinaria. No constituye consejo médico ni diagnóstico nutricional personalizado.*"
    )

    return {"advice": advice, "disclaimer_acknowledged": True}
