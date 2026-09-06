"""Computes public presentation capabilities strictly conforming to contracts/feature-flags.json."""
from typing import Optional

from app.core.config import settings
from app.models.schemas import Capabilities, CapabilitiesResponse
from app.repositories.firestore import firestore_repo


class CapabilityService:
    async def get_effective_capabilities(self, uid: Optional[str] = None) -> CapabilitiesResponse:
        entitlements = {}
        if uid:
            entitlements = await firestore_repo.get_user_entitlements(uid)

        # Base flags
        m_mode = settings.maintenance_mode
        v_proc = settings.verification_processing_enabled
        g_en = settings.gemini_enabled
        txt_en = settings.text_verification_enabled
        url_en = settings.url_verification_enabled
        soc_en = settings.social_verification_enabled
        img_en = settings.image_provenance_enabled
        yt_en = settings.youtube_video_enabled
        vid_en = settings.short_video_upload_enabled
        c2pa_en = settings.c2pa_inspection_enabled
        maps_en = settings.maps_enabled
        app_chk = settings.app_check_enforced

        # Apply overrides from user entitlements if present
        if "maintenance_mode" in entitlements:
            m_mode = bool(entitlements["maintenance_mode"])

        # Mapping rules from contracts/feature-flags.json
        not_maint = not m_mode
        active_proc = not_maint and v_proc

        text_verification = active_proc and g_en and txt_en
        url_verification = active_proc and g_en and url_en
        social_verification = active_proc and g_en and soc_en
        image_provenance = active_proc and img_en
        youtube_video = active_proc and yt_en
        short_video_upload = active_proc and vid_en
        c2pa_inspection = not_maint and img_en and c2pa_en
        maps = not_maint and maps_en

        caps = Capabilities(
            textVerification=text_verification,
            urlVerification=url_verification,
            socialVerification=social_verification,
            imageProvenance=image_provenance,
            youtubeVideo=youtube_video,
            shortVideoUpload=short_video_upload,
            c2paInspection=c2pa_inspection,
            maps=maps,
            appCheckEnforced=app_chk,
            maintenanceMode=m_mode,
        )

        return CapabilitiesResponse(
            contractVersion="1.0",
            capabilities=caps,
        )


capability_service = CapabilityService()

