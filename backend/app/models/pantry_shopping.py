from datetime import datetime, date
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, Date, ForeignKey, Numeric, Float
)
from sqlalchemy.orm import relationship
from app.database import Base


class PantryItem(Base):
    __tablename__ = "pantry_items"

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    product_name = Column(String(200), index=True, nullable=False)
    commercial_name = Column(String(200), nullable=True)
    quantity = Column(Float, default=0.0, nullable=False)
    unit = Column(String(50), default="unidad", nullable=False)  # g, kg, ml, l, unidad, lata, etc.
    category = Column(String(100), default="General", nullable=False)
    location = Column(String(50), default="despensa", nullable=False)  # nevera, congelador, despensa, otro
    
    purchase_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=True, index=True)
    estimated_price = Column(Numeric(10, 2), nullable=True)
    last_checked_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    household = relationship("Household", back_populates="pantry_items")
    movements = relationship("PantryMovement", back_populates="pantry_item", cascade="all, delete-orphan")


class PantryMovement(Base):
    __tablename__ = "pantry_movements"

    id = Column(Integer, primary_key=True, index=True)
    pantry_item_id = Column(Integer, ForeignKey("pantry_items.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    change_type = Column(String(50), nullable=False)  # 'add', 'consume', 'waste', 'adjust'
    amount = Column(Float, nullable=False)
    previous_quantity = Column(Float, nullable=False)
    new_quantity = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    pantry_item = relationship("PantryItem", back_populates="movements")


class ShoppingList(Base):
    __tablename__ = "shopping_lists"

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(150), nullable=False)
    store_name = Column(String(100), nullable=True)
    is_archived = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    household = relationship("Household", back_populates="shopping_lists")
    items = relationship("ShoppingItem", back_populates="shopping_list", cascade="all, delete-orphan", order_by="ShoppingItem.id")


class ShoppingItem(Base):
    __tablename__ = "shopping_items"

    id = Column(Integer, primary_key=True, index=True)
    list_id = Column(Integer, ForeignKey("shopping_lists.id", ondelete="CASCADE"), nullable=False, index=True)
    product_name = Column(String(200), nullable=False)
    amount = Column(Float, default=1.0, nullable=False)
    unit = Column(String(50), default="unidad", nullable=False)
    category = Column(String(100), default="General", nullable=False)
    store_name = Column(String(100), nullable=True)
    is_checked = Column(Boolean, default=False, nullable=False)
    checked_at = Column(DateTime, nullable=True)
    added_to_pantry = Column(Boolean, default=False, nullable=False)
    notes = Column(String(255), nullable=True)

    shopping_list = relationship("ShoppingList", back_populates="items")


class Receipt(Base):
    __tablename__ = "receipts"

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    store_name = Column(String(150), nullable=True)
    receipt_date = Column(Date, nullable=True)
    total_amount = Column(Numeric(10, 2), default=0.00, nullable=False)
    raw_ocr_text = Column(Text, nullable=True)
    status = Column(String(50), default="pending_review", nullable=False)  # pending_review, confirmed
    drive_file_id = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    household = relationship("Household", back_populates="receipts")
    lines = relationship("ReceiptLine", back_populates="receipt", cascade="all, delete-orphan")


class ReceiptLine(Base):
    __tablename__ = "receipt_lines"

    id = Column(Integer, primary_key=True, index=True)
    receipt_id = Column(Integer, ForeignKey("receipts.id", ondelete="CASCADE"), nullable=False, index=True)
    product_name = Column(String(200), nullable=False)
    quantity = Column(Float, default=1.0, nullable=False)
    unit = Column(String(50), default="ud", nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=True)
    line_total = Column(Numeric(10, 2), nullable=False)
    discount = Column(Numeric(10, 2), default=0.00, nullable=False)
    category = Column(String(100), default="General", nullable=False)
    matched_pantry_item_id = Column(Integer, ForeignKey("pantry_items.id", ondelete="SET NULL"), nullable=True)

    receipt = relationship("Receipt", back_populates="lines")


class PriceHistory(Base):
    __tablename__ = "price_history"

    id = Column(Integer, primary_key=True, index=True)
    product_name = Column(String(200), index=True, nullable=False)
    store_name = Column(String(100), index=True, nullable=True)
    price_per_unit = Column(Numeric(10, 2), nullable=False)
    unit = Column(String(50), nullable=False)
    recorded_at = Column(DateTime, default=datetime.utcnow, nullable=False)
