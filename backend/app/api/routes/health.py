"""Health endpoint."""
from fastapi import APIRouter
from app.models.schemas import HealthResponse

router = APIRouter(tags=["System"])


@router.get("/health", response_model=HealthResponse)
async def get_health():
    """Minimal liveness response without internal details."""
    return HealthResponse(status="ok")

