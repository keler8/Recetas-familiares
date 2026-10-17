from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel


class RecipeIngredientBase(BaseModel):
    name: str
    amount: Optional[float] = None
    unit: Optional[str] = None
    notes: Optional[str] = None
    is_optional: bool = False
    order_index: int = 0


class RecipeIngredientCreate(RecipeIngredientBase):
    pass


class RecipeIngredientResponse(RecipeIngredientBase):
    id: int

    class Config:
        from_attributes = True


class RecipeStepBase(BaseModel):
    step_number: int
    instruction: str
    appliance_action: Optional[str] = None
    temperature: Optional[str] = None
    speed: Optional[str] = None
    accessory: Optional[str] = None
    timer_seconds: Optional[int] = None
    tip: Optional[str] = None
    is_manual: bool = False


class RecipeStepCreate(RecipeStepBase):
    pass


class RecipeStepResponse(RecipeStepBase):
    id: int

    class Config:
        from_attributes = True


class RecipeVariantBase(BaseModel):
    variant_type: str = "traditional"  # traditional, thermomix, airfryer, healthy, custom
    title: str
    description: Optional[str] = None
    is_default: bool = False
    appliance_settings: Optional[str] = None


class RecipeVariantCreate(RecipeVariantBase):
    ingredients: List[RecipeIngredientCreate] = []
    steps: List[RecipeStepCreate] = []


class RecipeVariantResponse(RecipeVariantBase):
    id: int
    ingredients: List[RecipeIngredientResponse] = []
    steps: List[RecipeStepResponse] = []

    class Config:
        from_attributes = True


class RecipeBase(BaseModel):
    title: str
    description: Optional[str] = None
    summary: Optional[str] = None
    main_image_url: Optional[str] = None
    categories: Optional[List[str]] = []
    tags: Optional[List[str]] = []
    dish_type: Optional[str] = "Plato principal"
    cuisine: Optional[str] = "Mediterránea"
    prep_time_min: int = 15
    cook_time_min: int = 20
    total_time_min: int = 35
    difficulty: str = "media"
    base_servings: int = 4
    equipment_notes: Optional[str] = None
    preservation_tips: Optional[str] = None
    freezing_tips: Optional[str] = None
    reheating_tips: Optional[str] = None
    leftover_tips: Optional[str] = None
    chef_notes: Optional[str] = None
    nutrition_calories: Optional[float] = None
    nutrition_protein: Optional[float] = None
    nutrition_carbs: Optional[float] = None
    nutrition_fat: Optional[float] = None
    allergens: Optional[List[str]] = []
    original_author: Optional[str] = None
    source_type: str = "manual"
    source_url: Optional[str] = None


class RecipeCreate(RecipeBase):
    variants: List[RecipeVariantCreate] = []


class RecipeUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    summary: Optional[str] = None
    main_image_url: Optional[str] = None
    categories: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    dish_type: Optional[str] = None
    cuisine: Optional[str] = None
    prep_time_min: Optional[int] = None
    cook_time_min: Optional[int] = None
    total_time_min: Optional[int] = None
    difficulty: Optional[str] = None
    base_servings: Optional[int] = None
    equipment_notes: Optional[str] = None
    preservation_tips: Optional[str] = None
    freezing_tips: Optional[str] = None
    reheating_tips: Optional[str] = None
    leftover_tips: Optional[str] = None
    chef_notes: Optional[str] = None
    allergens: Optional[List[str]] = None
    change_summary: Optional[str] = None


class RecipeRatingCreate(BaseModel):
    rating: int  # 1 - 5
    comment: Optional[str] = None


class RecipeRatingResponse(BaseModel):
    id: int
    user_id: int
    rating: int
    comment: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class RecipePersonalNoteCreate(BaseModel):
    notes: str


class RecipePersonalNoteResponse(BaseModel):
    id: int
    recipe_id: int
    notes: str
    updated_at: datetime

    class Config:
        from_attributes = True


class RecipeResponse(RecipeBase):
    id: int
    review_status: str
    times_prepared: int
    created_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    variants: List[RecipeVariantResponse] = []
    ratings: List[RecipeRatingResponse] = []
    average_rating: Optional[float] = None
    is_favorite: bool = False
    personal_notes: Optional[str] = None

    class Config:
        from_attributes = True
