from typing import Optional, List
from datetime import date, datetime
import datetime as dt
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


class MovePlannedRecipeRequest(BaseModel):
    planned_recipe_id: int
    target_date: date
    target_meal_type: str


class SaveTemplateRequest(BaseModel):
    plan_id: Optional[int] = None
    source_start_date: Optional[date] = None
    title: str


class ApplyTemplateRequest(BaseModel):
    template_id: int
    target_start_date: date
    mode: str = "replace"  # replace | merge


class CopyWeekRequest(BaseModel):
    source_start_date: date
    target_start_date: date
    mode: str = "replace"  # replace | merge


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


class NutritionPlanIngredient(BaseModel):
    name: str
    amount: Optional[float] = None
    unit: Optional[str] = None


class NutritionPlanStep(BaseModel):
    step_number: int
    instruction: str


class NutritionPlanMeal(BaseModel):
    meal_type: str  # desayuno, almuerzo, comida, merienda, cena, snacks
    title: str
    calories: Optional[float] = None
    is_recipe: bool = False
    recipe_id: Optional[int] = None
    matched_recipe_title: Optional[str] = None
    is_existing: bool = False
    description: Optional[str] = None
    ingredients: List[NutritionPlanIngredient] = []
    steps: List[NutritionPlanStep] = []


class NutritionPlanDay(BaseModel):
    day_name: str
    date: Optional[dt.date] = None
    meals: List[NutritionPlanMeal] = []


class NutritionPlanParsedResponse(BaseModel):
    plan_title: str
    patient_name: Optional[str] = None
    target_calories: Optional[int] = None
    dietary_goal: Optional[str] = None
    habits: Optional[str] = None
    dietary_guidelines: List[str] = []
    preferred_foods: Optional[str] = None
    excluded_foods: Optional[str] = None
    notes: Optional[str] = None
    days: List[NutritionPlanDay] = []


class ApplyNutritionPlanRequest(BaseModel):
    start_date: dt.date
    create_missing_recipes: bool = True
    plan_title: Optional[str] = None
    household_servings: int = 2
    target_diner_id: Optional[int] = None
    update_diner_profile: bool = True
    patient_name: Optional[str] = None
    target_calories: Optional[int] = None
    dietary_goal: Optional[str] = None
    habits: Optional[str] = None
    preferred_foods: Optional[str] = None
    excluded_foods: Optional[str] = None
    notes: Optional[str] = None
    days: List[NutritionPlanDay] = []

