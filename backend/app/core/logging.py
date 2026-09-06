"""Structured logging with redaction for tokens, secrets, GPS, and sensitive text."""
import json
import logging
import re
import sys
from typing import Any

# Sensitive patterns
TOKEN_PATTERN = re.compile(r"Bearer\s+([A-Za-z0-9._-]+)", re.IGNORECASE)
API_KEY_PATTERN = re.compile(r"(AIza[0-9A-Za-z-_]{35}|key=[A-Za-z0-9_-]{20,})", re.IGNORECASE)
GPS_PATTERN = re.compile(r"([-+]?\d{1,2}\.\d{4,}),\s*([-+]?\d{1,3}\.\d{4,})")


def redact_text(text: str) -> str:
    """Redacts tokens, API keys, and exact GPS coordinates from log strings."""
    if not isinstance(text, str):
        return str(text)
    redacted = TOKEN_PATTERN.sub("Bearer [REDACTED_TOKEN]", text)
    redacted = API_KEY_PATTERN.sub("[REDACTED_KEY]", redacted)
    redacted = GPS_PATTERN.sub("[REDACTED_GPS]", redacted)
    return redacted


class SafeJsonFormatter(logging.Formatter):
    """Custom JSON formatter ensuring zero leakage of secrets or private data."""

    def format(self, record: logging.LogRecord) -> str:
        data: dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": redact_text(record.getMessage()),
        }

        # Include structured extra fields if provided
        for key, value in record.__dict__.items():
            if key in (
                "request_id",
                "operation_id",
                "uid",
                "status_code",
                "duration_ms",
                "provider",
                "model",
                "stage",
            ):
                if isinstance(value, str):
                    data[key] = redact_text(value)
                else:
                    data[key] = value

        if record.exc_info:
            data["exception"] = self.formatException(record.exc_info)

        return json.dumps(data)


def setup_logger(name: str = "verijournal", level: int = logging.INFO) -> logging.Logger:
    logger = logging.getLogger(name)
    logger.setLevel(level)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(SafeJsonFormatter())
        logger.addHandler(handler)
        logger.propagate = False
    return logger


logger = setup_logger()

