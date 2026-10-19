from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel


class NutritionProfileUpdate(BaseModel):
    dietary_goals: Optional[str] = None
    cooking_habits: Optional[str] = None
    available_time_min: Optional[int] = 45
    meal_frequency: Optional[int] = 3
    physical_activity: Optional[str] = "moderada"
    sex: Optional[str] = None
    age: Optional[int] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    dietary_goal: Optional[str] = "mantenimiento"
    target_calories: Optional[int] = None
    calorie_offset: Optional[int] = 0
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
    sex: Optional[str] = None
    age: Optional[int] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    dietary_goal: Optional[str] = None
    target_calories: Optional[int] = None
    calorie_offset: Optional[int] = 0
    preferred_foods: Optional[str] = None
    excluded_foods: Optional[str] = None
    focus_on_healthy: bool
    notes: Optional[str] = None
    updated_at: datetime
    has_ai_consent: bool = False
    calculated_bmr: Optional[int] = None
    daily_meal_breakdown: Optional[dict] = None

    class Config:
        from_attributes = True


class NutritionConsentRequest(BaseModel):
    consent: bool


class NutritionAdviceRequest(BaseModel):
    query: str
    target_recipe_id: Optional[int] = None


class DietitianReportUpdate(BaseModel):
    title: Optional[str] = None
    patient_name: Optional[str] = None
    target_calories: Optional[int] = None
    dietary_goal: Optional[str] = None
    habits: Optional[str] = None
    dietary_guidelines: Optional[List[str]] = None
    preferred_foods: Optional[str] = None
    excluded_foods: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class DietitianReportRecipeItem(BaseModel):
    id: int
    title: str
    image_url: Optional[str] = None
    prep_time_min: Optional[int] = None
    cook_time_min: Optional[int] = None
    nutrition_calories: Optional[int] = None
    difficulty: Optional[str] = None
    dish_type: Optional[str] = None
    categories: Optional[List[str]] = []
    is_private: Optional[bool] = False


class DietitianReportWeek(BaseModel):
    week_number: int
    week_title: str
    days: List[dict] = []


class DietitianReportResponse(BaseModel):
    id: int
    household_id: int
    user_id: Optional[int] = None
    diner_id: Optional[int] = None
    title: str
    version: int = 1
    patient_name: Optional[str] = None
    target_calories: Optional[int] = None
    dietary_goal: Optional[str] = None
    habits: Optional[str] = None
    dietary_guidelines: List[str] = []
    preferred_foods: Optional[str] = None
    excluded_foods: Optional[str] = None
    notes: Optional[str] = None
    raw_plan_data: Optional[List[dict]] = []
    weeks: List[DietitianReportWeek] = []
    created_recipes_ids: List[int] = []
    recipes: List[DietitianReportRecipeItem] = []
    household_servings: int = 2
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ApplyReportToWeekRequest(BaseModel):
    target_start_date: str  # YYYY-MM-DD
    household_servings: Optional[int] = None
    week_number: Optional[int] = None


class ReportVersionUpdateRequest(BaseModel):
    mode: str = "append"  # "append" (Añadir actualización) or "replace" (Reemplazar por completo)
    week_title: Optional[str] = None
    create_missing_recipes: bool = True
    household_servings: Optional[int] = None
    target_calories: Optional[int] = None
    dietary_goal: Optional[str] = None
    habits: Optional[str] = None
    new_guidelines: List[str] = []
    preferred_foods: Optional[str] = None
    excluded_foods: Optional[str] = None
    notes: Optional[str] = None
    days: List[dict] = []
