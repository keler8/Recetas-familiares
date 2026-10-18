import os
import json
import socket
import smtplib
import ssl
import httpx
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.auth import User, AuditLog, Invitation, UserSession
from app.models.household import Household
from app.models.recipe import Recipe
from app.models.import_job import ImportBatch
from app.models.system import SystemSetting
from app.schemas.auth import UserCreate, UserResponse, UserUpdate, AdminResetPasswordRequest
from app.api.deps import get_current_admin
from app.services.auth_service import auth_service
from app.services.storage_guard import storage_guard
from app.services.backup_service import backup_service
from app.services.gemini_service import gemini_service
from app.services.drive_service import drive_service
from app.services.google_auth_service import google_auth_service
from app.services.notification_service import notification_service
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

    if u_up.username is not None and u_up.username.strip() != user.username:
        new_uname = u_up.username.strip()
        existing = db.query(User).filter(User.username.ilike(new_uname), User.id != user.id).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El nombre de usuario ya está en uso")
        user.username = new_uname

    if u_up.email is not None and u_up.email.strip().lower() != user.email.lower():
        new_email = u_up.email.strip().lower()
        existing = db.query(User).filter(User.email.ilike(new_email), User.id != user.id).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El correo electrónico ya está registrado")
        user.email = new_email

    if u_up.full_name is not None:
        user.full_name = u_up.full_name.strip() or None

    if u_up.role is not None and u_up.role in ["admin", "family"]:
        if user.role == "admin" and u_up.role != "admin":
            admin_count = db.query(User).filter(User.role == "admin", User.is_active == True).count()
            if admin_count <= 1:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se puede cambiar el rol al único administrador activo del sistema")
        user.role = u_up.role

    if u_up.is_active is not None:
        if user.id == admin.id and not u_up.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No puedes desactivar tu propia cuenta de administrador")
        if user.role == "admin" and not u_up.is_active:
            admin_count = db.query(User).filter(User.role == "admin", User.is_active == True).count()
            if admin_count <= 1:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se puede desactivar al único administrador activo del sistema")
        user.is_active = u_up.is_active

    if u_up.password:
        if len(u_up.password.strip()) < 6:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La contraseña debe tener al menos 6 caracteres")
        user.hashed_password = auth_service.get_password_hash(u_up.password.strip())

    if u_up.reset_mfa:
        user.mfa_enabled = False
        user.mfa_secret = None
        user.mfa_recovery_codes = None

    db.commit()
    db.refresh(user)
    return user


@router.post("/users/{user_id}/reset-password")
def reset_user_password(
    user_id: int,
    req: AdminResetPasswordRequest,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    if not req.new_password or len(req.new_password.strip()) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La contraseña debe tener al menos 6 caracteres")

    user.hashed_password = auth_service.get_password_hash(req.new_password.strip())
    # Revocar sesiones activas del usuario para exigir nuevo inicio de sesión
    db.query(UserSession).filter(UserSession.user_id == user.id).update({"is_revoked": True})
    db.commit()
    return {"success": True, "message": f"Contraseña actualizada para el usuario {user.username}"}


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    if user_id == admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No puedes eliminar tu propia cuenta de administrador")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    if user.role == "admin":
        admin_count = db.query(User).filter(User.role == "admin").count()
        if admin_count <= 1:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se puede eliminar al único administrador del sistema")

    # Transferir hogares compartidos creados por este usuario al administrador que ejecuta la acción
    shared_households = db.query(Household).filter(Household.owner_id == user.id, Household.is_personal == False).all()
    for sh in shared_households:
        sh.owner_id = admin.id

    # Eliminar hogares personales del usuario
    personal_households = db.query(Household).filter(Household.owner_id == user.id, Household.is_personal == True).all()
    for ph in personal_households:
        db.delete(ph)

    db.delete(user)
    db.commit()
    return {"success": True, "message": f"Usuario {user.username} eliminado correctamente"}


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


# ----------------------------------------------------
# Conectores e Integraciones Externas (Gemini, Drive, Synology, Telegram, SMTP)
# ----------------------------------------------------

@router.get("/connectors")
def get_all_connectors(
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    def get_setting(key: str, default: dict) -> dict:
        row = db.query(SystemSetting).filter(SystemSetting.key == key).first()
        if row and row.value:
            try:
                val = json.loads(row.value)
                merged = default.copy()
                merged.update(val)
                return merged
            except Exception:
                pass
        return default

    gemini_data = get_setting("connector_gemini", {
        "api_key": settings.GEMINI_API_KEY or "",
        "model": settings.GEMINI_MODEL,
        "monthly_budget": settings.AI_ESTIMATED_MONTHLY_BUDGET
    })
    gemini_data["is_configured"] = bool(gemini_data.get("api_key") and len(gemini_data["api_key"]) > 5)
    gemini_data["status"] = "Conectado a Gemini API" if gemini_data["is_configured"] else "Modo heurístico local"

    drive_data = get_setting("connector_drive", {
        "client_id": settings.GOOGLE_DRIVE_CLIENT_ID or "",
        "client_secret": settings.GOOGLE_DRIVE_CLIENT_SECRET or "",
        "redirect_uri": settings.GOOGLE_DRIVE_REDIRECT_URI
    })
    drive_srv = drive_service.load_from_db(db)
    drive_data["is_configured"] = drive_srv.is_configured
    drive_data["is_authorized"] = drive_srv.is_authorized
    drive_data["account_email"] = drive_srv.account_email
    drive_data["status"] = (
        f"Vinculado con {drive_srv.account_email}" if (drive_srv.is_authorized and drive_srv.account_email)
        else ("Vinculado a Google Drive" if drive_srv.is_authorized
        else ("Configurado (pendiente de vincular cuenta)" if drive_srv.is_configured
        else "Pendiente de credenciales Google Cloud"))
    )

    synology_data = get_setting("connector_synology", {
        "host": settings.SYNOLOGY_HOST or "192.168.1.8",
        "port": settings.SYNOLOGY_PORT or 5000,
        "user": settings.SYNOLOGY_USER or "",
        "password": settings.SYNOLOGY_PASSWORD or "",
        "backup_path": settings.SYNOLOGY_BACKUP_PATH or "/volume1/Backups/Recetario"
    })
    synology_data["is_configured"] = bool(synology_data.get("host") and synology_data.get("user"))
    synology_data["status"] = "Configurado" if synology_data["is_configured"] else "Pendiente de usuario/clave"

    telegram_data = get_setting("connector_telegram", {
        "is_active": bool(settings.TELEGRAM_BOT_TOKEN),
        "bot_token": settings.TELEGRAM_BOT_TOKEN or "",
        "chat_id": settings.TELEGRAM_CHAT_ID or ""
    })
    telegram_data["is_configured"] = bool(telegram_data.get("bot_token"))
    telegram_data["status"] = "Activo y configurado" if (telegram_data.get("is_active") and telegram_data.get("bot_token")) else "Inactivo o sin token"

    smtp_data = get_setting("connector_smtp", {
        "is_active": bool(settings.SMTP_HOST),
        "host": settings.SMTP_HOST or "",
        "port": settings.SMTP_PORT or 587,
        "user": settings.SMTP_USER or "",
        "password": settings.SMTP_PASSWORD or "",
        "from_email": settings.EMAILS_FROM_EMAIL or settings.SMTP_FROM or "",
        "use_tls": settings.SMTP_TLS
    })
    smtp_data["is_configured"] = bool(smtp_data.get("host"))
    smtp_data["status"] = "Activo y configurado" if (smtp_data.get("is_active") and smtp_data.get("host")) else "Inactivo o sin host"

    rules_data = get_setting("notification_rules", {
        "daily_menu_time": "08:30",
        "notify_pantry_expiry": True,
        "pantry_days_before": 3,
        "notify_storage_alert": True,
        "storage_threshold_gb": settings.DISK_MIN_FREE_GB
    })

    google_default_client_id = settings.GOOGLE_AUTH_CLIENT_ID or drive_data.get("client_id") or ""
    google_default_client_secret = settings.GOOGLE_AUTH_CLIENT_SECRET or drive_data.get("client_secret") or ""
    google_auth_data = get_setting("connector_google_auth", {
        "is_active": bool(google_default_client_id and google_default_client_secret),
        "client_id": google_default_client_id,
        "client_secret": google_default_client_secret,
        "redirect_uri": settings.GOOGLE_AUTH_REDIRECT_URI or "https://recetas.danesti.es/api/auth/google/callback",
        "auto_register": True,
        "allowed_domains": ""
    })
    google_auth_data["is_configured"] = bool(google_auth_data.get("client_id") and google_auth_data.get("client_secret"))
    google_auth_data["status"] = (
        "Activo y listo para iniciar sesión" if (google_auth_data.get("is_active") and google_auth_data["is_configured"])
        else ("Configurado pero inactivo" if google_auth_data["is_configured"] else "Pendiente de credenciales Google Cloud")
    )

    return {
        "gemini": gemini_data,
        "drive": drive_data,
        "google_auth": google_auth_data,
        "synology": synology_data,
        "telegram": telegram_data,
        "smtp": smtp_data,
        "notification_rules": rules_data
    }


@router.put("/connectors/{provider}")
def update_connector_config(
    provider: str,
    payload: Dict[str, Any],
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    valid_providers = ["gemini", "drive", "google_auth", "synology", "telegram", "smtp", "notification_rules"]
    if provider not in valid_providers:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Proveedor desconocido: {provider}")

    setting_key = "notification_rules" if provider == "notification_rules" else f"connector_{provider}"
    setting = db.query(SystemSetting).filter(SystemSetting.key == setting_key).first()
    if not setting:
        setting = SystemSetting(
            key=setting_key,
            description=f"Configuración del conector {provider}"
        )
        db.add(setting)

    setting.value = json.dumps(payload, ensure_ascii=False)
    db.commit()

    # Dynamic runtime refresh
    if provider == "gemini":
        gemini_service.update_credentials(
            api_key=payload.get("api_key"),
            model=payload.get("model")
        )
    elif provider == "drive":
        drive_service.update_credentials(
            client_id=payload.get("client_id"),
            client_secret=payload.get("client_secret"),
            redirect_uri=payload.get("redirect_uri")
        )
    elif provider == "google_auth":
        google_auth_service.update_credentials(
            is_active=payload.get("is_active"),
            client_id=payload.get("client_id"),
            client_secret=payload.get("client_secret"),
            redirect_uri=payload.get("redirect_uri"),
            auto_register=payload.get("auto_register"),
            allowed_domains=payload.get("allowed_domains")
        )
    elif provider == "synology":
        settings.SYNOLOGY_HOST = payload.get("host", settings.SYNOLOGY_HOST)
        settings.SYNOLOGY_PORT = int(payload.get("port") or settings.SYNOLOGY_PORT)
        settings.SYNOLOGY_USER = payload.get("user")
        settings.SYNOLOGY_PASSWORD = payload.get("password")
        settings.SYNOLOGY_BACKUP_PATH = payload.get("backup_path", settings.SYNOLOGY_BACKUP_PATH)
    elif provider == "telegram":
        settings.TELEGRAM_BOT_TOKEN = payload.get("bot_token")
        settings.TELEGRAM_CHAT_ID = payload.get("chat_id")
    elif provider == "smtp":
        settings.SMTP_HOST = payload.get("host")
        settings.SMTP_PORT = int(payload.get("port") or 587)
        settings.SMTP_USER = payload.get("user")
        settings.SMTP_PASSWORD = payload.get("password")
        settings.EMAILS_FROM_EMAIL = payload.get("from_email")
        settings.SMTP_TLS = payload.get("use_tls", True)

    return {"message": f"Conector '{provider}' actualizado con éxito", "data": payload}


@router.post("/connectors/gemini/test")
def test_gemini_connector(
    payload: Dict[str, Any] = {},
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    api_key = payload.get("api_key")
    model = payload.get("model")
    if not api_key:
        setting = db.query(SystemSetting).filter(SystemSetting.key == "connector_gemini").first()
        if setting and setting.value:
            try:
                data = json.loads(setting.value)
                api_key = data.get("api_key")
                model = model or data.get("model")
            except Exception:
                pass
    res = gemini_service.test_connection(api_key=api_key, model=model)
    return res


@router.post("/connectors/telegram/test")
def test_telegram_connector(
    payload: Dict[str, Any] = {},
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    bot_token = payload.get("bot_token")
    chat_id = payload.get("chat_id")
    if not bot_token:
        setting = db.query(SystemSetting).filter(SystemSetting.key == "connector_telegram").first()
        if setting and setting.value:
            try:
                data = json.loads(setting.value)
                bot_token = bot_token or data.get("bot_token")
                chat_id = chat_id or data.get("chat_id")
            except Exception:
                pass
        bot_token = bot_token or settings.TELEGRAM_BOT_TOKEN
        chat_id = chat_id or settings.TELEGRAM_CHAT_ID

    if not bot_token:
        return {"success": False, "error": "Falta el Token del Bot de Telegram (bot_token)."}

    try:
        url = f"https://api.telegram.org/bot{bot_token}/getMe"
        resp = httpx.get(url, timeout=7.0)
        if resp.status_code != 200:
            return {"success": False, "error": f"Error de Telegram ({resp.status_code}): {resp.text}"}
        bot_info = resp.json().get("result", {})
        bot_name = bot_info.get("first_name", "Bot")
        username = bot_info.get("username", "")

        msg = f"Bot verificado correctamente: @{username} ({bot_name})."
        if chat_id:
            send_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            send_resp = httpx.post(send_url, json={
                "chat_id": chat_id,
                "text": "🍳 *Recetario Familiar Inteligente*\n\n✅ ¡Conexión con Telegram verificada correctamente desde el panel de integraciones!",
                "parse_mode": "Markdown"
            }, timeout=7.0)
            if send_resp.status_code == 200:
                msg += f" Mensaje de prueba entregado con éxito al Chat ID: {chat_id}."
            else:
                return {"success": False, "error": f"Bot verificado pero falló el envío al Chat ID {chat_id}: {send_resp.text}"}

        return {"success": True, "message": msg, "bot_username": username}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/connectors/smtp/test")
def test_smtp_connector(
    payload: Dict[str, Any] = {},
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    host = payload.get("host")
    port = payload.get("port")
    user = payload.get("user")
    password = payload.get("password")
    use_tls = payload.get("use_tls", True)
    from_email = payload.get("from_email")
    test_email = payload.get("test_email") or admin.email

    if not host:
        setting = db.query(SystemSetting).filter(SystemSetting.key == "connector_smtp").first()
        if setting and setting.value:
            try:
                data = json.loads(setting.value)
                host = host or data.get("host")
                port = port or data.get("port")
                user = user or data.get("user")
                password = password or data.get("password")
                use_tls = data.get("use_tls", True) if use_tls is None else use_tls
                from_email = from_email or data.get("from_email")
            except Exception:
                pass
        host = host or settings.SMTP_HOST
        port = port or settings.SMTP_PORT or 587
        user = user or settings.SMTP_USER
        password = password or settings.SMTP_PASSWORD
        from_email = from_email or settings.EMAILS_FROM_EMAIL or user

    if not host:
        return {"success": False, "error": "Falta el servidor Host SMTP."}

    try:
        port = int(port or 587)
        if use_tls:
            context = ssl.create_default_context()
            with smtplib.SMTP(host, port, timeout=8) as server:
                server.ehlo()
                server.starttls(context=context)
                server.ehlo()
                if user and password:
                    server.login(user, password)
                if test_email and from_email:
                    from email.mime.text import MIMEText
                    msg = MIMEText("Hola,\n\nEste es un correo de prueba enviado desde tu Recetario Familiar Inteligente. La configuración SMTP y el envío de notificaciones funcionan perfectamente.\n\nSaludos,\nRecetario Familiar")
                    msg["Subject"] = "🍳 [Recetario Familiar] Prueba de Conexión SMTP Exitosa"
                    msg["From"] = f"Recetario Familiar <{from_email}>"
                    msg["To"] = test_email
                    server.sendmail(from_email, test_email, msg.as_string())
        else:
            with smtplib.SMTP(host, port, timeout=8) as server:
                server.ehlo()
                if user and password:
                    server.login(user, password)
                if test_email and from_email:
                    from email.mime.text import MIMEText
                    msg = MIMEText("Hola,\n\nEste es un correo de prueba enviado desde tu Recetario Familiar Inteligente. La configuración SMTP y el envío de notificaciones funcionan perfectamente.\n\nSaludos,\nRecetario Familiar")
                    msg["Subject"] = "🍳 [Recetario Familiar] Prueba de Conexión SMTP Exitosa"
                    msg["From"] = f"Recetario Familiar <{from_email}>"
                    msg["To"] = test_email
                    server.sendmail(from_email, test_email, msg.as_string())

        return {
            "success": True,
            "message": f"Conexión SMTP exitosa con {host}:{port}." + (f" Correo de prueba enviado a {test_email}." if test_email else "")
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/connectors/synology/test")
def test_synology_connector(
    payload: Dict[str, Any] = {},
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    host = payload.get("host")
    port = payload.get("port")
    if not host:
        setting = db.query(SystemSetting).filter(SystemSetting.key == "connector_synology").first()
        if setting and setting.value:
            try:
                data = json.loads(setting.value)
                host = data.get("host")
                port = data.get("port")
            except Exception:
                pass
        host = host or settings.SYNOLOGY_HOST
        port = port or settings.SYNOLOGY_PORT or 5000

    if not host:
        return {"success": False, "error": "Falta la dirección IP o host de Synology."}

    try:
        port = int(port or 5000)
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(4.0)
        result = sock.connect_ex((host, port))
        sock.close()
        if result == 0:
            return {
                "success": True,
                "message": f"Conexión de red establecida con éxito con el NAS Synology en {host}:{port}."
            }
        else:
            return {
                "success": False,
                "error": f"No se pudo conectar a {host}:{port} (código de error: {result}). Verifica la IP y puerto de DSM en tu red local."
            }
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/connectors/drive/test")
def test_drive_connector(
    payload: Dict[str, Any] = {},
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    client_id = payload.get("client_id")
    client_secret = payload.get("client_secret")
    redirect_uri = payload.get("redirect_uri")
    if not client_id or not client_secret:
        setting = db.query(SystemSetting).filter(SystemSetting.key == "connector_drive").first()
        if setting and setting.value:
            try:
                data = json.loads(setting.value)
                client_id = client_id or data.get("client_id")
                client_secret = client_secret or data.get("client_secret")
                redirect_uri = redirect_uri or data.get("redirect_uri")
            except Exception:
                pass
        client_id = client_id or settings.GOOGLE_DRIVE_CLIENT_ID
        client_secret = client_secret or settings.GOOGLE_DRIVE_CLIENT_SECRET
        redirect_uri = redirect_uri or settings.GOOGLE_DRIVE_REDIRECT_URI

    if not client_id or not client_secret:
        return {"success": False, "error": "Falta configurar Client ID y Client Secret de Google Cloud Console."}

    drive_srv = drive_service.load_from_db(db)
    drive_srv.update_credentials(client_id, client_secret, redirect_uri)
    auth_url = drive_srv.get_auth_url(redirect_uri=redirect_uri)
    msg = (
        f"Google Drive vinculado correctamente con {drive_srv.account_email}." if drive_srv.is_authorized
        else "Credenciales correctas. Pulsa 'Vincular Google Drive' para autorizar el acceso."
    )
    return {
        "success": True,
        "message": msg,
        "is_authorized": drive_srv.is_authorized,
        "auth_url": auth_url
    }


@router.post("/connectors/google_auth/test")
def test_google_auth_connector(
    payload: Dict[str, Any] = {},
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    service = google_auth_service.load_from_db(db)
    client_id = payload.get("client_id") or service.client_id
    client_secret = payload.get("client_secret") or service.client_secret
    service.update_credentials(client_id=client_id, client_secret=client_secret)
    res = service.test_connection()
    if not res.get("success"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=res.get("message"))
    return res


