from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey
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
