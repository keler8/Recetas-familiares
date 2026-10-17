import smtplib
import ssl
import json
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, List, Dict, Any
from datetime import datetime
import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.models.system import Notification, SystemSetting
from app.models.auth import User, UserPreferences

logger = logging.getLogger(__name__)


class NotificationService:
    def get_connector_config(self, db: Session, provider: str) -> Dict[str, Any]:
        """Loads connector settings from database, with fallback to environment variables."""
        setting = db.query(SystemSetting).filter(SystemSetting.key == f"connector_{provider}").first()
        if setting and setting.value:
            try:
                return json.loads(setting.value)
            except Exception:
                pass
        
        # Fallbacks to settings
        if provider == "smtp":
            return {
                "is_active": bool(settings.SMTP_HOST),
                "host": settings.SMTP_HOST,
                "port": settings.SMTP_PORT,
                "user": settings.SMTP_USER,
                "password": settings.SMTP_PASSWORD,
                "from_email": settings.EMAILS_FROM_EMAIL or settings.SMTP_USER,
                "use_tls": settings.SMTP_TLS
            }
        elif provider == "telegram":
            return {
                "is_active": bool(settings.TELEGRAM_BOT_TOKEN),
                "bot_token": settings.TELEGRAM_BOT_TOKEN,
                "chat_id": settings.TELEGRAM_CHAT_ID
            }
        return {}

    def create_in_app_notification(
        self,
        db: Session,
        user_id: int,
        title: str,
        message: str,
        category: str = "system",
        household_id: Optional[int] = None
    ) -> Notification:
        notif = Notification(
            user_id=user_id,
            household_id=household_id,
            title=title,
            message=message,
            category=category,
            is_read=False,
            created_at=datetime.utcnow()
        )
        db.add(notif)
        db.commit()
        db.refresh(notif)
        return notif

    def send_notification(
        self,
        db: Session,
        user_id: int,
        title: str,
        message: str,
        category: str = "system",
        household_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Dispatches notification based on user preferences and global connectors.
        In-app notification is ALWAYS created.
        """
        in_app_notif = self.create_in_app_notification(db, user_id, title, message, category, household_id)
        results = {"in_app": True, "email": False, "telegram": False}

        # Check user channel preferences
        prefs = db.query(UserPreferences).filter(UserPreferences.user_id == user_id).first()
        channels = {}
        if prefs and prefs.notification_channels:
            try:
                channels = json.loads(prefs.notification_channels)
            except Exception:
                pass

        user = db.query(User).filter(User.id == user_id).first()

        # Send Email if enabled by user (default true for important, or if explicitly enabled)
        wants_email = channels.get("email", True)
        if wants_email and user and user.email:
            smtp_cfg = self.get_connector_config(db, "smtp")
            if smtp_cfg.get("is_active") and smtp_cfg.get("host"):
                email_sent = self.send_email(
                    smtp_cfg=smtp_cfg,
                    to_email=user.email,
                    subject=f"[Recetario] {title}",
                    body_text=message
                )
                results["email"] = email_sent

        # Send Telegram if enabled
        wants_telegram = channels.get("telegram", False)
        if wants_telegram:
            tg_cfg = self.get_connector_config(db, "telegram")
            if tg_cfg.get("is_active") and tg_cfg.get("bot_token") and tg_cfg.get("chat_id"):
                tg_sent = self.send_telegram_message(
                    bot_token=tg_cfg["bot_token"],
                    chat_id=tg_cfg["chat_id"],
                    text=f"*{title}*\n{message}"
                )
                results["telegram"] = tg_sent

        return results

    def send_email(self, smtp_cfg: Dict[str, Any], to_email: str, subject: str, body_text: str) -> bool:
        try:
            host = smtp_cfg.get("host")
            port = int(smtp_cfg.get("port") or 587)
            user = smtp_cfg.get("user")
            password = smtp_cfg.get("password")
            from_email = smtp_cfg.get("from_email") or user

            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"Recetario Familiar <{from_email}>"
            msg["To"] = to_email

            part = MIMEText(body_text, "plain", "utf-8")
            msg.attach(part)

            if smtp_cfg.get("use_tls", True):
                context = ssl.create_default_context()
                with smtplib.SMTP(host, port, timeout=10) as server:
                    server.starttls(context=context)
                    if user and password:
                        server.login(user, password)
                    server.sendmail(from_email, to_email, msg.as_string())
            else:
                with smtplib.SMTP(host, port, timeout=10) as server:
                    if user and password:
                        server.login(user, password)
                    server.sendmail(from_email, to_email, msg.as_string())

            logger.info(f"Email sent successfully to {to_email}")
            return True
        except Exception as e:
            logger.error(f"Error sending email via SMTP: {e}")
            return False

    def send_telegram_message(self, bot_token: str, chat_id: str, text: str) -> bool:
        try:
            url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            payload = {
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "Markdown"
            }
            with httpx.Client(timeout=10) as client:
                resp = client.post(url, json=payload)
                if resp.status_code == 200:
                    logger.info("Telegram message sent successfully")
                    return True
                else:
                    logger.warning(f"Telegram returned status {resp.status_code}: {resp.text}")
                    return False
        except Exception as e:
            logger.error(f"Error sending telegram message: {e}")
            return False


notification_service = NotificationService()
