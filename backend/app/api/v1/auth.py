from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.config import settings
from app.models.auth import User, UserSession, UserPreferences
from app.schemas.auth import (
    Token, LoginRequest, MfaVerifyRequest, MfaSetupResponse,
    UserResponse, UserPreferencesSchema
)
from app.services.auth_service import auth_service
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Autenticación"])


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
            return Token(access_token="", mfa_required=True, mfa_token=mfa_token)
        else:
            # MFA verification required
            mfa_token = auth_service.create_access_token(
                {"sub": str(user.id), "mfa_pending": True},
                expires_delta=timedelta(minutes=10)
            )
            return Token(access_token="", mfa_required=True, mfa_token=mfa_token)

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
    prefs_in: UserPreferencesSchema,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    prefs = db.query(UserPreferences).filter(UserPreferences.user_id == current_user.id).first()
    if not prefs:
        prefs = UserPreferences(user_id=current_user.id)
        db.add(prefs)

    prefs.theme = prefs_in.theme
    prefs.language = prefs_in.language
    prefs.default_servings = prefs_in.default_servings
    if prefs_in.widgets_config:
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
