import os
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.auth import User, AuditLog, Invitation
from app.models.household import Household
from app.models.recipe import Recipe
from app.models.import_job import ImportBatch
from app.models.system import SystemSetting
from app.schemas.auth import UserCreate, UserResponse, UserUpdate
from app.api.deps import get_current_admin
from app.services.auth_service import auth_service
from app.services.storage_guard import storage_guard
from app.services.backup_service import backup_service
from app.services.gemini_service import gemini_service
from app.services.drive_service import drive_service
from app.config import settings

router = APIRouter(prefix="/admin", tags=["Administración Global"])


@router.get("/stats")
def get_admin_stats(
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    total_users = db.query(func.count(User.id)).scalar()
    total_recipes = db.query(func.count(Recipe.id)).scalar()
    total_households = db.query(func.count(Household.id)).scalar()
    total_imports = db.query(func.count(ImportBatch.id)).scalar()

    disk_stats = storage_guard.get_disk_usage()

    return {
        "counts": {
            "users": total_users,
            "recipes": total_recipes,
            "households": total_households,
            "imports": total_imports
        },
        "storage": disk_stats,
        "environment": {
            "project_name": settings.PROJECT_NAME,
            "environment": settings.ENVIRONMENT,
            "server_ip": settings.SERVER_IP,
            "host_port": settings.HOST_PORT,
            "disk_min_threshold_gb": settings.DISK_MIN_FREE_GB
        }
    }


@router.get("/integrations")
def get_integrations_status(
    admin: User = Depends(get_current_admin)
):
    return {
        "gemini": {
            "name": "Google Gemini AI",
            "is_configured": gemini_service.is_configured(),
            "model": settings.GEMINI_MODEL,
            "status": "Operativo (Conectado a Gemini API)" if gemini_service.is_configured() else "Modo local heurístico (Sin clave API)",
            "estimated_monthly_budget": settings.AI_ESTIMATED_MONTHLY_BUDGET
        },
        "drive": {
            "name": "Google Drive",
            "is_configured": drive_service.is_configured(),
            "status": "Configurado" if drive_service.is_configured() else "Pendiente de credenciales OAuth",
            "redirect_uri": settings.GOOGLE_DRIVE_REDIRECT_URI
        },
        "synology": {
            "name": "Synology NAS (Segunda Copia)",
            "is_configured": bool(settings.SYNOLOGY_USER and settings.SYNOLOGY_PASSWORD),
            "host": settings.SYNOLOGY_HOST,
            "port": settings.SYNOLOGY_PORT,
            "status": "Configurado" if (settings.SYNOLOGY_USER and settings.SYNOLOGY_PASSWORD) else "Pendiente de credenciales de usuario Synology"
        },
        "smtp": {
            "name": "Servidor de Correo SMTP",
            "is_configured": bool(settings.SMTP_HOST),
            "status": "Configurado" if settings.SMTP_HOST else "No configurado (Avisos solo en aplicación)"
        }
    }


@router.get("/audit-logs")
def get_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()
    results = []
    for l in logs:
        user_name = l.user_id
        results.append({
            "id": l.id,
            "user_id": l.user_id,
            "action": l.action,
            "entity_type": l.entity_type,
            "entity_id": l.entity_id,
            "household_id": l.household_id,
            "details": l.details,
            "ip_address": l.ip_address,
            "created_at": l.created_at
        })
    return results


# User Management
@router.get("/users", response_model=List[UserResponse])
def list_all_users(
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    users = db.query(User).order_by(User.created_at.asc()).all()
    return users


@router.post("/users", response_model=UserResponse)
def create_new_user(
    u_in: UserCreate,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    existing = db.query(User).filter(
        (User.email.ilike(u_in.email.strip())) | (User.username.ilike(u_in.username.strip()))
    ).first()

    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El email o nombre de usuario ya está registrado")

    new_user = User(
        email=u_in.email.strip().lower(),
        username=u_in.username.strip(),
        full_name=u_in.full_name,
        role=u_in.role if u_in.role in ["admin", "family"] else "family",
        hashed_password=auth_service.get_password_hash(u_in.password),
        is_active=True
    )
    db.add(new_user)
    db.flush()

    # Automatically create personal household for user
    hh = Household(
        name=f"Hogar de {new_user.full_name or new_user.username}",
        owner_id=new_user.id,
        is_personal=True
    )
    db.add(hh)
    db.flush()

    from app.models.household import HouseholdMembership
    db.add(HouseholdMembership(
        household_id=hh.id,
        user_id=new_user.id,
        role="owner"
    ))

    db.commit()
    db.refresh(new_user)
    return new_user


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user_status(
    user_id: int,
    u_up: UserUpdate,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    if u_up.is_active is not None:
        user.is_active = u_up.is_active
    if u_up.full_name is not None:
        user.full_name = u_up.full_name
    if u_up.email is not None:
        user.email = u_up.email
    if u_up.password:
        user.hashed_password = auth_service.get_password_hash(u_up.password)

    db.commit()
    db.refresh(user)
    return user


# Backups
@router.get("/backups")
def list_backups(
    admin: User = Depends(get_current_admin)
):
    return backup_service.list_backups()


@router.post("/backups/create")
def trigger_backup(
    admin: User = Depends(get_current_admin)
):
    res = backup_service.create_database_backup()
    if not res.get("success"):
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=res.get("error"))
    return res


@router.post("/storage/cleanup")
def trigger_storage_cleanup(
    admin: User = Depends(get_current_admin)
):
    deleted = storage_guard.cleanup_old_temp_files(max_age_seconds=0)  # clean all temp files
    return {"message": f"Limpieza completada. {deleted} archivos/directorios temporales eliminados."}


# Recipe & Tags Customization
@router.get("/recipe-config")
def get_admin_recipe_config(
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    from app.api.v1.recipes import DEFAULT_RECIPE_CONFIG
    import json
    setting = db.query(SystemSetting).filter(SystemSetting.key == "recipe_config").first()
    if setting and setting.value:
        try:
            return json.loads(setting.value)
        except Exception:
            pass
    return DEFAULT_RECIPE_CONFIG


@router.put("/recipe-config")
def update_admin_recipe_config(
    config_in: Dict[str, Any],
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    import json
    setting = db.query(SystemSetting).filter(SystemSetting.key == "recipe_config").first()
    if not setting:
        setting = SystemSetting(
            key="recipe_config",
            description="Configuración global de momentos de comida y etiquetas de recetas"
        )
        db.add(setting)

    setting.value = json.dumps(config_in, ensure_ascii=False)
    db.commit()
    return {"message": "Configuración de recetas y etiquetas actualizada con éxito", "config": config_in}

