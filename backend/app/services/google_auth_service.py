import os
import json
import logging
from typing import Dict, Any, List, Optional
import httpx
from urllib.parse import urlencode
from app.config import settings

logger = logging.getLogger(__name__)


class GoogleAuthService:
    def __init__(self):
        self.client_id = settings.GOOGLE_AUTH_CLIENT_ID or settings.GOOGLE_DRIVE_CLIENT_ID
        self.client_secret = settings.GOOGLE_AUTH_CLIENT_SECRET or settings.GOOGLE_DRIVE_CLIENT_SECRET
        self.redirect_uri = settings.GOOGLE_AUTH_REDIRECT_URI or "https://recetas.danesti.es/api/auth/google/callback"
        self.is_active = False
        self.auto_register = True
        self.allowed_domains = ""

    def load_from_db(self, db) -> "GoogleAuthService":
        try:
            from app.models.system import SystemSetting
            row = db.query(SystemSetting).filter(SystemSetting.key == "connector_google_auth").first()
            if row and row.value:
                data = json.loads(row.value) if isinstance(row.value, str) else row.value
                self.is_active = bool(data.get("is_active", False))
                self.client_id = data.get("client_id") or self.client_id
                self.client_secret = data.get("client_secret") or self.client_secret
                self.redirect_uri = data.get("redirect_uri") or self.redirect_uri
                self.auto_register = bool(data.get("auto_register", True))
                self.allowed_domains = data.get("allowed_domains", "")
            else:
                # Fallback to connector_drive if present in database
                drive_row = db.query(SystemSetting).filter(SystemSetting.key == "connector_drive").first()
                if drive_row and drive_row.value:
                    data = json.loads(drive_row.value) if isinstance(drive_row.value, str) else drive_row.value
                    if data.get("client_id") and data.get("client_secret"):
                        self.client_id = data.get("client_id")
                        self.client_secret = data.get("client_secret")
                        self.is_active = True
                elif settings.GOOGLE_AUTH_CLIENT_ID or settings.GOOGLE_DRIVE_CLIENT_ID:
                    self.client_id = settings.GOOGLE_AUTH_CLIENT_ID or settings.GOOGLE_DRIVE_CLIENT_ID
                    self.client_secret = settings.GOOGLE_AUTH_CLIENT_SECRET or settings.GOOGLE_DRIVE_CLIENT_SECRET
                    self.is_active = True
        except Exception as e:
            logger.error(f"Error loading connector_google_auth: {e}")
        return self

    def is_configured(self) -> bool:
        return bool(self.client_id and self.client_secret and len(str(self.client_id).strip()) > 5)

    def is_enabled(self) -> bool:
        return bool(self.is_active and self.is_configured())

    def update_credentials(
        self,
        is_active: Optional[bool] = None,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        redirect_uri: Optional[str] = None,
        auto_register: Optional[bool] = None,
        allowed_domains: Optional[str] = None
    ):
        if is_active is not None:
            self.is_active = is_active
        if client_id is not None:
            self.client_id = client_id.strip() if client_id else None
        if client_secret is not None:
            self.client_secret = client_secret.strip() if client_secret else None
        if redirect_uri is not None:
            self.redirect_uri = redirect_uri.strip() if redirect_uri else self.redirect_uri
        if auto_register is not None:
            self.auto_register = auto_register
        if allowed_domains is not None:
            self.allowed_domains = allowed_domains

    def get_auth_url(self, state: Optional[str] = None, redirect_uri: Optional[str] = None) -> Optional[str]:
        if not self.is_configured():
            return None
        target_redirect = redirect_uri or self.redirect_uri
        params = {
            "client_id": self.client_id,
            "redirect_uri": target_redirect,
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "offline",
            "prompt": "select_account"
        }
        if state:
            params["state"] = state
        return f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"

    def exchange_code(self, code: str, redirect_uri: Optional[str] = None) -> Dict[str, Any]:
        target_redirect = redirect_uri or self.redirect_uri
        token_url = "https://oauth2.googleapis.com/token"
        payload = {
            "code": code,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "redirect_uri": target_redirect,
            "grant_type": "authorization_code"
        }
        resp = httpx.post(token_url, data=payload, timeout=12.0)
        if resp.status_code != 200:
            logger.error(f"Google token exchange failed: {resp.text}")
            raise ValueError(f"Error de Google al intercambiar el código ({resp.status_code})")
        return resp.json()

    def get_user_info(self, access_token: str) -> Dict[str, Any]:
        resp = httpx.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10.0
        )
        if resp.status_code != 200:
            raise ValueError(f"Error al obtener información del perfil de Google ({resp.status_code})")
        return resp.json()

    def verify_id_token(self, id_token_str: str) -> Dict[str, Any]:
        resp = httpx.get(
            f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token_str}",
            timeout=10.0
        )
        if resp.status_code != 200:
            raise ValueError("Token ID de Google no válido o expirado")
        data = resp.json()
        if self.client_id and data.get("aud") != self.client_id:
            raise ValueError("El token no coincide con el Client ID de la aplicación")
        return data

    def test_connection(self) -> Dict[str, Any]:
        if not self.client_id or not self.client_secret:
            return {"success": False, "message": "Faltan Client ID o Client Secret de Google Cloud"}
        if ".apps.googleusercontent.com" not in str(self.client_id):
            return {
                "success": False,
                "message": "El Client ID no tiene el formato estándar (suele terminar en .apps.googleusercontent.com)"
            }
        try:
            r = httpx.get("https://accounts.google.com/.well-known/openid-configuration", timeout=5.0)
            if r.status_code == 200:
                return {
                    "success": True,
                    "message": "Conectividad verificada con Google OAuth2. Credenciales listas para iniciar sesión."
                }
            return {"success": False, "message": f"Respuesta inesperada de servidores Google ({r.status_code})"}
        except Exception as e:
            return {"success": False, "message": f"No se pudo conectar con los servidores de Google: {e}"}


google_auth_service = GoogleAuthService()
