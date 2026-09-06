"""FastAPI application factory and middleware wiring."""
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.middleware import PayloadLimitMiddleware, RequestIdMiddleware, SecurityHeadersMiddleware
from app.api.routes.capabilities import router as capabilities_router
from app.api.routes.chat import router as chat_router
from app.api.routes.export import router as export_router
from app.api.routes.health import router as health_router
from app.api.routes.journal import router as journal_router
from app.api.routes.operations import router as operations_router
from app.api.routes.verifications import router as verifications_router
from app.api.routes.worker import router as worker_router
from app.core.config import settings
from app.core.errors import VeriJournalException, format_error_response, verijournal_exception_handler
from app.core.logging import logger

app = FastAPI(
    title="VeriJournal AI API",
    version="1.0.0",
    docs_url="/docs" if settings.dev_mode else None,
    redoc_url=None,
)

# 1. Custom Exception Handlers
app.add_exception_handler(VeriJournalException, verijournal_exception_handler)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    req_id = getattr(request.state, "request_id", "req_unknown")
    errors_summary = "; ".join([f"{err['loc'][-1]}: {err['msg']}" for err in exc.errors()])
    payload = format_error_response(
        code="INVALID_INPUT",
        message=f"Validation error: {errors_summary[:400]}",
        retryable=False,
        request_id=req_id,
    )
    return JSONResponse(status_code=400, content=payload)


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    req_id = getattr(request.state, "request_id", "req_unknown")
    logger.error(f"Unhandled exception on {request.url.path}: {exc}", exc_info=True)
    payload = format_error_response(
        code="INTERNAL_ERROR",
        message="An unexpected server error occurred.",
        retryable=True,
        request_id=req_id,
    )
    return JSONResponse(status_code=500, content=payload)


# 2. Middlewares (Executed in reverse order of addition)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["ETag", "Retry-After", "Location", "X-Request-ID", "X-Response-Time-Ms"],
)
app.add_middleware(PayloadLimitMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestIdMiddleware)

# 3. Mount API Routers under /api/v1
api_v1_prefix = "/api/v1"
app.include_router(health_router, prefix=api_v1_prefix)
app.include_router(capabilities_router, prefix=api_v1_prefix)
app.include_router(verifications_router, prefix=api_v1_prefix)
app.include_router(operations_router, prefix=api_v1_prefix)
app.include_router(journal_router, prefix=api_v1_prefix)
app.include_router(chat_router, prefix=api_v1_prefix)
app.include_router(export_router, prefix=api_v1_prefix)
app.include_router(worker_router, prefix=api_v1_prefix)

# 4. Optional Frontend Static Files for single-container deployment
dist_dir = Path(__file__).resolve().parent.parent.parent / "dist"
if dist_dir.exists() and (dist_dir / "index.html").exists():
    app.mount("/", StaticFiles(directory=str(dist_dir), html=True), name="static")
    logger.info(f"Mounted production frontend static assets from {dist_dir}")

