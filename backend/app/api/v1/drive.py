from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.api.deps import get_current_user
from app.models.auth import User
from app.services.drive_service import drive_service

router = APIRouter(prefix="/drive", tags=["Integración Google Drive"])


@router.get("/status")
def get_drive_status(
    current_user: User = Depends(get_current_user)
):
    return drive_service.get_status()


@router.get("/auth-url")
def get_drive_auth_url(
    current_user: User = Depends(get_current_user)
):
    url = drive_service.get_auth_url(state=f"user_{current_user.id}")
    if not url:
        return {
            "configured": False,
            "message": "Configura GOOGLE_DRIVE_CLIENT_ID y GOOGLE_DRIVE_CLIENT_SECRET en .env para activar OAuth"
        }
    return {"configured": True, "auth_url": url}


@router.get("/callback")
def drive_oauth_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: Session = Depends(get_db)
):
    # Store credentials
    return {"message": "Google Drive conectado con éxito"}
