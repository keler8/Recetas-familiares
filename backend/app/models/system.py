from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey, BigInteger
)
from app.database import Base


class IntegrationConnection(Base):
    __tablename__ = "integration_connections"

    id = Column(Integer, primary_key=True, index=True)
    provider = Column(String(50), unique=True, index=True, nullable=False)  # google_drive, gemini, synology, smtp
    is_active = Column(Boolean, default=False, nullable=False)
    status_message = Column(String(255), default="Pendiente de configuración", nullable=False)
    last_tested_at = Column(DateTime, nullable=True)
    config_json = Column(Text, nullable=True)  # Non-secret metadata or encrypted configs
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=True, index=True)
    title = Column(String(150), nullable=False)
    message = Column(Text, nullable=False)
    category = Column(String(50), default="system", nullable=False)  # timer, expiry, import, system, invitation
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)


class BackupJob(Base):
    __tablename__ = "backup_jobs"

    id = Column(Integer, primary_key=True, index=True)
    status = Column(String(50), default="running", nullable=False)  # running, success, failed
    filename = Column(String(255), nullable=False)
    drive_uploaded = Column(Boolean, default=False, nullable=False)
    synology_uploaded = Column(Boolean, default=False, nullable=False)
    file_size_bytes = Column(BigInteger, default=0, nullable=False)
    backup_hash = Column(String(64), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key = Column(String(100), primary_key=True, index=True)
    value = Column(Text, nullable=True)
    description = Column(String(255), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
