from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.household import Household
from app.models.recipe import Recipe
from app.models.meal_plan import MealPlan
from app.models.pantry_shopping import (
    ShoppingList, ShoppingItem, PantryItem, PantryMovement
)
from app.schemas.pantry_shopping import (
    ShoppingListCreate, ShoppingListResponse, ShoppingItemCreate,
    ShoppingItemUpdate, ShoppingItemResponse, GenerateShoppingListRequest
)
from app.api.deps import get_current_user, get_current_household
from app.models.auth import User

router = APIRouter(prefix="/shopping", tags=["Listas de la Compra"])


@router.get("/lists", response_model=List[ShoppingListResponse])
def get_shopping_lists(
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    lists = db.query(ShoppingList).filter(
        ShoppingList.household_id == household.id,
        ShoppingList.is_archived == False
    ).order_by(ShoppingList.created_at.desc()).all()
    return lists


@router.post("/lists", response_model=ShoppingListResponse)
def create_shopping_list(
    list_in: ShoppingListCreate,
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    s_list = ShoppingList(
        household_id=household.id,
        title=list_in.title,
        store_name=list_in.store_name
    )
    db.add(s_list)
    db.commit()
    db.refresh(s_list)
    return s_list


@router.post("/lists/{list_id}/items", response_model=ShoppingItemResponse)
def add_item_to_list(
    list_id: int,
    item_in: ShoppingItemCreate,
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    s_list = db.query(ShoppingList).filter(ShoppingList.id == list_id, ShoppingList.household_id == household.id).first()
    if not s_list:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lista no encontrada")

    item = ShoppingItem(
        list_id=s_list.id,
        product_name=item_in.product_name,
        amount=item_in.amount,
        unit=item_in.unit,
        category=item_in.category,
        store_name=item_in.store_name,
        notes=item_in.notes
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/items/{item_id}", response_model=ShoppingItemResponse)
def update_shopping_item(
    item_id: int,
    item_up: ShoppingItemUpdate,
    household: Household = Depends(get_current_household),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    item = db.query(ShoppingItem).join(ShoppingList).filter(
        ShoppingItem.id == item_id,
        ShoppingList.household_id == household.id
    ).first()

    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artículo no encontrado")

    if item_up.product_name is not None:
        item.product_name = item_up.product_name
    if item_up.amount is not None:
        item.amount = item_up.amount
    if item_up.unit is not None:
        item.unit = item_up.unit

    if item_up.is_checked is not None:
        item.is_checked = item_up.is_checked
        item.checked_at = datetime.utcnow() if item_up.is_checked else None

        # If user checked it and requested adding to pantry:
        if item_up.is_checked and item_up.add_to_pantry and not item.added_to_pantry:
            # Add or update pantry item
            pantry_item = db.query(PantryItem).filter(
                PantryItem.household_id == household.id,
                PantryItem.product_name.ilike(item.product_name.strip())
            ).first()

            if pantry_item:
                pantry_item.quantity += item.amount
                db.add(PantryMovement(
                    pantry_item_id=pantry_item.id,
                    user_id=current_user.id,
                    change_type="add",
                    amount=item.amount,
                    previous_quantity=pantry_item.quantity - item.amount,
                    new_quantity=pantry_item.quantity
                ))
            else:
                new_p = PantryItem(
                    household_id=household.id,
                    product_name=item.product_name,
                    quantity=item.amount,
                    unit=item.unit,
                    category=item.category,
                    location=item_up.pantry_location or "despensa"
                )
                db.add(new_p)
                db.flush()
                db.add(PantryMovement(
                    pantry_item_id=new_p.id,
                    user_id=current_user.id,
                    change_type="add",
                    amount=item.amount,
                    previous_quantity=0.0,
                    new_quantity=item.amount
                ))

            item.added_to_pantry = True

    db.commit()
    db.refresh(item)
    return item


@router.delete("/items/{item_id}")
def delete_shopping_item(
    item_id: int,
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    item = db.query(ShoppingItem).join(ShoppingList).filter(
        ShoppingItem.id == item_id,
        ShoppingList.household_id == household.id
    ).first()

    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artículo no encontrado")

    db.delete(item)
    db.commit()
    return {"message": "Artículo eliminado de la lista"}


@router.post("/generate", response_model=ShoppingListResponse)
def generate_shopping_list(
    req: GenerateShoppingListRequest,
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    """
    Generates a shopping list in one of three required modes:
    - complete: all needed ingredients without looking at pantry
    - smart: subtracts pantry stock (normalizing matching items)
    - assisted: marks suggestions
    """
    recipes_to_process = []
    if req.meal_plan_id:
        plan = db.query(MealPlan).filter(MealPlan.id == req.meal_plan_id, MealPlan.household_id == household.id).first()
        if plan:
            for slot in plan.slots:
                for pr in slot.planned_recipes:
                    if pr.recipe:
                        recipes_to_process.append(pr.recipe)
    elif req.recipe_ids:
        recipes_to_process = db.query(Recipe).filter(Recipe.id.in_(req.recipe_ids)).all()

    # Aggregate ingredients
    needed_ingredients = {}
    for r in recipes_to_process:
        # Take default or first variant
        variant = r.variants[0] if r.variants else None
        if variant:
            for ing in variant.ingredients:
                key = (ing.name.strip().lower(), ing.unit or "ud")
                needed_ingredients[key] = needed_ingredients.get(key, 0.0) + (ing.amount or 1.0)

    # Fetch pantry stock
    pantry_items = db.query(PantryItem).filter(PantryItem.household_id == household.id).all()
    pantry_dict = {p.product_name.strip().lower(): p for p in pantry_items}

    # Create new shopping list
    new_list = ShoppingList(
        household_id=household.id,
        title=req.title,
        store_name=None
    )
    db.add(new_list)
    db.flush()

    for (name, unit), total_amount in needed_ingredients.items():
        qty_to_buy = total_amount
        pantry_match = pantry_dict.get(name)

        if req.mode == "smart" and pantry_match:
            # Subtract pantry if same or compatible unit
            if pantry_match.unit == unit:
                qty_to_buy = max(0.0, total_amount - pantry_match.quantity)
            elif pantry_match.quantity > 0:
                qty_to_buy = max(0.0, total_amount - pantry_match.quantity)

        if qty_to_buy > 0 or req.mode == "assisted":
            item = ShoppingItem(
                list_id=new_list.id,
                product_name=name.capitalize(),
                amount=round(qty_to_buy, 1) if qty_to_buy > 0 else 1.0,
                unit=unit,
                category="Alimentación",
                notes=f"Hay {pantry_match.quantity} {pantry_match.unit} en despensa" if (req.mode == "assisted" and pantry_match) else None
            )
            db.add(item)

    db.commit()
    db.refresh(new_list)
    return new_list
