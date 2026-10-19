from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Float
)
from sqlalchemy.orm import relationship
from app.database import Base


class NutritionProfile(Base):
    __tablename__ = "nutrition_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    dietary_goals = Column(Text, nullable=True)  # JSON or text (e.g. ["mas_vegetales", "reducir_ultraprocesados"])
    cooking_habits = Column(Text, nullable=True)
    available_time_min = Column(Integer, default=45, nullable=False)
    meal_frequency = Column(Integer, default=3, nullable=False)
    physical_activity = Column(String(50), nullable=True)  # ligera, moderada, alta
    sex = Column(String(20), nullable=True)  # hombre, mujer
    age = Column(Integer, nullable=True)
    weight_kg = Column(Float, nullable=True)
    height_cm = Column(Float, nullable=True)
    dietary_goal = Column(String(50), nullable=True)  # deficit, mantenimiento, superavit, saludable
    target_calories = Column(Integer, nullable=True)
    calorie_offset = Column(Integer, default=0, nullable=False)
    preferred_foods = Column(Text, nullable=True)
    excluded_foods = Column(Text, nullable=True)
    focus_on_healthy = Column(Boolean, default=True, nullable=False)
    notes = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="nutrition_profile")


class NutritionConsent(Base):
    __tablename__ = "nutrition_consents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    ai_data_consent = Column(Boolean, default=False, nullable=False)
    consent_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    revoked_date = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="nutrition_consent")


class DietitianReport(Base):
    __tablename__ = "dietitian_reports"

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    diner_id = Column(Integer, ForeignKey("diners.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(200), default="Informe de Nutricionista", nullable=False)
    patient_name = Column(String(150), nullable=True)
    target_calories = Column(Integer, nullable=True)
    dietary_goal = Column(String(100), nullable=True)
    habits = Column(Text, nullable=True)
    dietary_guidelines = Column(Text, nullable=True)  # JSON string list of guidelines/tips
    preferred_foods = Column(Text, nullable=True)
    excluded_foods = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    raw_plan_data = Column(Text, nullable=True)  # JSON string list of days/meals
    created_recipes_ids = Column(Text, nullable=True)  # JSON string list of recipe IDs
    household_servings = Column(Integer, default=2, nullable=False)
    version = Column(Integer, default=1, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    household = relationship("Household")
    user = relationship("User")
    diner = relationship("Diner")
