from datetime import datetime, date, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.household import Household
from app.models.pantry_shopping import PantryItem, PantryMovement
from app.schemas.pantry_shopping import (
    PantryItemCreate, PantryItemUpdate, PantryItemResponse
)
from app.api.deps import get_current_user, get_current_household
from app.models.auth import User

router = APIRouter(prefix="/pantry", tags=["Despensa"])


@router.get("", response_model=List[PantryItemResponse])
def list_pantry_items(
    location: Optional[str] = Query(None, description="nevera, congelador, despensa"),
    category: Optional[str] = Query(None),
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    query = db.query(PantryItem).filter(PantryItem.household_id == household.id)
    if location:
        query = query.filter(PantryItem.location == location)
    if category:
        query = query.filter(PantryItem.category == category)
    return query.order_by(PantryItem.expiry_date.asc().nullslast(), PantryItem.product_name.asc()).all()


@router.post("", response_model=PantryItemResponse)
def add_pantry_item(
    item_in: PantryItemCreate,
    household: Household = Depends(get_current_household),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    item = PantryItem(
        household_id=household.id,
        product_name=item_in.product_name,
        commercial_name=item_in.commercial_name,
        quantity=item_in.quantity,
        unit=item_in.unit,
        category=item_in.category,
        location=item_in.location,
        purchase_date=item_in.purchase_date or date.today(),
        expiry_date=item_in.expiry_date,
        estimated_price=item_in.estimated_price
    )
    db.add(item)
    db.flush()

    # Movement
    mov = PantryMovement(
        pantry_item_id=item.id,
        user_id=current_user.id,
        change_type="add",
        amount=item_in.quantity,
        previous_quantity=0.0,
        new_quantity=item_in.quantity
    )
    db.add(mov)

    db.commit()
    db.refresh(item)
    return item


@router.put("/{item_id}", response_model=PantryItemResponse)
def update_pantry_item(
    item_id: int,
    item_up: PantryItemUpdate,
    household: Household = Depends(get_current_household),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    item = db.query(PantryItem).filter(PantryItem.id == item_id, PantryItem.household_id == household.id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")

    if item_up.quantity is not None:
        prev = item.quantity
        item.quantity = item_up.quantity
        db.add(PantryMovement(
            pantry_item_id=item.id,
            user_id=current_user.id,
            change_type="adjust",
            amount=item_up.quantity - prev,
            previous_quantity=prev,
            new_quantity=item_up.quantity
        ))

    if item_up.unit is not None:
        item.unit = item_up.unit
    if item_up.location is not None:
        item.location = item_up.location
    if item_up.expiry_date is not None:
        item.expiry_date = item_up.expiry_date
    if item_up.category is not None:
        item.category = item_up.category

    item.last_checked_at = datetime.utcnow()
    db.commit()
    db.refresh(item)
    return item


@router.post("/{item_id}/consume")
def consume_pantry_item(
    item_id: int,
    amount: float = Query(..., gt=0),
    household: Household = Depends(get_current_household),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    item = db.query(PantryItem).filter(PantryItem.id == item_id, PantryItem.household_id == household.id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")

    prev = item.quantity
    new_q = max(0.0, prev - amount)
    item.quantity = new_q

    db.add(PantryMovement(
        pantry_item_id=item.id,
        user_id=current_user.id,
        change_type="consume",
        amount=-amount,
        previous_quantity=prev,
        new_quantity=new_q
    ))
    db.commit()
    return {"message": f"Consumido {amount} {item.unit}. Quedan {new_q} {item.unit}."}


@router.delete("/{item_id}")
def delete_pantry_item(
    item_id: int,
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    item = db.query(PantryItem).filter(PantryItem.id == item_id, PantryItem.household_id == household.id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    db.delete(item)
    db.commit()
    return {"message": "Producto eliminado de la despensa"}


@router.get("/expiring-soon")
def get_expiring_soon(
    days: int = Query(5, ge=1, le=30),
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    threshold = date.today() + timedelta(days=days)
    items = db.query(PantryItem).filter(
        PantryItem.household_id == household.id,
        PantryItem.expiry_date != None,
        PantryItem.expiry_date <= threshold,
        PantryItem.quantity > 0
    ).order_by(PantryItem.expiry_date.asc()).all()

    return items
