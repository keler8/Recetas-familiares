from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel


class RecipeDraftResponse(BaseModel):
    id: int
    batch_id: int
    title: str
    extracted_json: Dict[str, Any]
    source_image_url: Optional[str] = None
    proposed_image_url: Optional[str] = None
    status: str
    duplicate_recipe_id: Optional[int] = None
    ai_confidence: float
    uncertainty_notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ImportBatchResponse(BaseModel):
    id: int
    source_type: str
    source_name: Optional[str] = None
    status: str
    total_detected: int
    approved_count: int
    pending_count: int
    duplicate_count: int
    discarded_count: int
    error_message: Optional[str] = None
    created_at: datetime
    drafts: List[RecipeDraftResponse] = []

    class Config:
        from_attributes = True


class DraftReviewAction(BaseModel):
    action: str  # 'approve', 'discard', 'modify_and_approve'
    modified_data: Optional[Dict[str, Any]] = None


class InstagramImportRequest(BaseModel):
    url: str


class UrlImportRequest(BaseModel):
    url: str
