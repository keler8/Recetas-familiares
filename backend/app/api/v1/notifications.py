import json
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.auth import User, UserPreferences
from app.models.system import Notification
from app.api.deps import get_current_user
from app.services.notification_service import notification_service

router = APIRouter(prefix="/notifications", tags=["Notificaciones"])


@router.get("")
def list_notifications(
    limit: int = Query(30, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Seed a welcome notification if user has zero notifications
    count_total = db.query(Notification).filter(Notification.user_id == current_user.id).count()
    if count_total == 0:
        notification_service.create_in_app_notification(
            db=db,
            user_id=current_user.id,
            title="¡Bienvenido a tu Recetario!",
            message="Tu aplicación ya está configurada con doble factor, biblioteca de recetas y asistente dietético familiar. Explora las secciones desde el menú.",
            category="system"
        )

    unread_count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).count()

    items = db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).order_by(desc(Notification.created_at)).limit(limit).all()

    return {
        "unread_count": unread_count,
        "notifications": [
            {
                "id": n.id,
                "title": n.title,
                "message": n.message,
                "category": n.category,
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat()
            }
            for n in items
        ]
    }


@router.post("/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    if not notif:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notificación no encontrada")

    notif.is_read = True
    db.commit()
    return {"message": "Notificación marcada como leída", "id": notification_id}


@router.post("/mark-all-read")
def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"message": "Todas las notificaciones marcadas como leídas"}


@router.delete("/{notification_id}")
def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    if not notif:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notificación no encontrada")

    db.delete(notif)
    db.commit()
    return {"message": "Notificación eliminada"}


@router.get("/preferences")
def get_user_notification_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    prefs = db.query(UserPreferences).filter(UserPreferences.user_id == current_user.id).first()
    default_channels = {
        "in_app": True,
        "email": True,
        "telegram": False,
        "push": True,
        "daily_menu": True,
        "pantry_expiry": True,
        "storage_alerts": True
    }
    if prefs and prefs.notification_channels:
        try:
            saved = json.loads(prefs.notification_channels)
            default_channels.update(saved)
        except Exception:
            pass
    return default_channels


@router.put("/preferences")
def update_user_notification_preferences(
    preferences_in: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    prefs = db.query(UserPreferences).filter(UserPreferences.user_id == current_user.id).first()
    if not prefs:
        prefs = UserPreferences(user_id=current_user.id)
        db.add(prefs)

    # In-app bell is mandatory
    preferences_in["in_app"] = True
    prefs.notification_channels = json.dumps(preferences_in)
    db.commit()
    return {"message": "Preferencias de notificación guardadas", "preferences": preferences_in}
