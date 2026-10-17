import os
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    PROJECT_NAME: str = "Recetario Familiar Inteligente"
    ENVIRONMENT: str = "production"
    SERVER_IP: str = "192.168.1.80"
    HOST_PORT: int = 8500
    EXTERNAL_URL: str = "http://192.168.1.80:8500"

    # Security
    SECRET_KEY: str = "default_secret_key_change_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    COOKIE_SECURE: bool = False  # Set to True if accessed via HTTPS proxy

    # Database
    POSTGRES_SERVER: str = "postgres"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "recetario_app"
    POSTGRES_PASSWORD: str = "recetario_pass_2026"
    POSTGRES_DB: str = "recetario_db"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # Storage paths and limits
    STORAGE_PATH: str = "/app/data/storage"
    TEMP_PATH: str = "/app/data/tmp"
    BACKUP_PATH: str = "/app/data/backups"
    DISK_MIN_FREE_GB: float = 4.0

    # Initial Admin Setup
    INITIAL_ADMIN_EMAIL: str = "admin@recetas.local"
    INITIAL_ADMIN_USERNAME: str = "admin"
    INITIAL_ADMIN_PASSWORD: str = "AdminRecetas_2026!"

    # Gemini AI
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-2.5-flash"
    AI_ESTIMATED_MONTHLY_BUDGET: float = 10.0

    # Google Drive OAuth
    GOOGLE_DRIVE_CLIENT_ID: Optional[str] = None
    GOOGLE_DRIVE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_DRIVE_REDIRECT_URI: str = "http://192.168.1.80:8500/api/drive/callback"

    # SMTP Notifications
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM: str = "recetas@familiar.local"
    SMTP_TLS: bool = True

    # Synology NAS
    SYNOLOGY_HOST: str = "192.168.1.8"
    SYNOLOGY_PORT: int = 5000
    SYNOLOGY_USER: Optional[str] = None
    SYNOLOGY_PASSWORD: Optional[str] = None
    SYNOLOGY_BACKUP_PATH: str = "/volume1/Backups/Recetario"

    @property
    def database_url(self) -> str:
        # Use psycopg2
        return (
            f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@"
            f"{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )


settings = Settings()
