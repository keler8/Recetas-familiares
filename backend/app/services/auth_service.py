import io
import json
import base64
import secrets
from datetime import datetime, timedelta
from typing import Optional, List, Tuple, Dict, Any
from passlib.context import CryptContext
from jose import jwt, JWTError
import pyotp
import qrcode
from app.config import settings

# Argon2id password context
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


class AuthService:
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        try:
            return pwd_context.verify(plain_password, hashed_password)
        except Exception:
            return False

    @staticmethod
    def get_password_hash(password: str) -> str:
        return pwd_context.hash(password)

    @staticmethod
    def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode.update({"exp": expire, "iat": datetime.utcnow()})
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        return encoded_jwt

    @staticmethod
    def decode_token(token: str) -> Optional[dict]:
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            return payload
        except JWTError:
            return None

    # MFA / TOTP
    @staticmethod
    def generate_totp_secret() -> str:
        return pyotp.random_base32()

    @staticmethod
    def get_totp_uri(secret: str, username: str) -> str:
        totp = pyotp.TOTP(secret)
        return totp.provisioning_uri(name=username, issuer_name=settings.PROJECT_NAME)

    @staticmethod
    def generate_qr_code_base64(uri: str) -> str:
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=8,
            border=2,
        )
        qr.add_data(uri)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        return f"data:image/png;base64,{img_str}"

    @staticmethod
    def verify_totp(secret: str, code: str) -> bool:
        if not secret or not code:
            return False
        totp = pyotp.TOTP(secret)
        # Validates code with +/- 1 time step window for clock drift
        return totp.verify(code, valid_window=1)

    @staticmethod
    def generate_recovery_codes(count: int = 8) -> Tuple[List[str], str]:
        """Generates plain recovery codes for user display and a hashed JSON list for DB storage."""
        plain_codes = []
        hashed_codes = []
        for _ in range(count):
            code = secrets.token_hex(4).upper()  # 8 hex chars like 'A3F9B2C1'
            plain_codes.append(code)
            hashed_codes.append(pwd_context.hash(code))
        return plain_codes, json.dumps(hashed_codes)

    @staticmethod
    def verify_and_consume_recovery_code(plain_code: str, hashed_codes_json: Optional[str]) -> Tuple[bool, Optional[str]]:
        """Checks if code matches any stored hashed code, and removes it if valid."""
        if not hashed_codes_json:
            return False, None
        try:
            hashed_list: List[str] = json.loads(hashed_codes_json)
            for idx, h_code in enumerate(hashed_list):
                if pwd_context.verify(plain_code.upper().strip(), h_code):
                    # Code used! Consume it
                    hashed_list.pop(idx)
                    return True, json.dumps(hashed_list)
            return False, hashed_codes_json
        except Exception:
            return False, hashed_codes_json


auth_service = AuthService()
