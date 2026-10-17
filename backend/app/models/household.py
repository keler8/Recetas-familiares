from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Numeric
)
from sqlalchemy.orm import relationship
from app.database import Base


class Household(Base):
    __tablename__ = "households"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    is_personal = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    memberships = relationship("HouseholdMembership", back_populates="household", cascade="all, delete-orphan")
    diners = relationship("Diner", back_populates="household", cascade="all, delete-orphan")
    meal_plans = relationship("MealPlan", back_populates="household", cascade="all, delete-orphan")
    pantry_items = relationship("PantryItem", back_populates="household", cascade="all, delete-orphan")
    shopping_lists = relationship("ShoppingList", back_populates="household", cascade="all, delete-orphan")
    receipts = relationship("Receipt", back_populates="household", cascade="all, delete-orphan")
    budgets = relationship("HouseholdBudget", back_populates="household", cascade="all, delete-orphan")


class HouseholdMembership(Base):
    __tablename__ = "household_memberships"

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(50), default="editor", nullable=False)  # owner, editor, viewer
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    household = relationship("Household", back_populates="memberships")
    user = relationship("User", back_populates="memberships")


class Diner(Base):
    __tablename__ = "diners"

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    household = relationship("Household", back_populates="diners")
    preferences = relationship("DinerPreference", back_populates="diner", cascade="all, delete-orphan")
    restrictions = relationship("DinerRestriction", back_populates="diner", cascade="all, delete-orphan")


class DinerPreference(Base):
    __tablename__ = "diner_preferences"

    id = Column(Integer, primary_key=True, index=True)
    diner_id = Column(Integer, ForeignKey("diners.id", ondelete="CASCADE"), nullable=False, index=True)
    preference_type = Column(String(50), nullable=False)  # 'like', 'dislike'
    ingredient_name = Column(String(150), nullable=False)

    diner = relationship("Diner", back_populates="preferences")


class DinerRestriction(Base):
    __tablename__ = "diner_restrictions"

    id = Column(Integer, primary_key=True, index=True)
    diner_id = Column(Integer, ForeignKey("diners.id", ondelete="CASCADE"), nullable=False, index=True)
    restriction_type = Column(String(50), nullable=False)  # 'allergy', 'intolerance', 'dietary'
    details = Column(String(200), nullable=False)

    diner = relationship("Diner", back_populates="restrictions")


class HouseholdBudget(Base):
    __tablename__ = "household_budgets"

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    monthly_budget = Column(Numeric(10, 2), nullable=False, default=0.00)
    currency = Column(String(10), default="EUR", nullable=False)
    notes = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    household = relationship("Household", back_populates="budgets")
