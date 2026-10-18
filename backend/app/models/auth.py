import enum
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Enum as SQLEnum, Table
)
from sqlalchemy.orm import relationship
from app.database import Base


class RoleEnum(str, enum.Enum):
    ADMIN = "admin"
    FAMILY = "family"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(150), nullable=True)
    role = Column(String(50), default="family", nullable=False)  # admin / family
    is_active = Column(Boolean, default=True, nullable=False)
    google_id = Column(String(100), unique=True, index=True, nullable=True)
    avatar_url = Column(Text, nullable=True)
    
    # 2FA / TOTP
    mfa_enabled = Column(Boolean, default=False, nullable=False)
    mfa_secret = Column(String(100), nullable=True)
    mfa_recovery_codes = Column(Text, nullable=True)  # JSON list of hashed recovery codes
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    memberships = relationship("HouseholdMembership", back_populates="user", cascade="all, delete-orphan")
    preferences = relationship("UserPreferences", back_populates="user", uselist=False, cascade="all, delete-orphan")
    nutrition_profile = relationship("NutritionProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    nutrition_consent = relationship("NutritionConsent", back_populates="user", uselist=False, cascade="all, delete-orphan")


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    session_token = Column(String(255), unique=True, index=True, nullable=False)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(255), nullable=True)
    is_revoked = Column(Boolean, default=False, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="sessions")


class Invitation(Base):
    __tablename__ = "invitations"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), index=True, nullable=False)
    invitation_token = Column(String(255), unique=True, index=True, nullable=False)
    role = Column(String(50), default="family", nullable=False)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=True)
    invited_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    is_accepted = Column(Boolean, default=False, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class UserPreferences(Base):
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    theme = Column(String(20), default="dark", nullable=False)  # dark, light, auto
    language = Column(String(10), default="es", nullable=False)  # es, eu
    default_servings = Column(Integer, default=4, nullable=False)
    widgets_config = Column(Text, nullable=True)  # JSON config for home screen
    notification_channels = Column(Text, nullable=True)  # JSON config for notification channels

    user = relationship("User", back_populates="preferences")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(100), nullable=False)  # e.g., 'ADMIN_READ_PRIVATE_HOUSEHOLD'
    entity_type = Column(String(50), nullable=False)  # e.g., 'household', 'pantry', 'nutrition'
    entity_id = Column(String(100), nullable=True)
    household_id = Column(Integer, nullable=True, index=True)
    details = Column(Text, nullable=True)
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
