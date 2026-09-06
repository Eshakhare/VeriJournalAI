"""Verification worker orchestrating the 9 contract verification stages with transactional lease and stage updates."""
import asyncio
from datetime import datetime, timezone
import uuid
from typing import List, Optional

from app.core.config import settings
from app.core.errors import VeriJournalException
from app.core.logging import logger
from app.models.schemas import (
    CheckWorthiness,
    Claim,
    ConsistencyStatus,
    DateType,
    EvidenceConfidence,
    EvidenceItem,
    EvidenceStance,
    EvidenceStatus,
    FactCheckProviderStatus,
    InputType,
    JournalEntry,
    MediaSummary,
    OperationStage,
    OperationState,
    TimelineEvent,
    TimelineType,
    ValidatedPartialResult,
)
from app.repositories.firestore import firestore_repo
from app.repositories.storage import storage_repo
from app.services.ai.gemini_gateway import gemini_gateway
from app.services.fact_check.client import fact_check_client
from app.services.media.image_processor import extract_exif, run_web_detection, verify_image_bytes
from app.services.safe_browsing.client import safe_browsing_client
from app.services.scraping.domain_context import domain_service
from app.services.scraping.safe_fetch import safe_fetch_url


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _id(prefix: str = "id") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


class VerificationWorker:
    async def process_operation(self, operation_id: str, worker_id: str = "worker_default") -> None:
        """Processes verification operation across all 9 contract stages."""
        logger.info(f"Worker {worker_id} picked up operation {operation_id}")

        # Transactional lease check
        leased = await firestore_repo.acquire_operation_lease(
            operation_id=operation_id,
            lease_owner=worker_id,
            duration_seconds=120,
        )
        if not leased:
            logger.warning(f"Could not acquire lease for operation {operation_id}; skipping duplicate execution.")
            return

        # Fetch operation from Firestore
        op = firestore_repo.mock.operations.get(operation_id) if not firestore_repo.client else None
        if not op and firestore_repo.client:
            doc = await firestore_repo.client.collection("verification_operations").document(operation_id).get()
            op = doc.to_dict() if doc.exists else None

        if not op:
            logger.error(f"Operation {operation_id} not found in repository.")
            return

        owner_uid = op.get("ownerUid")
        entry_id = op.get("entryId", operation_id)
        input_type = op.get("inputType", "text")
        raw_input = op.get("rawInput", {})

        completed_stages: List[str] = []
        partial_result = ValidatedPartialResult()

        async def check_cancellation() -> bool:
            current_op = await firestore_repo.get_operation(operation_id, owner_uid)
            return bool(current_op and current_op.get("cancelRequested"))

        async def update_stage(stage: OperationStage, progress: int, message: str) -> None:
            await firestore_repo.update_operation(
                operation_id,
                {
                    "state": OperationState.processing.value,
                    "stage": stage.value,
                    "progressPercent": progress,
                    "message": message,
                    "completedStages": completed_stages,
                    "partialResult": partial_result.model_dump(),
                },
            )

        try:
            # Stage 1: validating_input
            await update_stage(OperationStage.validating_input, 10, "Validating input structure")
            if await check_cancellation():
                await firestore_repo.update_operation(operation_id, {"state": OperationState.cancelled.value, "stage": OperationStage.complete.value})
                return
            completed_stages.append(OperationStage.validating_input.value)

            text_to_analyze = ""
            url_to_analyze = None
            title = None
            published_date = None
            media_summaries: List[MediaSummary] = []
            timeline_events: List[TimelineEvent] = []

            # Stage 2: checking_url
            if input_type in ("article_url", "social_post"):
                url_to_analyze = raw_input.get("url")
                await update_stage(OperationStage.checking_url, 20, "Checking URL safety and publisher reputation")
                if await check_cancellation():
                    await firestore_repo.update_operation(operation_id, {"state": OperationState.cancelled.value, "stage": OperationStage.complete.value})
                    return

                # Safe Browsing check
                sb_status = await safe_browsing_client.check_url(url_to_analyze)
                partial_result.safeBrowsingStatus = sb_status
                if sb_status == "known_threat":
                    raise VeriJournalException(code="URL_BLOCKED", message="Google Safe Browsing identified this URL as unsafe.")

                # Domain reputation check
                reg_match, pub_name, warning_note = domain_service.evaluate_domain(url_to_analyze)
                partial_result.publisherRegistryMatch = reg_match
                completed_stages.append(OperationStage.checking_url.value)

            # Stage 3: extracting_content
            await update_stage(OperationStage.extracting_content, 30, "Extracting text content")
            if await check_cancellation():
                await firestore_repo.update_operation(operation_id, {"state": OperationState.cancelled.value, "stage": OperationStage.complete.value})
                return

            if input_type == "text":
                text_to_analyze = raw_input.get("text", "")
                title = text_to_analyze[:60] + "..." if len(text_to_analyze) > 60 else text_to_analyze
            elif input_type in ("article_url", "social_post"):
                fetch_res = await safe_fetch_url(url_to_analyze)
                text_to_analyze = fetch_res.text_content
                title = fetch_res.title or url_to_analyze
                published_date = fetch_res.published_date
            elif input_type in ("image", "video_upload"):
                text_to_analyze = raw_input.get("accompanyingClaim") or "Media verification claim"
                title = raw_input.get("filename") or "Media Investigation"
            completed_stages.append(OperationStage.extracting_content.value)

            # Stage 4: extracting_claims
            await update_stage(OperationStage.extracting_claims, 45, "Extracting atomic check-worthy claims")
            if await check_cancellation():
                await firestore_repo.update_operation(operation_id, {"state": OperationState.cancelled.value, "stage": OperationStage.complete.value})
                return

            claims = await gemini_gateway.extract_claims(text_to_analyze)
            partial_result.claims = claims
            completed_stages.append(OperationStage.extracting_claims.value)

            # Stage 5: checking_fact_checks
            await update_stage(OperationStage.checking_fact_checks, 60, "Querying Fact Check Tools API")
            if await check_cancellation():
                await firestore_repo.update_operation(operation_id, {"state": OperationState.cancelled.value, "stage": OperationStage.complete.value})
                return

            fact_check_status = FactCheckProviderStatus.no_match
            evidence_items: List[EvidenceItem] = []

            for claim in claims:
                fc_res = await fact_check_client.search_claims(claim.claimText)
                fact_check_status = FactCheckProviderStatus(fc_res.status)
                if fc_res.status == "matched":
                    for item in fc_res.items:
                        eid = _id("evd")
                        evidence_items.append(
                            EvidenceItem(
                                evidenceId=eid,
                                claimId=claim.claimId,
                                sourceUrl=item.review_url,
                                sourceTitle=item.review_title,
                                publisher=item.publisher_name,
                                stance=EvidenceStance.contradicts if any(w in item.textual_rating.lower() for w in ["false", "debunked", "misleading", "incorrect"]) else EvidenceStance.supports,
                                publishedAt=item.review_date,
                                retrievedAt=_now_iso(),
                                excerpt=f"Rating: {item.textual_rating}. Fact-checked statement: {item.claim_text}",
                            )
                        )
                        timeline_events.append(
                            TimelineEvent(
                                eventId=_id("evt"),
                                timelineType=TimelineType.claim_evidence,
                                dateType=DateType.fact_check_review,
                                occurredAt=item.review_date or _now_iso(),
                                description=f"Fact check published by {item.publisher_name}: '{item.textual_rating}'",
                                sourceUrl=item.review_url,
                                dateConfidence=EvidenceConfidence.high,
                            )
                        )
            completed_stages.append(OperationStage.checking_fact_checks.value)

            # Stage 6: retrieving_evidence (RAG synthesis)
            await update_stage(OperationStage.retrieving_evidence, 70, "Retrieving and synthesizing evidence ledger")
            if await check_cancellation():
                await firestore_repo.update_operation(operation_id, {"state": OperationState.cancelled.value, "stage": OperationStage.complete.value})
                return

            synthesis = await gemini_gateway.synthesize_evidence(claims, evidence_items)
            completed_stages.append(OperationStage.retrieving_evidence.value)

            # Stage 7: analyzing_media
            if input_type in ("image", "video_upload"):
                await update_stage(OperationStage.analyzing_media, 80, "Analyzing media provenance and reverse-search history")
                if await check_cancellation():
                    await firestore_repo.update_operation(operation_id, {"state": OperationState.cancelled.value, "stage": OperationStage.complete.value})
                    return

                media_id = raw_input.get("mediaId", _id("med"))
                media_path = raw_input.get("storagePath")
                file_bytes = None
                if media_path:
                    file_bytes = await storage_repo.get_file_bytes(media_path, owner_uid)

                if file_bytes:
                    save_exact_gps = raw_input.get("saveExactGps", False)
                    exif_meta, gps_info = extract_exif(file_bytes, save_exact_gps=save_exact_gps)
                    earliest_match, matching_pages, media_limits = await run_web_detection(file_bytes)

                    media_summary = MediaSummary(
                        mediaId=media_id,
                        mediaType="image",
                        metadataStatus="complete" if exif_meta.capture_date else "partial",
                        exactGpsSaved=save_exact_gps and bool(gps_info and "latitude" in gps_info),
                        c2paStatus="not_present",
                        dateConsistency=ConsistencyStatus.consistent if exif_meta.capture_date else ConsistencyStatus.unknown,
                        locationConsistency=ConsistencyStatus.consistent if gps_info else ConsistencyStatus.unknown,
                        priorContextConsistency=ConsistencyStatus.consistent if not matching_pages else ConsistencyStatus.unknown,
                        earliestObservedMatchAt=earliest_match,
                        limitations=media_limits,
                    )
                    media_summaries.append(media_summary)

                    if exif_meta.capture_date:
                        timeline_events.append(
                            TimelineEvent(
                                eventId=_id("evt"),
                                timelineType=TimelineType.observed_media_history,
                                dateType=DateType.exif_capture,
                                occurredAt=exif_meta.capture_date,
                                description=f"Image capture timestamp reported in EXIF metadata ({exif_meta.camera_make or 'Device'})",
                                sourceUrl=None,
                                dateConfidence=EvidenceConfidence.medium,
                            )
                        )
                completed_stages.append(OperationStage.analyzing_media.value)

            # Stage 8: building_timeline
            await update_stage(OperationStage.building_timeline, 90, "Assembling chronology and claim evolution")
            if await check_cancellation():
                await firestore_repo.update_operation(operation_id, {"state": OperationState.cancelled.value, "stage": OperationStage.complete.value})
                return

            if published_date:
                timeline_events.append(
                    TimelineEvent(
                        eventId=_id("evt"),
                        timelineType=TimelineType.claim_evidence,
                        dateType=DateType.published,
                        occurredAt=published_date,
                        description=f"Article publication date reported by {url_to_analyze}",
                        sourceUrl=url_to_analyze,
                        dateConfidence=EvidenceConfidence.high,
                    )
                )
            completed_stages.append(OperationStage.building_timeline.value)

            # Stage 9: saving_report
            await update_stage(OperationStage.saving_report, 95, "Saving verified report to user journal")

            journal_entry = JournalEntry(
                contractVersion="1.0",
                entryId=entry_id,
                inputType=InputType(input_type),
                title=title,
                status=OperationState.complete,
                evidenceStatus=synthesis.get("evidenceStatus"),
                evidenceConfidence=synthesis.get("evidenceConfidence"),
                createdAt=_now_iso(),
                updatedAt=_now_iso(),
                canonicalUrl=url_to_analyze,
                factCheckProviderStatus=fact_check_status,
                assessmentExplanation=synthesis.get("assessmentExplanation"),
                claims=claims,
                evidence=evidence_items,
                timeline=timeline_events,
                media=media_summaries,
                reflection={
                    "initialReflection": raw_input.get("initialReflection"),
                    "initialConfidence": raw_input.get("initialConfidence"),
                    "updatedReflection": None,
                    "updatedConfidence": None,
                },
                limitations=synthesis.get("limitations", []),
            )

            # Persist to owner's journal
            await firestore_repo.create_journal_entry(owner_uid, journal_entry.model_dump())
            await firestore_repo.save_claims(owner_uid, entry_id, [c.model_dump() for c in claims])
            await firestore_repo.save_evidence(owner_uid, entry_id, [e.model_dump() for e in evidence_items])
            await firestore_repo.save_timeline(owner_uid, entry_id, [t.model_dump() for t in timeline_events])
            await firestore_repo.save_media(owner_uid, entry_id, [m.model_dump() for m in media_summaries])

            completed_stages.append(OperationStage.saving_report.value)
            completed_stages.append(OperationStage.complete.value)

            # Mark operation terminal complete
            await firestore_repo.update_operation(
                operation_id,
                {
                    "state": OperationState.complete.value,
                    "stage": OperationStage.complete.value,
                    "progressPercent": 100,
                    "message": "Verification complete and report saved to journal.",
                    "completedStages": completed_stages,
                    "resultUrl": f"/api/v1/journal/entries/{entry_id}",
                    "partialResult": partial_result.model_dump(),
                },
            )
            logger.info(f"Operation {operation_id} completed successfully for UID {owner_uid}")

        except Exception as e:
            logger.error(f"Operation {operation_id} failed at stage: {e}")
            err_code = "INTERNAL_ERROR"
            err_msg = str(e)
            if isinstance(e, VeriJournalException):
                err_code = e.code
                err_msg = e.message

            await firestore_repo.update_operation(
                operation_id,
                {
                    "state": OperationState.failed.value,
                    "progressPercent": 100,
                    "message": err_msg[:300],
                    "completedStages": completed_stages,
                    "error": {
                        "contractVersion": "1.0",
                        "error": {
                            "code": err_code,
                            "message": err_msg[:500],
                            "retryable": True,
                            "requestId": f"op_{operation_id}",
                        },
                    },
                },
            )


verification_worker = VerificationWorker()

