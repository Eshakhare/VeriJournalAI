"""Capabilities endpoint."""
from fastapi import APIRouter, Depends
from app.auth.firebase import UserPrincipal, get_current_user
from app.models.schemas import CapabilitiesResponse
from app.services.features.capability_service import capability_service

router = APIRouter(tags=["User"])


@router.get("/me/capabilities", response_model=CapabilitiesResponse)
async def get_capabilities(user: UserPrincipal = Depends(get_current_user)):
    """Returns effective UI capabilities computed server-side."""
    return await capability_service.get_effective_capabilities(user.uid)

