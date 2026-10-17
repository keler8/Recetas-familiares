from typing import Optional, Generator
from fastapi import Depends, HTTPException, status, Header, Cookie, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.auth import User
from app.models.household import Household, HouseholdMembership
from app.services.auth_service import auth_service
from app.services.audit_service import audit_service

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token", auto_error=False)


def get_current_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
    access_token_cookie: Optional[str] = Cookie(None, alias="access_token"),
    db: Session = Depends(get_db)
) -> User:
    jwt_token = token or access_token_cookie
    if not jwt_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No autenticado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = auth_service.decode_token(jwt_token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token no válido o caducado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token no contiene sujeto")

    if payload.get("mfa_pending"):
        path = request.url.path
        if not (path.endswith("/mfa/setup") or path.endswith("/mfa/confirm")):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Autenticación en dos pasos pendiente",
                headers={"WWW-Authenticate": "Bearer"},
            )
    
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuario inactivo")
    
    return user


def get_current_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permisos de administrador requeridos"
        )
    return current_user


def get_current_household(
    request: Request,
    x_household_id: Optional[str] = Header(None, alias="X-Household-ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Household:
    """
    Retrieves the selected household. Checks membership or admin access.
    Logs audit record if administrator accesses a private household they are not member of.
    """
    household = None
    if x_household_id:
        try:
            hid = int(x_household_id)
            household = db.query(Household).filter(Household.id == hid).first()
        except ValueError:
            pass

    if not household:
        # Fallback to user's first household
        membership = db.query(HouseholdMembership).filter(HouseholdMembership.user_id == current_user.id).first()
        if membership:
            household = membership.household
        else:
            # Create a personal default household if none exists
            household = Household(
                name=f"Hogar de {current_user.full_name or current_user.username}",
                owner_id=current_user.id,
                is_personal=True
            )
            db.add(household)
            db.flush()
            m = HouseholdMembership(household_id=household.id, user_id=current_user.id, role="owner")
            db.add(m)
            db.commit()
            db.refresh(household)

    # Check authorization
    is_member = db.query(HouseholdMembership).filter(
        HouseholdMembership.household_id == household.id,
        HouseholdMembership.user_id == current_user.id
    ).first()

    if not is_member:
        if current_user.role == "admin":
            # Mandatory audit log according to specifications
            client_ip = request.client.host if request.client else None
            audit_service.log_action(
                db=db,
                action="ADMIN_ACCESSED_PRIVATE_HOUSEHOLD",
                entity_type="household",
                user_id=current_user.id,
                household_id=household.id,
                details=f"Admin {current_user.username} consultó el hogar '{household.name}'",
                ip_address=client_ip
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes acceso a este hogar"
            )

    return household
