import os
import json
import logging
from typing import Dict, Any, List, Optional, Tuple
from urllib.parse import urlencode
import httpx
from app.config import settings

logger = logging.getLogger(__name__)


class DriveService:
    def __init__(self):
        self.client_id: Optional[str] = settings.GOOGLE_DRIVE_CLIENT_ID
        self.client_secret: Optional[str] = settings.GOOGLE_DRIVE_CLIENT_SECRET
        self.redirect_uri: str = settings.GOOGLE_DRIVE_REDIRECT_URI or "https://recetas.danesti.es/api/drive/callback"
        self.tokens: Optional[Dict[str, Any]] = None
        self.account_email: Optional[str] = None

    def load_from_db(self, db) -> "DriveService":
        try:
            from app.models.system import SystemSetting
            row = db.query(SystemSetting).filter(SystemSetting.key == "connector_drive").first()
            if row and row.value:
                data = json.loads(row.value) if isinstance(row.value, str) else row.value
                self.client_id = data.get("client_id") or self.client_id
                self.client_secret = data.get("client_secret") or self.client_secret
                self.redirect_uri = data.get("redirect_uri") or self.redirect_uri
            else:
                # Fallback to connector_google_auth if present
                auth_row = db.query(SystemSetting).filter(SystemSetting.key == "connector_google_auth").first()
                if auth_row and auth_row.value:
                    data = json.loads(auth_row.value) if isinstance(auth_row.value, str) else auth_row.value
                    if data.get("client_id") and data.get("client_secret"):
                        self.client_id = data.get("client_id")
                        self.client_secret = data.get("client_secret")

            # Load stored OAuth tokens
            token_row = db.query(SystemSetting).filter(SystemSetting.key == "connector_drive_tokens").first()
            if token_row and token_row.value:
                tokens_data = json.loads(token_row.value) if isinstance(token_row.value, str) else token_row.value
                self.tokens = tokens_data
                self.account_email = tokens_data.get("account_email")
            else:
                self.tokens = None
                self.account_email = None
        except Exception as e:
            logger.error(f"Error loading connector_drive: {e}")
        return self

    @property
    def is_configured(self) -> bool:
        return bool(self.client_id and self.client_secret and len(str(self.client_id).strip()) > 5)

    @property
    def is_authorized(self) -> bool:
        return bool(self.tokens and (self.tokens.get("refresh_token") or self.tokens.get("access_token")))

    def update_credentials(
        self,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        redirect_uri: Optional[str] = None
    ):
        if client_id is not None:
            self.client_id = client_id.strip() if client_id else None
        if client_secret is not None:
            self.client_secret = client_secret.strip() if client_secret else None
        if redirect_uri is not None:
            self.redirect_uri = redirect_uri.strip() if redirect_uri else self.redirect_uri

    def get_auth_url(self, state: Optional[str] = None, redirect_uri: Optional[str] = None) -> Optional[str]:
        if not self.is_configured:
            return None
        target_redirect = redirect_uri or self.redirect_uri
        params = {
            "client_id": self.client_id,
            "redirect_uri": target_redirect,
            "response_type": "code",
            "scope": "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly openid email profile",
            "access_type": "offline",
            "prompt": "consent select_account",
            "include_granted_scopes": "true"
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
            logger.error(f"Google Drive token exchange failed: {resp.text}")
            raise ValueError(f"Error de Google al intercambiar el código ({resp.status_code}): {resp.text}")
        token_data = resp.json()

        account_email = None
        if token_data.get("access_token"):
            try:
                user_info_resp = httpx.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {token_data['access_token']}"},
                    timeout=5.0
                )
                if user_info_resp.status_code == 200:
                    account_email = user_info_resp.json().get("email")
            except Exception as e:
                logger.warning(f"Could not fetch user info for Drive account: {e}")

        token_data["account_email"] = account_email
        return token_data

    def save_tokens(self, db, tokens: Dict[str, Any]):
        from app.models.system import SystemSetting
        row = db.query(SystemSetting).filter(SystemSetting.key == "connector_drive_tokens").first()
        if not row:
            row = SystemSetting(key="connector_drive_tokens", value=json.dumps(tokens), description="Tokens OAuth de Google Drive")
            db.add(row)
        else:
            row.value = json.dumps(tokens)
        db.commit()
        self.tokens = tokens
        self.account_email = tokens.get("account_email")

    def disconnect(self, db):
        from app.models.system import SystemSetting
        row = db.query(SystemSetting).filter(SystemSetting.key == "connector_drive_tokens").first()
        if row:
            db.delete(row)
            db.commit()
        self.tokens = None
        self.account_email = None

    def refresh_access_token(self, db) -> Optional[str]:
        if not self.tokens or not self.tokens.get("refresh_token"):
            return None
        token_url = "https://oauth2.googleapis.com/token"
        payload = {
            "refresh_token": self.tokens["refresh_token"],
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "grant_type": "refresh_token"
        }
        resp = httpx.post(token_url, data=payload, timeout=10.0)
        if resp.status_code == 200:
            new_data = resp.json()
            self.tokens["access_token"] = new_data["access_token"]
            if "refresh_token" in new_data:
                self.tokens["refresh_token"] = new_data["refresh_token"]
            self.save_tokens(db, self.tokens)
            return self.tokens["access_token"]
        return None

    def get_valid_access_token(self, db) -> Optional[str]:
        if not self.tokens:
            return None
        return self.tokens.get("access_token")

    def list_shared_drives(self, db) -> List[Dict[str, Any]]:
        token = self.get_valid_access_token(db)
        if not token:
            return []
        url = "https://www.googleapis.com/drive/v3/drives"
        headers = {"Authorization": f"Bearer {token}"}
        params = {"pageSize": 50}
        resp = httpx.get(url, headers=headers, params=params, timeout=10.0)
        if resp.status_code == 401:
            new_token = self.refresh_access_token(db)
            if new_token:
                headers["Authorization"] = f"Bearer {new_token}"
                resp = httpx.get(url, headers=headers, params=params, timeout=10.0)
        if resp.status_code == 200:
            return resp.json().get("drives", [])
        return []

    def list_files(
        self,
        db,
        folder_id: Optional[str] = None,
        query: Optional[str] = None,
        section: str = "my_drive",
        drive_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        token = self.get_valid_access_token(db)
        if not token:
            return []

        q_parts = ["trashed = false"]

        # Search term filter
        if query and query.strip():
            clean_q = query.strip().replace("'", "\\'")
            q_parts.append(f"name contains '{clean_q}'")
            if folder_id:
                q_parts.append(f"'{folder_id}' in parents")
        else:
            # Navigation by section or folder
            if folder_id:
                q_parts.append(f"'{folder_id}' in parents")
            elif section == "shared_with_me":
                q_parts.append("sharedWithMe = true")
            elif section == "shared_drive" and drive_id:
                q_parts.append(f"'{drive_id}' in parents")
            elif section == "my_drive":
                q_parts.append("'root' in parents")

            # Supported recipe file formats filter
            q_parts.append(
                "(mimeType = 'application/vnd.google-apps.folder' or "
                "mimeType = 'application/pdf' or "
                "mimeType contains 'image/' or "
                "mimeType contains 'text/' or "
                "mimeType = 'application/vnd.google-apps.document' or "
                "mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')"
            )

        q_str = " and ".join(q_parts)
        url = "https://www.googleapis.com/drive/v3/files"
        headers = {"Authorization": f"Bearer {token}"}
        params: Dict[str, Any] = {
            "q": q_str,
            "fields": "files(id, name, mimeType, size, modifiedTime, iconLink, webViewLink, sharedWithMeTime, parents)",
            "pageSize": 75,
            "orderBy": "folder, name",
            "supportsAllDrives": "true",
            "includeItemsFromAllDrives": "true"
        }

        if drive_id:
            params["corpora"] = "drive"
            params["driveId"] = drive_id
        elif query and not folder_id:
            params["corpora"] = "allDrives"

        resp = httpx.get(url, headers=headers, params=params, timeout=12.0)
        if resp.status_code == 401:
            new_token = self.refresh_access_token(db)
            if new_token:
                headers["Authorization"] = f"Bearer {new_token}"
                resp = httpx.get(url, headers=headers, params=params, timeout=12.0)

        if resp.status_code == 200:
            return resp.json().get("files", [])
        else:
            logger.warning(f"Drive files.list returned {resp.status_code}: {resp.text}")
            # Fallback if corpora=allDrives is rejected on personal accounts
            if "corpora" in params:
                params.pop("corpora", None)
                resp = httpx.get(url, headers=headers, params=params, timeout=12.0)
                if resp.status_code == 200:
                    return resp.json().get("files", [])
            return []

    def list_folder_all_files(
        self,
        db,
        folder_id: str,
        drive_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Recursively discovers all supported recipe files and images inside a folder and its immediate subfolders.
        """
        token = self.get_valid_access_token(db)
        if not token:
            return []

        collected_files = []
        folders_to_visit = [folder_id]
        visited_folders = set()
        headers = {"Authorization": f"Bearer {token}"}

        while folders_to_visit and len(visited_folders) < 25:
            curr_folder = folders_to_visit.pop(0)
            if curr_folder in visited_folders:
                continue
            visited_folders.add(curr_folder)

            q_str = f"'{curr_folder}' in parents and trashed = false"
            params: Dict[str, Any] = {
                "q": q_str,
                "fields": "files(id, name, mimeType, size, modifiedTime, webViewLink)",
                "pageSize": 100,
                "supportsAllDrives": "true",
                "includeItemsFromAllDrives": "true"
            }
            if drive_id:
                params["corpora"] = "drive"
                params["driveId"] = drive_id

            try:
                resp = httpx.get("https://www.googleapis.com/drive/v3/files", headers=headers, params=params, timeout=12.0)
                if resp.status_code == 401:
                    new_token = self.refresh_access_token(db)
                    if new_token:
                        headers["Authorization"] = f"Bearer {new_token}"
                        resp = httpx.get("https://www.googleapis.com/drive/v3/files", headers=headers, params=params, timeout=12.0)

                if resp.status_code == 200:
                    items = resp.json().get("files", [])
                    for item in items:
                        mime = (item.get("mimeType") or "").lower()
                        if mime == "application/vnd.google-apps.folder":
                            folders_to_visit.append(item["id"])
                        elif (
                            "pdf" in mime or
                            "document" in mime or
                            "wordprocessingml" in mime or
                            "msword" in mime or
                            "text/" in mime or
                            "image/" in mime or
                            "sheet" in mime or
                            "presentation" in mime
                        ):
                            collected_files.append(item)
                else:
                    logger.warning(f"Drive list folder error for {curr_folder}: {resp.status_code} {resp.text}")
            except Exception as e:
                logger.error(f"Exception listing folder files for {curr_folder}: {e}")

        return collected_files

    def get_file_web_view_link(
        self,
        file_id: str,
        mime_type: Optional[str] = None,
        web_view_link: Optional[str] = None
    ) -> str:
        """
        Returns a direct web URL to view or edit the file in Google Drive / Google Docs.
        """
        if web_view_link and ("drive.google.com" in web_view_link or "docs.google.com" in web_view_link):
            return web_view_link
        mime = (mime_type or "").lower()
        if "google-apps.document" in mime or "wordprocessingml" in mime or "msword" in mime:
            return f"https://docs.google.com/document/d/{file_id}/edit"
        elif "spreadsheet" in mime or "sheet" in mime:
            return f"https://docs.google.com/spreadsheets/d/{file_id}/edit"
        elif "presentation" in mime:
            return f"https://docs.google.com/presentation/d/{file_id}/edit"
        return f"https://drive.google.com/file/d/{file_id}/view"

    def download_file(self, db, file_id: str, mime_type: Optional[str] = None) -> Tuple[bytes, str]:
        token = self.get_valid_access_token(db)

        if not token:
            raise ValueError("No hay token de acceso válido de Google Drive")

        headers = {"Authorization": f"Bearer {token}"}
        actual_mime = mime_type

        # If mimeType was not passed by client, query file metadata from Drive API
        if not actual_mime:
            try:
                meta_resp = httpx.get(
                    f"https://www.googleapis.com/drive/v3/files/{file_id}?fields=id,name,mimeType&supportsAllDrives=true",
                    headers=headers,
                    timeout=10.0
                )
                if meta_resp.status_code == 401:
                    new_tok = self.refresh_access_token(db)
                    if new_tok:
                        headers["Authorization"] = f"Bearer {new_tok}"
                        meta_resp = httpx.get(
                            f"https://www.googleapis.com/drive/v3/files/{file_id}?fields=id,name,mimeType&supportsAllDrives=true",
                            headers=headers,
                            timeout=10.0
                        )
                if meta_resp.status_code == 200:
                    actual_mime = meta_resp.json().get("mimeType")
            except Exception as e:
                logger.warning(f"Could not inspect metadata for file {file_id}: {e}")

        # Any Google Docs / Sheets / Slides / Forms editor file requires export
        is_google_doc = bool(actual_mime and (
            actual_mime.startswith("application/vnd.google-apps.document") or
            actual_mime.startswith("application/vnd.google-apps.spreadsheet") or
            actual_mime.startswith("application/vnd.google-apps.presentation") or
            "google-apps" in actual_mime
        ))

        if is_google_doc:
            url = f"https://www.googleapis.com/drive/v3/files/{file_id}/export?mimeType=application/pdf"
            forced_ext = ".pdf"
        else:
            url = f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media&supportsAllDrives=true"
            forced_ext = ""

        resp = httpx.get(url, headers=headers, timeout=35.0)
        if resp.status_code == 401:
            new_token = self.refresh_access_token(db)
            if new_token:
                headers["Authorization"] = f"Bearer {new_token}"
                resp = httpx.get(url, headers=headers, timeout=35.0)

        # Automatic fallback: if alt=media returned 403 Docs Editors, export as PDF
        if resp.status_code == 403 and ("Docs Editors" in resp.text or "binary content" in resp.text):
            export_url = f"https://www.googleapis.com/drive/v3/files/{file_id}/export?mimeType=application/pdf"
            resp = httpx.get(export_url, headers=headers, timeout=35.0)
            if resp.status_code == 200:
                return resp.content, ".pdf"

        if resp.status_code != 200:
            raise ValueError(f"Error al descargar archivo de Google Drive ({resp.status_code}): {resp.text[:120]}")

        return resp.content, forced_ext

    def get_status(self, db=None) -> Dict[str, Any]:
        if db:
            self.load_from_db(db)
        return {
            "is_configured": self.is_configured,
            "is_authorized": self.is_authorized,
            "redirect_uri": self.redirect_uri,
            "account_email": self.account_email,
            "root_folder": "Recetario Familiar",
            "subfolders": ["Imagenes", "Videos", "Recursos", "Copias-de-seguridad"],
            "status": (
                f"Conectado ({self.account_email})" if (self.is_authorized and self.account_email)
                else ("Conectado a Google Drive" if self.is_authorized
                else ("Configurado (pendiente de vincular cuenta)" if self.is_configured
                else "Pendiente de credenciales OAuth"))
            )
        }


drive_service = DriveService()
