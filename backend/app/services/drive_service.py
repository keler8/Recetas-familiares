import os
import json
import logging
from typing import Dict, Any, List, Optional
from app.config import settings

logger = logging.getLogger(__name__)


class DriveService:
    def __init__(self):
        self.client_id = settings.GOOGLE_DRIVE_CLIENT_ID
        self.client_secret = settings.GOOGLE_DRIVE_CLIENT_SECRET
        self.redirect_uri = settings.GOOGLE_DRIVE_REDIRECT_URI

    def is_configured(self) -> bool:
        return bool(self.client_id and self.client_secret)

    def get_auth_url(self, state: str = "drive_auth") -> Optional[str]:
        if not self.is_configured():
            return None
        from google_auth_oauthlib.flow import Flow
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [self.redirect_uri]
                }
            },
            scopes=[
                "https://www.googleapis.com/auth/drive.file",
                "https://www.googleapis.com/auth/drive.metadata.readonly"
            ],
            redirect_uri=self.redirect_uri
        )
        auth_url, _ = flow.authorization_url(prompt="consent", access_type="offline", state=state)
        return auth_url

    def get_status(self) -> Dict[str, Any]:
        return {
            "is_configured": self.is_configured(),
            "redirect_uri": self.redirect_uri,
            "root_folder": "Recetario Familiar",
            "subfolders": ["Imagenes", "Videos", "Recursos", "Copias-de-seguridad"],
            "status": "Conectado" if self.is_configured() else "Pendiente de credenciales OAuth"
        }

    def list_folder_files(self, folder_id: Optional[str] = None) -> List[Dict[str, Any]]:
        if not self.is_configured():
            return []
        # When connected with valid tokens:
        return []


drive_service = DriveService()
