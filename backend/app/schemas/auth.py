from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, EmailStr


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    mfa_required: bool = False
    mfa_token: Optional[str] = None
    user: Optional["UserResponse"] = None


class LoginRequest(BaseModel):
    username_or_email: str
    password: str


class MfaVerifyRequest(BaseModel):
    mfa_token: str
    totp_code: Optional[str] = None
    recovery_code: Optional[str] = None


class MfaSetupResponse(BaseModel):
    secret: str
    qr_code_base64: str
    recovery_codes: List[str]


class UserBase(BaseModel):
    email: EmailStr
    username: str
    full_name: Optional[str] = None
    role: str = "family"


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None


class UserPreferencesSchema(BaseModel):
    theme: str = "dark"
    language: str = "es"
    default_servings: int = 4
    widgets_config: Optional[str] = None

    class Config:
        from_attributes = True


class UserResponse(UserBase):
    id: int
    is_active: bool
    mfa_enabled: bool
    created_at: datetime
    preferences: Optional[UserPreferencesSchema] = None

    class Config:
        from_attributes = True


Token.model_rebuild()
