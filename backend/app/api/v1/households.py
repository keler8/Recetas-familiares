from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.auth import User
from app.models.household import (
    Household, HouseholdMembership, Diner, DinerPreference, DinerRestriction, HouseholdBudget
)
from app.schemas.household import (
    HouseholdCreate, HouseholdResponse, HouseholdMemberResponse,
    HouseholdInviteRequest, DinerCreate, DinerResponse, DinerPreferenceSchema, DinerRestrictionSchema
)
from app.api.deps import get_current_user, get_current_household

router = APIRouter(prefix="/households", tags=["Hogares y Comensales"])


@router.get("", response_model=List[HouseholdResponse])
def get_user_households(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    memberships = db.query(HouseholdMembership).filter(HouseholdMembership.user_id == current_user.id).all()
    households = [m.household for m in memberships]
    results = []
    for h in households:
        members_resp = []
        for mem in h.memberships:
            members_resp.append(HouseholdMemberResponse(
                id=mem.id,
                user_id=mem.user_id,
                username=mem.user.username,
                email=mem.user.email,
                role=mem.role,
                created_at=mem.created_at
            ))
        diners_resp = [DinerResponse.model_validate(d) for d in h.diners]
        results.append(HouseholdResponse(
            id=h.id,
            name=h.name,
            description=h.description,
            owner_id=h.owner_id,
            is_personal=h.is_personal,
            created_at=h.created_at,
            members=members_resp,
            diners=diners_resp
        ))
    return results


@router.post("", response_model=HouseholdResponse)
def create_household(
    h_in: HouseholdCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    h = Household(
        name=h_in.name,
        description=h_in.description,
        owner_id=current_user.id,
        is_personal=False
    )
    db.add(h)
    db.flush()

    membership = HouseholdMembership(
        household_id=h.id,
        user_id=current_user.id,
        role="owner"
    )
    db.add(membership)
    db.commit()
    db.refresh(h)

    return HouseholdResponse(
        id=h.id,
        name=h.name,
        description=h.description,
        owner_id=h.owner_id,
        is_personal=h.is_personal,
        created_at=h.created_at,
        members=[HouseholdMemberResponse(
            id=membership.id,
            user_id=current_user.id,
            username=current_user.username,
            email=current_user.email,
            role="owner",
            created_at=membership.created_at
        )],
        diners=[]
    )


@router.post("/invite")
def invite_to_household(
    req: HouseholdInviteRequest,
    household: Household = Depends(get_current_household),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Only owner can invite
    membership = db.query(HouseholdMembership).filter(
        HouseholdMembership.household_id == household.id,
        HouseholdMembership.user_id == current_user.id
    ).first()

    if not membership or membership.role != "owner":
        if current_user.role != "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo el propietario del hogar puede invitar miembros")

    target_user = db.query(User).filter(
        (User.email.ilike(req.username_or_email.strip())) | (User.username.ilike(req.username_or_email.strip()))
    ).first()

    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado. Solo los administradores pueden crear nuevas cuentas."
        )

    # Check if already member
    existing = db.query(HouseholdMembership).filter(
        HouseholdMembership.household_id == household.id,
        HouseholdMembership.user_id == target_user.id
    ).first()

    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El usuario ya es miembro de este hogar")

    new_membership = HouseholdMembership(
        household_id=household.id,
        user_id=target_user.id,
        role=req.role
    )
    db.add(new_membership)
    db.commit()

    return {"message": f"Usuario {target_user.username} añadido con éxito al hogar"}


def _calculate_tdee(sex: Optional[str], age: Optional[int], weight_kg: Optional[float], height_cm: Optional[float], activity_level: Optional[str], goal: Optional[str], offset: int = 0) -> Optional[int]:
    if not (weight_kg and height_cm and age and sex):
        return None
    if str(sex).lower() in ["hombre", "male", "m"]:
        bmr = 10.0 * float(weight_kg) + 6.25 * float(height_cm) - 5.0 * int(age) + 5.0
    else:
        bmr = 10.0 * float(weight_kg) + 6.25 * float(height_cm) - 5.0 * int(age) - 161.0
    
    act = str(activity_level or "").lower()
    if any(k in act for k in ["intenso", "alta", "deportista", "atleta"]):
        mult = 1.725
    elif "moderad" in act:
        mult = 1.55
    elif "liger" in act:
        mult = 1.375
    else:
        mult = 1.2
    
    tdee = bmr * mult
    g = str(goal or "").lower()
    if any(k in g for k in ["deficit", "perder", "grasa", "peso"]):
        adj = -400
    elif any(k in g for k in ["superavit", "ganar", "volumen", "musculo"]):
        adj = 300
    else:
        adj = 0
        
    return int(round(tdee + adj + (offset or 0)))


# Diner endpoints
@router.get("/diners", response_model=List[DinerResponse])
def list_diners(
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    return [DinerResponse.model_validate(d) for d in household.diners]


@router.post("/diners", response_model=DinerResponse)
def add_diner(
    d_in: DinerCreate,
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    target_cals = d_in.target_calories
    if not target_cals:
        target_cals = _calculate_tdee(
            d_in.sex, d_in.age, d_in.weight_kg, d_in.height_cm,
            d_in.activity_level, d_in.dietary_goal, d_in.calorie_offset
        )

    diner = Diner(
        household_id=household.id,
        name=d_in.name,
        is_active=d_in.is_active,
        sex=d_in.sex,
        age=d_in.age,
        weight_kg=d_in.weight_kg,
        height_cm=d_in.height_cm,
        activity_level=d_in.activity_level,
        dietary_goal=d_in.dietary_goal,
        target_calories=target_cals,
        calorie_offset=d_in.calorie_offset or 0,
        notes=d_in.notes
    )
    db.add(diner)
    db.flush()

    for p in d_in.preferences:
        db.add(DinerPreference(diner_id=diner.id, preference_type=p.preference_type, ingredient_name=p.ingredient_name))
    for r in d_in.restrictions:
        db.add(DinerRestriction(diner_id=diner.id, restriction_type=r.restriction_type, details=r.details))

    db.commit()
    db.refresh(diner)
    return DinerResponse.model_validate(diner)


@router.put("/diners/{diner_id}", response_model=DinerResponse)
def update_diner(
    diner_id: int,
    d_in: DinerCreate,
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    diner = db.query(Diner).filter(Diner.id == diner_id, Diner.household_id == household.id).first()
    if not diner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Persona/Comensal no encontrado")

    target_cals = d_in.target_calories
    if not target_cals:
        target_cals = _calculate_tdee(
            d_in.sex, d_in.age, d_in.weight_kg, d_in.height_cm,
            d_in.activity_level, d_in.dietary_goal, d_in.calorie_offset
        )

    diner.name = d_in.name
    diner.is_active = d_in.is_active
    diner.sex = d_in.sex
    diner.age = d_in.age
    diner.weight_kg = d_in.weight_kg
    diner.height_cm = d_in.height_cm
    diner.activity_level = d_in.activity_level
    diner.dietary_goal = d_in.dietary_goal
    diner.target_calories = target_cals
    diner.calorie_offset = d_in.calorie_offset or 0
    diner.notes = d_in.notes

    # Replace preferences and restrictions
    db.query(DinerPreference).filter(DinerPreference.diner_id == diner.id).delete()
    db.query(DinerRestriction).filter(DinerRestriction.diner_id == diner.id).delete()

    for p in d_in.preferences:
        db.add(DinerPreference(diner_id=diner.id, preference_type=p.preference_type, ingredient_name=p.ingredient_name))
    for r in d_in.restrictions:
        db.add(DinerRestriction(diner_id=diner.id, restriction_type=r.restriction_type, details=r.details))

    db.commit()
    db.refresh(diner)
    return DinerResponse.model_validate(diner)


@router.delete("/diners/{diner_id}")
def delete_diner(
    diner_id: int,
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    diner = db.query(Diner).filter(Diner.id == diner_id, Diner.household_id == household.id).first()
    if not diner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Persona/Comensal no encontrado")

    db.delete(diner)
    db.commit()
    return {"message": "Persona eliminada del hogar"}

