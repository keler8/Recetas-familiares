import base64
import json
import secrets
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import quote
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.config import settings
from app.models.auth import User, UserSession, UserPreferences
from app.schemas.auth import (
    Token, LoginRequest, MfaVerifyRequest, MfaSetupResponse,
    UserResponse, UserPreferencesSchema, UserPreferencesUpdate, ChangePasswordRequest, UserProfileUpdateRequest
)
from app.services.auth_service import auth_service
from app.services.google_auth_service import google_auth_service
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Autenticación"])


class GoogleTokenVerifyRequest(BaseModel):
    credential: str


@router.post("/login", response_model=Token)
def login(
    req: LoginRequest,
    response: Response,
    request: Request,
    db: Session = Depends(get_db)
):
    login_str = req.username_or_email.strip().lower()
    user = db.query(User).filter(
        (User.email.ilike(login_str)) | (User.username.ilike(login_str))
    ).first()

    if not user or not auth_service.verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales no válidas",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cuenta desactivada")

    # Admins MUST have 2FA. If user has MFA enabled or is admin:
    if user.mfa_enabled or user.role == "admin":
        if not user.mfa_enabled:
            # First time admin login: force MFA setup
            mfa_token = auth_service.create_access_token(
                {"sub": str(user.id), "mfa_pending": True, "force_setup": True},
                expires_delta=timedelta(minutes=15)
            )
            return Token(
                access_token="",
                mfa_required=True,
                mfa_setup_required=True,
                mfa_token=mfa_token
            )
        else:
            # Normal 2FA verification: ONLY ask for TOTP code, DO NOT ask to setup QR again!
            mfa_token = auth_service.create_access_token(
                {"sub": str(user.id), "mfa_pending": True},
                expires_delta=timedelta(minutes=10)
            )
            return Token(
                access_token="",
                mfa_required=True,
                mfa_setup_required=False,
                mfa_token=mfa_token
            )

    # Standard direct login
    token = auth_service.create_access_token({"sub": str(user.id), "role": user.role})
    
    # Set HttpOnly cookie for security
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.COOKIE_SECURE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

    return Token(access_token=token, mfa_required=False, user=UserResponse.model_validate(user))


@router.post("/mfa/verify", response_model=Token)
def verify_mfa(
    req: MfaVerifyRequest,
    response: Response,
    db: Session = Depends(get_db)
):
    payload = auth_service.decode_token(req.mfa_token)
    if not payload or not payload.get("mfa_pending"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token MFA expirado o no válido")

    user_id = int(payload.get("sub"))
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    verified = False
    if req.totp_code and user.mfa_secret:
        verified = auth_service.verify_totp(user.mfa_secret, req.totp_code.strip())

    if not verified and req.recovery_code:
        valid_rec, new_codes_json = auth_service.verify_and_consume_recovery_code(
            req.recovery_code.strip(), user.mfa_recovery_codes
        )
        if valid_rec:
            verified = True
            user.mfa_recovery_codes = new_codes_json
            db.commit()

    if not verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Código TOTP o código de recuperación no válido"
        )

    # CRITICAL: Activate MFA if it was pending setup, so subsequent logins never request QR setup!
    if not user.mfa_enabled:
        user.mfa_enabled = True
        db.commit()

    # Generate full access token
    token = auth_service.create_access_token({"sub": str(user.id), "role": user.role})
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.COOKIE_SECURE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

    return Token(access_token=token, mfa_required=False, user=UserResponse.model_validate(user))


@router.post("/mfa/setup", response_model=MfaSetupResponse)
def setup_mfa(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    secret = auth_service.generate_totp_secret()
    uri = auth_service.get_totp_uri(secret, current_user.username)
    qr_code = auth_service.generate_qr_code_base64(uri)
    plain_codes, hashed_json = auth_service.generate_recovery_codes(8)

    # Temporarily save secret and codes until verified
    current_user.mfa_secret = secret
    current_user.mfa_recovery_codes = hashed_json
    db.commit()

    return MfaSetupResponse(
        secret=secret,
        qr_code_base64=qr_code,
        recovery_codes=plain_codes
    )


@router.post("/mfa/confirm")
def confirm_mfa(
    totp_code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.mfa_secret:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Primero inicia /mfa/setup")

    if not auth_service.verify_totp(current_user.mfa_secret, totp_code.strip()):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Código TOTP no válido")

    current_user.mfa_enabled = True
    db.commit()
    return {"message": "Doble factor (TOTP) activado con éxito"}


@router.get("/me", response_model=UserResponse)
def get_me(
    current_user: User = Depends(get_current_user)
):
    return current_user


@router.put("/me", response_model=UserResponse)
def update_me(
    req: UserProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if req.full_name is not None:
        current_user.full_name = req.full_name.strip()
    if req.email is not None and req.email.strip():
        new_email = req.email.strip().lower()
        # Verify email uniqueness
        existing = db.query(User).filter(User.email == new_email, User.id != current_user.id).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El correo electrónico ya está en uso")
        current_user.email = new_email

    current_user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/change-password")
def change_password(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not auth_service.verify_password(req.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La contraseña actual no es correcta")

    if len(req.new_password) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La nueva contraseña debe tener al menos 6 caracteres")

    current_user.hashed_password = auth_service.get_password_hash(req.new_password)
    current_user.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Contraseña actualizada correctamente"}


@router.post("/mfa/disable")
def disable_mfa(
    totp_code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.mfa_enabled:
        return {"message": "2FA ya estaba desactivado"}
    
    if not current_user.mfa_secret or not auth_service.verify_totp(current_user.mfa_secret, totp_code.strip()):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Código TOTP no válido para desactivar 2FA")

    current_user.mfa_enabled = False
    current_user.mfa_secret = None
    current_user.mfa_recovery_codes = None
    db.commit()
    return {"message": "Doble factor desactivado"}


@router.get("/preferences", response_model=UserPreferencesSchema)
def get_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    prefs = db.query(UserPreferences).filter(UserPreferences.user_id == current_user.id).first()
    if not prefs:
        prefs = UserPreferences(user_id=current_user.id, theme="dark", language="es", default_servings=4)
        db.add(prefs)
        db.commit()
        db.refresh(prefs)
    return prefs


@router.put("/preferences", response_model=UserPreferencesSchema)
def update_preferences(
    prefs_in: UserPreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    prefs = db.query(UserPreferences).filter(UserPreferences.user_id == current_user.id).first()
    if not prefs:
        prefs = UserPreferences(user_id=current_user.id)
        db.add(prefs)

    if prefs_in.theme is not None:
        prefs.theme = prefs_in.theme
    if prefs_in.language is not None:
        prefs.language = prefs_in.language
    if prefs_in.default_servings is not None:
        prefs.default_servings = prefs_in.default_servings
    if prefs_in.widgets_config is not None:
        prefs.widgets_config = prefs_in.widgets_config
    if prefs_in.notification_channels is not None:
        prefs.notification_channels = prefs_in.notification_channels

    db.commit()
    db.refresh(prefs)
    return prefs


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(key="access_token")
    return {"message": "Sesión cerrada correctamente"}


# ----------------------------------------------------
# Google OAuth2 Login & SSO
# ----------------------------------------------------

@router.get("/google/config")
def get_google_auth_config(db: Session = Depends(get_db)):
    service = google_auth_service.load_from_db(db)
    return {
        "enabled": service.is_enabled(),
        "client_id": service.client_id if service.is_enabled() else None
    }


@router.get("/google/login")
def google_login(
    request: Request,
    origin: Optional[str] = None,
    db: Session = Depends(get_db)
):
    service = google_auth_service.load_from_db(db)
    if not service.is_enabled():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inicio de sesión con Google no está activo o configurado en Conectores"
        )

    client_origin = origin or request.headers.get("referer") or str(request.base_url).rstrip("/")
    # Clean client_origin if ends with /login
    if client_origin.endswith("/login"):
        client_origin = client_origin[:-6]

    state_data = {
        "nonce": secrets.token_hex(16),
        "origin": client_origin
    }
    state_str = base64.urlsafe_b64encode(json.dumps(state_data).encode()).decode()
    auth_url = service.get_auth_url(state=state_str)
    if not auth_url:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No se pudo generar la URL de autenticación de Google")
    return RedirectResponse(url=auth_url)


@router.get("/google/callback")
def google_callback(
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: Session = Depends(get_db)
):
    service = google_auth_service.load_from_db(db)

    # Resolve target frontend base URL
    frontend_base = "/login"
    if state:
        try:
            state_data = json.loads(base64.urlsafe_b64decode(state.encode()).decode())
            if state_data.get("origin"):
                frontend_base = f"{state_data['origin']}/login"
        except Exception:
            pass

    if error:
        return RedirectResponse(url=f"{frontend_base}?error={quote(f'Google OAuth: {error}')}")

    if not code:
        return RedirectResponse(url=f"{frontend_base}?error={quote('No se recibió código de autorización de Google')}")

    try:
        token_data = service.exchange_code(code)
        access_token = token_data.get("access_token")
        if not access_token:
            return RedirectResponse(url=f"{frontend_base}?error={quote('No se pudo obtener el token de acceso de Google')}")

        user_info = service.get_user_info(access_token)
        email = user_info.get("email")
        if not email:
            return RedirectResponse(url=f"{frontend_base}?error={quote('No se pudo obtener la dirección de correo de Google')}")

        email = email.strip().lower()
        name = user_info.get("name") or email.split("@")[0]
        picture = user_info.get("picture")
        google_id = str(user_info.get("sub", ""))

        # Check allowed domains if restricted
        if service.allowed_domains:
            allowed = [d.strip().lower().lstrip("@") for d in service.allowed_domains.split(",") if d.strip()]
            user_domain = email.split("@")[-1].lower()
            if allowed and user_domain not in allowed:
                return RedirectResponse(url=f"{frontend_base}?error={quote('Dominio de correo no autorizado para este recetario')}")

        # Find user by google_id or email
        user = db.query(User).filter((User.google_id == google_id) | (User.email == email)).first()

        if not user:
            if not service.auto_register:
                return RedirectResponse(url=f"{frontend_base}?error={quote('Tu cuenta de Google no está registrada en el recetario. Solicita acceso al administrador.')}")

            # Generate unique username
            base_username = email.split("@")[0].replace(".", "_")
            username = base_username
            counter = 1
            while db.query(User).filter(User.username == username).first():
                username = f"{base_username}_{counter}"
                counter += 1

            user = User(
                email=email,
                username=username,
                full_name=name,
                hashed_password=auth_service.get_password_hash(secrets.token_urlsafe(32)),
                role="family",
                is_active=True,
                google_id=google_id,
                avatar_url=picture,
                mfa_enabled=False
            )
            db.add(user)
            db.flush()

            # Create personal household for user
            from app.models.household import Household, HouseholdMembership
            hh = Household(
                name=f"Hogar de {user.full_name or user.username}",
                owner_id=user.id,
                is_personal=True
            )
            db.add(hh)
            db.flush()
            db.add(HouseholdMembership(household_id=hh.id, user_id=user.id, role="owner"))
            db.commit()
            db.refresh(user)
        else:
            if not user.is_active:
                return RedirectResponse(url=f"{frontend_base}?error={quote('Tu cuenta de usuario está desactivada')}")

            # Update google_id and avatar if missing
            needs_update = False
            if not user.google_id and google_id:
                user.google_id = google_id
                needs_update = True
            if picture and not user.avatar_url:
                user.avatar_url = picture
                needs_update = True
            if needs_update:
                db.commit()

        # Generate system access token
        system_token = auth_service.create_access_token({"sub": str(user.id), "role": user.role})
        return RedirectResponse(url=f"{frontend_base}?google_token={system_token}")

    except Exception as e:
        return RedirectResponse(url=f"{frontend_base}?error={quote(str(e))}")


@router.post("/google/token", response_model=Token)
def verify_google_token_endpoint(
    req: GoogleTokenVerifyRequest,
    db: Session = Depends(get_db)
):
    service = google_auth_service.load_from_db(db)
    if not service.is_enabled():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inicio de sesión con Google no está activo o configurado"
        )

    try:
        data = service.verify_id_token(req.credential)
        email = data.get("email", "").strip().lower()
        if not email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se pudo obtener el email del token")

        google_id = str(data.get("sub", ""))
        name = data.get("name") or email.split("@")[0]
        picture = data.get("picture")

        if service.allowed_domains:
            allowed = [d.strip().lower().lstrip("@") for d in service.allowed_domains.split(",") if d.strip()]
            user_domain = email.split("@")[-1].lower()
            if allowed and user_domain not in allowed:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Dominio de correo no autorizado")

        user = db.query(User).filter((User.google_id == google_id) | (User.email == email)).first()
        if not user:
            if not service.auto_register:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Tu cuenta de Google no está registrada en el recetario"
                )

            base_username = email.split("@")[0].replace(".", "_")
            username = base_username
            counter = 1
            while db.query(User).filter(User.username == username).first():
                username = f"{base_username}_{counter}"
                counter += 1

            user = User(
                email=email,
                username=username,
                full_name=name,
                hashed_password=auth_service.get_password_hash(secrets.token_urlsafe(32)),
                role="family",
                is_active=True,
                google_id=google_id,
                avatar_url=picture,
                mfa_enabled=False
            )
            db.add(user)
            db.flush()

            from app.models.household import Household, HouseholdMembership
            hh = Household(
                name=f"Hogar de {user.full_name or user.username}",
                owner_id=user.id,
                is_personal=True
            )
            db.add(hh)
            db.flush()
            db.add(HouseholdMembership(household_id=hh.id, user_id=user.id, role="owner"))
            db.commit()
            db.refresh(user)
        else:
            if not user.is_active:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuario desactivado")
            if not user.google_id and google_id:
                user.google_id = google_id
                db.commit()

        token = auth_service.create_access_token({"sub": str(user.id), "role": user.role})
        return Token(
            access_token=token,
            token_type="bearer",
            mfa_required=False,
            user=UserResponse.model_validate(user)
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

