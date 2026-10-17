from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel


class PantryItemBase(BaseModel):
    product_name: str
    commercial_name: Optional[str] = None
    quantity: float = 1.0
    unit: str = "unidad"
    category: str = "General"
    location: str = "despensa"
    purchase_date: Optional[date] = None
    expiry_date: Optional[date] = None
    estimated_price: Optional[float] = None


class PantryItemCreate(PantryItemBase):
    pass


class PantryItemUpdate(BaseModel):
    quantity: Optional[float] = None
    unit: Optional[str] = None
    location: Optional[str] = None
    expiry_date: Optional[date] = None
    category: Optional[str] = None


class PantryItemResponse(PantryItemBase):
    id: int
    household_id: int
    last_checked_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ShoppingItemBase(BaseModel):
    product_name: str
    amount: float = 1.0
    unit: str = "unidad"
    category: str = "General"
    store_name: Optional[str] = None
    notes: Optional[str] = None


class ShoppingItemCreate(ShoppingItemBase):
    pass


class ShoppingItemUpdate(BaseModel):
    product_name: Optional[str] = None
    amount: Optional[float] = None
    unit: Optional[str] = None
    is_checked: Optional[bool] = None
    add_to_pantry: Optional[bool] = False
    pantry_location: Optional[str] = "despensa"


class ShoppingItemResponse(ShoppingItemBase):
    id: int
    list_id: int
    is_checked: bool
    checked_at: Optional[datetime] = None
    added_to_pantry: bool

    class Config:
        from_attributes = True


class ShoppingListCreate(BaseModel):
    title: str
    store_name: Optional[str] = None


class ShoppingListResponse(BaseModel):
    id: int
    household_id: int
    title: str
    store_name: Optional[str] = None
    is_archived: bool
    created_at: datetime
    items: List[ShoppingItemResponse] = []

    class Config:
        from_attributes = True


class GenerateShoppingListRequest(BaseModel):
    title: str = "Lista generada"
    mode: str = "complete"  # complete, smart (subtracts pantry), assisted
    meal_plan_id: Optional[int] = None
    recipe_ids: Optional[List[int]] = None


class ReceiptLineResponse(BaseModel):
    id: int
    product_name: str
    quantity: float
    unit: str
    unit_price: Optional[float]
    line_total: float
    discount: float
    category: str

    class Config:
        from_attributes = True


class ReceiptResponse(BaseModel):
    id: int
    household_id: int
    store_name: Optional[str]
    receipt_date: Optional[date]
    total_amount: float
    status: str
    created_at: datetime
    lines: List[ReceiptLineResponse] = []

    class Config:
        from_attributes = True


class ReceiptConfirmRequest(BaseModel):
    store_name: Optional[str] = None
    receipt_date: Optional[date] = None
    lines: List[ReceiptLineResponse]
    add_selected_to_pantry: bool = True
    pantry_location: str = "despensa"
