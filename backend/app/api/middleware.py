"""FastAPI middlewares for Request ID, Security Headers, and Payload Limits."""
import time
import uuid
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response, JSONResponse

from app.core.config import settings
from app.core.errors import format_error_response
from app.core.logging import logger


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        incoming_id = request.headers.get("X-Request-ID")
        request_id = incoming_id if incoming_id and len(incoming_id) <= 128 else f"req_{uuid.uuid4().hex[:16]}"
        request.state.request_id = request_id

        start_time = time.perf_counter()
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)

        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time-Ms"] = str(duration_ms)
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(self), microphone=(), camera=()"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


class PayloadLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        content_length = request.headers.get("Content-Length")
        if content_length:
            try:
                length = int(content_length)
                if length > settings.max_request_bytes:
                    request_id = getattr(request.state, "request_id", "req_unknown")
                    payload = format_error_response(
                        code="PAYLOAD_TOO_LARGE",
                        message=f"Request payload exceeds maximum allowed size of {settings.max_request_bytes} bytes.",
                        retryable=False,
                        request_id=request_id,
                    )
                    return JSONResponse(status_code=413, content=payload)
            except ValueError:
                pass
        return await call_next(request)

