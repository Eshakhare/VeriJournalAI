"""Canonical error codes and HTTP exception handlers matching contracts/error-codes.json."""
from typing import Optional
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse

# Defined in contracts/error-codes.json
ERROR_METADATA = {
    "AUTH_REQUIRED": {"http_status": 401, "retryable": False},
    "AUTH_INVALID": {"http_status": 401, "retryable": False},
    "ACCESS_DENIED": {"http_status": 403, "retryable": False},
    "APP_CHECK_REQUIRED": {"http_status": 403, "retryable": False},
    "FEATURE_DISABLED": {"http_status": 503, "retryable": True},
    "INVALID_INPUT": {"http_status": 400, "retryable": False},
    "UNSUPPORTED_INPUT": {"http_status": 415, "retryable": False},
    "PAYLOAD_TOO_LARGE": {"http_status": 413, "retryable": False},
    "RATE_LIMITED": {"http_status": 429, "retryable": True},
    "QUOTA_EXCEEDED": {"http_status": 429, "retryable": True},
    "URL_BLOCKED": {"http_status": 422, "retryable": False},
    "URL_UNAVAILABLE": {"http_status": 422, "retryable": True},
    "MEDIA_ACCESS_UNAVAILABLE": {"http_status": 422, "retryable": False},
    "OPERATION_NOT_FOUND": {"http_status": 404, "retryable": False},
    "OPERATION_NOT_RETRYABLE": {"http_status": 409, "retryable": False},
    "OPERATION_CANCELLED": {"http_status": 409, "retryable": False},
    "PROVIDER_UNAVAILABLE": {"http_status": 503, "retryable": True},
    "PROVIDER_INVALID_RESPONSE": {"http_status": 502, "retryable": True},
    "AI_SAFETY_BLOCK": {"http_status": 422, "retryable": False},
    "INTERNAL_ERROR": {"http_status": 500, "retryable": True},
}


class VeriJournalException(HTTPException):
    """Base exception for all contract-compliant API errors."""

    def __init__(
        self,
        code: str,
        message: str,
        details: Optional[dict] = None,
    ):
        meta = ERROR_METADATA.get(code, {"http_status": 500, "retryable": True})
        self.code = code
        self.message = message[:500]
        self.retryable = meta["retryable"]
        self.http_status = meta["http_status"]
        self.details = details or {}
        super().__init__(status_code=self.http_status, detail=self.message)


def format_error_response(code: str, message: str, retryable: bool, request_id: str) -> dict:
    return {
        "contractVersion": "1.0",
        "error": {
            "code": code,
            "message": message[:500],
            "retryable": retryable,
            "requestId": request_id,
        },
    }


async def verijournal_exception_handler(request: Request, exc: VeriJournalException) -> JSONResponse:
    request_id = getattr(request.state, "request_id", "req_unknown")
    payload = format_error_response(
        code=exc.code,
        message=exc.message,
        retryable=exc.retryable,
        request_id=request_id,
    )
    headers = {}
    if exc.code in ("RATE_LIMITED", "QUOTA_EXCEEDED"):
        headers["Retry-After"] = "5"
    elif exc.code == "FEATURE_DISABLED":
        headers["Retry-After"] = "10"
    return JSONResponse(status_code=exc.http_status, content=payload, headers=headers)

