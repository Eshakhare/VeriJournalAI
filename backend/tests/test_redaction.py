"""Log redaction tests verifying zero leakage of tokens, keys, and precise GPS."""
from app.core.logging import redact_text


def test_redact_bearer_token():
    raw = "User requested with Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiJhbGljZSJ9"
    redacted = redact_text(raw)
    assert "eyJhbGciOiJSUzI1Ni" not in redacted
    assert "Bearer [REDACTED_TOKEN]" in redacted


def test_redact_api_key():
    raw = "Failed call to Google API with key=AIzaSyA1234567890abcdef1234567890abcdef"
    redacted = redact_text(raw)
    assert "AIzaSyA1234567890" not in redacted
    assert "[REDACTED_KEY]" in redacted


def test_redact_precise_gps():
    raw = "Photo contains EXIF location coordinates 37.774929, -122.419416 inside user payload."
    redacted = redact_text(raw)
    assert "37.774929" not in redacted
    assert "-122.419416" not in redacted
    assert "[REDACTED_GPS]" in redacted

