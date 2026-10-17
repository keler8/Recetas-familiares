import pytest
import os
import json
from app.services.auth_service import auth_service
from app.services.storage_guard import storage_guard
from app.services.backup_service import backup_service
from app.database import SessionLocal
from app.models.auth import User
from app.models.recipe import Recipe
from app.models.household import Household


def test_initial_seed_integrity():
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == "admin").first()
        assert admin is not None
        assert admin.role == "admin"
        assert admin.is_active is True

        recipe = db.query(Recipe).filter(Recipe.title.ilike("%curry%")).first()
        assert recipe is not None
        assert len(recipe.variants) >= 2

        # Check Thermomix variant
        tm_variant = next((v for v in recipe.variants if v.variant_type == "thermomix"), None)
        assert tm_variant is not None
        assert len(tm_variant.ingredients) >= 4
        assert len(tm_variant.steps) >= 3

        # Check Traditional variant
        trad_variant = next((v for v in recipe.variants if v.variant_type == "traditional"), None)
        assert trad_variant is not None
    finally:
        db.close()


def test_storage_guard_safety():
    status = storage_guard.get_disk_usage()
    assert status["total_gb"] > 0
    assert status["free_gb"] > 0
    assert status["is_safe"] is True
    assert storage_guard.can_start_heavy_task() is True


def test_database_backup_and_integrity_verification():
    res = backup_service.create_database_backup()
    assert res["success"] is True
    assert os.path.exists(res["filepath"])
    assert res["size_bytes"] > 0
    assert res["sha256"] is not None
    assert len(res["sha256"]) == 64

    # Verify integrity
    is_valid = backup_service.verify_backup_integrity(res["filepath"])
    assert is_valid is True
