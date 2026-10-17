import os
import uuid
import logging
from typing import List, Optional
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from app.database import get_db
from app.config import settings
from app.models.household import Household
from app.models.pantry_shopping import (
    Receipt, ReceiptLine, PriceHistory, PantryItem, PantryMovement
)
from app.schemas.pantry_shopping import (
    ReceiptResponse, ReceiptConfirmRequest, ReceiptLineResponse
)
from app.api.deps import get_current_user, get_current_household
from app.models.auth import User
from app.services.storage_guard import storage_guard
from app.services.ocr_service import ocr_service
from app.services.gemini_service import gemini_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/receipts", tags=["Lectura de Tickets"])


@router.get("", response_model=List[ReceiptResponse])
def list_receipts(
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    receipts = db.query(Receipt).filter(Receipt.household_id == household.id).order_by(Receipt.created_at.desc()).all()
    return receipts


@router.get("/{receipt_id}", response_model=ReceiptResponse)
def get_receipt(
    receipt_id: int,
    household: Household = Depends(get_current_household),
    db: Session = Depends(get_db)
):
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id, Receipt.household_id == household.id).first()
    if not receipt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket no encontrado")
    return receipt


@router.post("/scan", response_model=ReceiptResponse)
async def scan_receipt_file(
    file: UploadFile = File(...),
    household: Household = Depends(get_current_household),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not storage_guard.can_start_heavy_task():
        raise HTTPException(
            status_code=status.HTTP_507_INSUFFICIENT_STORAGE,
            detail="Espacio insuficiente en disco para procesar tickets"
        )

    ext = os.path.splitext(file.filename)[1].lower()
    temp_path = os.path.join(settings.TEMP_PATH, f"receipt_{uuid.uuid4().hex[:8]}{ext}")

    try:
        content = await file.read()
        with open(temp_path, "wb") as f:
            f.write(content)

        # Extract OCR text
        ocr_text = ocr_service.process_document(temp_path)

        # Parse with Gemini / Heuristic
        parsed = gemini_service.analyze_receipt_ocr(ocr_text)

        receipt_date = None
        if parsed.get("receipt_date"):
            try:
                receipt_date = datetime.strptime(parsed["receipt_date"], "%Y-%m-%d").date()
            except Exception:
                receipt_date = date.today()

        receipt = Receipt(
            household_id=household.id,
            user_id=current_user.id,
            store_name=parsed.get("store_name", "Supermercado"),
            receipt_date=receipt_date or date.today(),
            total_amount=parsed.get("total_amount", 0.0),
            raw_ocr_text=ocr_text[:3000],
            status="pending_review"
        )
        db.add(receipt)
        db.flush()

        for line_data in parsed.get("lines", []):
            line = ReceiptLine(
                receipt_id=receipt.id,
                product_name=line_data.get("product_name", "Producto"),
                quantity=line_data.get("quantity", 1.0),
                unit=line_data.get("unit", "ud"),
                unit_price=line_data.get("unit_price"),
                line_total=line_data.get("line_total", 0.0),
                discount=line_data.get("discount", 0.0),
                category=line_data.get("category", "General")
            )
            db.add(line)

        db.commit()
        db.refresh(receipt)
        return receipt

    finally:
        # Strictly remove temporary receipt file
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
                logger.info(f"STORAGE GUARD: Deleted temporary ticket file {temp_path}")
            except Exception:
                pass


@router.post("/{receipt_id}/confirm", response_model=ReceiptResponse)
def confirm_receipt(
    receipt_id: int,
    req: ReceiptConfirmRequest,
    household: Household = Depends(get_current_household),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id, Receipt.household_id == household.id).first()
    if not receipt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket no encontrado")

    if req.store_name:
        receipt.store_name = req.store_name
    if req.receipt_date:
        receipt.receipt_date = req.receipt_date

    # Record confirmed lines, update price history, and optionally add to pantry
    for line in req.lines:
        # Price history
        if line.unit_price and line.unit_price > 0:
            db.add(PriceHistory(
                product_name=line.product_name,
                store_name=receipt.store_name,
                price_per_unit=line.unit_price,
                unit=line.unit,
                recorded_at=datetime.utcnow()
            ))

        # Add to pantry if requested
        if req.add_selected_to_pantry:
            p_item = db.query(PantryItem).filter(
                PantryItem.household_id == household.id,
                PantryItem.product_name.ilike(line.product_name.strip())
            ).first()

            if p_item:
                p_item.quantity += line.quantity
                p_item.estimated_price = line.unit_price or p_item.estimated_price
                db.add(PantryMovement(
                    pantry_item_id=p_item.id,
                    user_id=current_user.id,
                    change_type="add",
                    amount=line.quantity,
                    previous_quantity=p_item.quantity - line.quantity,
                    new_quantity=p_item.quantity
                ))
            else:
                new_p = PantryItem(
                    household_id=household.id,
                    product_name=line.product_name,
                    quantity=line.quantity,
                    unit=line.unit,
                    category=line.category,
                    location=req.pantry_location,
                    estimated_price=line.unit_price,
                    purchase_date=receipt.receipt_date or date.today()
                )
                db.add(new_p)
                db.flush()
                db.add(PantryMovement(
                    pantry_item_id=new_p.id,
                    user_id=current_user.id,
                    change_type="add",
                    amount=line.quantity,
                    previous_quantity=0.0,
                    new_quantity=line.quantity
                ))

    receipt.status = "confirmed"
    db.commit()
    db.refresh(receipt)
    return receipt
