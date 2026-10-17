import pytest
from app.services.auth_service import auth_service


def test_password_hashing():
    pw = "SuperSecretPassword123!"
    hashed = auth_service.get_password_hash(pw)
    assert hashed != pw
    assert auth_service.verify_password(pw, hashed) is True
    assert auth_service.verify_password("wrong", hashed) is False


def test_totp_generation_and_verification():
    secret = auth_service.generate_totp_secret()
    assert len(secret) == 32
    uri = auth_service.get_totp_uri(secret, "testuser")
    assert "testuser" in uri
    assert "Recetario" in uri

    qr_b64 = auth_service.generate_qr_code_base64(uri)
    assert qr_b64.startswith("data:image/png;base64,")


def test_recovery_codes_generation_and_consumption():
    plain_codes, hashed_json = auth_service.generate_recovery_codes(4)
    assert len(plain_codes) == 4

    # Consume the first code
    first_code = plain_codes[0]
    valid, new_json = auth_service.verify_and_consume_recovery_code(first_code, hashed_json)
    assert valid is True
    assert new_json != hashed_json

    # Try to reuse the same code - must fail
    valid_reuse, _ = auth_service.verify_and_consume_recovery_code(first_code, new_json)
    assert valid_reuse is False
