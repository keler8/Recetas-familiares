from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel


class NutritionProfileUpdate(BaseModel):
    dietary_goals: Optional[str] = None
    cooking_habits: Optional[str] = None
    available_time_min: Optional[int] = 45
    meal_frequency: Optional[int] = 3
    physical_activity: Optional[str] = "moderada"
    preferred_foods: Optional[str] = None
    excluded_foods: Optional[str] = None
    focus_on_healthy: Optional[bool] = True
    notes: Optional[str] = None


class NutritionProfileResponse(BaseModel):
    id: int
    user_id: int
    dietary_goals: Optional[str] = None
    cooking_habits: Optional[str] = None
    available_time_min: int
    meal_frequency: int
    physical_activity: Optional[str] = None
    preferred_foods: Optional[str] = None
    excluded_foods: Optional[str] = None
    focus_on_healthy: bool
    notes: Optional[str] = None
    updated_at: datetime
    has_ai_consent: bool = False

    class Config:
        from_attributes = True


class NutritionConsentRequest(BaseModel):
    consent: bool


class NutritionAdviceRequest(BaseModel):
    query: str
    target_recipe_id: Optional[int] = None
