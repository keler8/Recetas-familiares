from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel


class DinerPreferenceSchema(BaseModel):
    id: Optional[int] = None
    preference_type: str  # like, dislike
    ingredient_name: str

    class Config:
        from_attributes = True


class DinerRestrictionSchema(BaseModel):
    id: Optional[int] = None
    restriction_type: str  # allergy, intolerance, dietary
    details: str

    class Config:
        from_attributes = True


class DinerBase(BaseModel):
    name: str
    is_active: bool = True
    sex: Optional[str] = None  # hombre, mujer
    age: Optional[int] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    activity_level: Optional[str] = None  # sedentario, ligero, moderado, intenso
    dietary_goal: Optional[str] = None  # deficit, mantenimiento, superavit, saludable
    target_calories: Optional[int] = None
    calorie_offset: Optional[int] = 0
    notes: Optional[str] = None


class DinerCreate(DinerBase):
    preferences: List[DinerPreferenceSchema] = []
    restrictions: List[DinerRestrictionSchema] = []


class DinerResponse(DinerBase):
    id: int
    preferences: List[DinerPreferenceSchema] = []
    restrictions: List[DinerRestrictionSchema] = []
    created_at: datetime

    class Config:
        from_attributes = True


class HouseholdMemberResponse(BaseModel):
    id: int
    user_id: int
    username: str
    email: str
    role: str
    created_at: datetime


class HouseholdBase(BaseModel):
    name: str
    description: Optional[str] = None


class HouseholdCreate(HouseholdBase):
    pass


class HouseholdResponse(HouseholdBase):
    id: int
    owner_id: int
    is_personal: bool
    created_at: datetime
    members: List[HouseholdMemberResponse] = []
    diners: List[DinerResponse] = []

    class Config:
        from_attributes = True


class HouseholdInviteRequest(BaseModel):
    username_or_email: str
    role: str = "editor"  # editor, viewer
