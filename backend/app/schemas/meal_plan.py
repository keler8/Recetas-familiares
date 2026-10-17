from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel


class PlannedRecipeResponse(BaseModel):
    id: int
    recipe_id: Optional[int] = None
    custom_recipe_name: Optional[str] = None
    custom_calories: Optional[float] = None
    calories: Optional[float] = None
    servings: int
    is_cooked: bool
    recipe_title: Optional[str] = None

    class Config:
        from_attributes = True


class MealSlotResponse(BaseModel):
    id: int
    slot_date: date
    meal_type: str
    servings: int
    notes: Optional[str] = None
    total_calories: Optional[float] = None
    planned_recipes: List[PlannedRecipeResponse] = []

    class Config:
        from_attributes = True


class MealPlanBase(BaseModel):
    title: str
    start_date: date
    end_date: date
    is_template: bool = False


class MealPlanCreate(MealPlanBase):
    pass


class MealPlanResponse(MealPlanBase):
    id: int
    household_id: int
    created_at: datetime
    slots: List[MealSlotResponse] = []

    class Config:
        from_attributes = True


class AddRecipeToSlotRequest(BaseModel):
    slot_date: date
    meal_type: str
    recipe_id: Optional[int] = None
    custom_recipe_name: Optional[str] = None
    custom_calories: Optional[float] = None
    servings: int = 4


class AiMenuGenerateRequest(BaseModel):
    start_date: date
    end_date: date
    focus_healthy: bool = True
    quick_meals_only: bool = False
    use_pantry_items: bool = True
    appliances: List[str] = ["Thermomix", "Airfryer", "Tradicional"]


class LeftoverCreate(BaseModel):
    name: str
    recipe_id: Optional[int] = None
    portions: int = 1
    location: str = "nevera"
    expiry_date: Optional[date] = None
    notes: Optional[str] = None


class LeftoverResponse(LeftoverCreate):
    id: int
    date_stored: date
    is_consumed: bool

    class Config:
        from_attributes = True
