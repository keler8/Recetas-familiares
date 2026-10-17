from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from app.models.auth import AuditLog


class AuditService:
    @staticmethod
    def log_action(
        db: Session,
        action: str,
        entity_type: str,
        user_id: Optional[int] = None,
        entity_id: Optional[str] = None,
        household_id: Optional[int] = None,
        details: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> AuditLog:
        audit_entry = AuditLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id else None,
            household_id=household_id,
            details=details,
            ip_address=ip_address,
            created_at=datetime.utcnow()
        )
        db.add(audit_entry)
        db.commit()
        db.refresh(audit_entry)
        return audit_entry


audit_service = AuditService()
