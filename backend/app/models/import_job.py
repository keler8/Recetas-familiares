from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Float
)
from sqlalchemy.orm import relationship
from app.database import Base


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    source_type = Column(String(50), nullable=False)  # drive, pdf, docx, image, instagram, manual, url
    source_name = Column(String(255), nullable=True)  # Filename or URL
    status = Column(String(50), default="queued", nullable=False)  # queued, processing, pending_review, completed, error
    
    total_detected = Column(Integer, default=0, nullable=False)
    approved_count = Column(Integer, default=0, nullable=False)
    pending_count = Column(Integer, default=0, nullable=False)
    duplicate_count = Column(Integer, default=0, nullable=False)
    discarded_count = Column(Integer, default=0, nullable=False)
    
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    drafts = relationship("RecipeDraft", back_populates="batch", cascade="all, delete-orphan")


class RecipeDraft(Base):
    __tablename__ = "recipe_drafts"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("import_batches.id", ondelete="CASCADE"), nullable=False, index=True)
    
    title = Column(String(255), nullable=False)
    raw_text = Column(Text, nullable=True)
    extracted_json = Column(Text, nullable=False)  # Complete JSON structure of extracted recipe
    
    source_image_url = Column(String(500), nullable=True)
    proposed_image_url = Column(String(500), nullable=True)
    
    # Review status
    status = Column(String(50), default="pending_review", nullable=False)  # pending_review, approved, discarded, duplicate
    duplicate_recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="SET NULL"), nullable=True)
    
    # AI Confidence and uncertainty tracking
    ai_confidence = Column(Float, default=1.0, nullable=False)
    uncertainty_notes = Column(Text, nullable=True)  # JSON or text notes on fields that need human validation
    
    approved_recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="SET NULL"), nullable=True)
    reviewed_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    batch = relationship("ImportBatch", back_populates="drafts")
