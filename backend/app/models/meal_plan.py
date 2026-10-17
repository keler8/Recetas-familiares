from datetime import datetime, date
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, Date, ForeignKey
)
from sqlalchemy.orm import relationship
from app.database import Base


class MealPlan(Base):
    __tablename__ = "meal_plans"

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(150), nullable=False)
    start_date = Column(Date, nullable=False, index=True)
    end_date = Column(Date, nullable=False, index=True)
    is_template = Column(Boolean, default=False, nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    household = relationship("Household", back_populates="meal_plans")
    slots = relationship("MealSlot", back_populates="meal_plan", cascade="all, delete-orphan")


class MealSlot(Base):
    __tablename__ = "meal_slots"

    id = Column(Integer, primary_key=True, index=True)
    meal_plan_id = Column(Integer, ForeignKey("meal_plans.id", ondelete="CASCADE"), nullable=False, index=True)
    slot_date = Column(Date, nullable=False, index=True)
    meal_type = Column(String(50), nullable=False)  # desayuno, almuerzo, comida, merienda, cena, otro
    servings = Column(Integer, default=4, nullable=False)
    notes = Column(Text, nullable=True)

    meal_plan = relationship("MealPlan", back_populates="slots")
    planned_recipes = relationship("PlannedRecipe", back_populates="slot", cascade="all, delete-orphan")


class PlannedRecipe(Base):
    __tablename__ = "planned_recipes"

    id = Column(Integer, primary_key=True, index=True)
    meal_slot_id = Column(Integer, ForeignKey("meal_slots.id", ondelete="CASCADE"), nullable=False, index=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="SET NULL"), nullable=True)
    custom_recipe_name = Column(String(200), nullable=True)
    servings = Column(Integer, default=4, nullable=False)
    is_cooked = Column(Boolean, default=False, nullable=False)

    slot = relationship("MealSlot", back_populates="planned_recipes")
    recipe = relationship("Recipe")


class Leftover(Base):
    __tablename__ = "leftovers"

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(150), nullable=False)
    recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="SET NULL"), nullable=True)
    portions = Column(Integer, default=1, nullable=False)
    location = Column(String(50), default="nevera", nullable=False)  # nevera, congelador
    date_stored = Column(Date, default=date.today, nullable=False)
    expiry_date = Column(Date, nullable=True)
    is_consumed = Column(Boolean, default=False, nullable=False)
    notes = Column(Text, nullable=True)
