"""Server-side Gemini gateway on Vertex AI / Gemini API with retry policy and structured output."""
import asyncio
import json
import random
from typing import AsyncGenerator, List, Optional
import uuid

from app.core.config import settings
from app.core.errors import VeriJournalException
from app.core.logging import logger
from app.models.schemas import (
    CheckWorthiness,
    Claim,
    EvidenceConfidence,
    EvidenceItem,
    EvidenceStance,
    EvidenceStatus,
    Identifier,
)
from app.services.ai.prompts import (
    CLAIM_EXTRACTION_SYSTEM_PROMPT,
    ENTRY_CHAT_SYSTEM_PROMPT,
    EVIDENCE_SYNTHESIS_SYSTEM_PROMPT,
)

# Try initializing google-genai client
_genai_client = None
try:
    from google import genai
    from google.genai import types

    if settings.gemini_api_key:
        _genai_client = genai.Client(api_key=settings.gemini_api_key)
        logger.info("Initialized Gemini Client with API key.")
    elif settings.use_vertex_ai and not settings.dev_mode:
        _genai_client = genai.Client(
            vertexai=True,
            project=settings.google_cloud_project,
            location=settings.google_cloud_location,
        )
        logger.info("Initialized Gemini Client with Vertex AI ADC.")
except Exception as e:
    logger.info(f"Google GenAI client initialization skipped: {e}")


def _generate_id(prefix: str = "id") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


class GeminiGateway:
    def __init__(self, client=None):
        self.client = client or _genai_client
        self.primary_model = settings.gemini_model_primary
        self.fallback_model = settings.gemini_model_fallback

    async def _call_with_retry(self, fn, max_retries: int = 3):
        """Bounded exponential backoff with jitter on 429/500/503. No retry on validation/safety errors."""
        attempt = 0
        last_err = None
        while attempt < max_retries:
            try:
                return await fn()
            except Exception as e:
                err_str = str(e).lower()
                is_retryable = any(code in err_str for code in ["429", "500", "503", "resource_exhausted", "unavailable"])
                if not is_retryable:
                    if "safety" in err_str or "blocked" in err_str:
                        raise VeriJournalException(code="AI_SAFETY_BLOCK", message="Content was blocked by safety policy.")
                    raise VeriJournalException(code="PROVIDER_INVALID_RESPONSE", message=f"Gemini API call failed: {e}")

                attempt += 1
                last_err = e
                if attempt >= max_retries:
                    break
                sleep_time = (2 ** attempt) + random.uniform(0.1, 0.5)
                logger.warning(f"Retryable Gemini error (attempt {attempt}/{max_retries}): {e}. Retrying in {sleep_time:.2f}s")
                await asyncio.sleep(sleep_time)

        raise VeriJournalException(code="PROVIDER_UNAVAILABLE", message=f"Gemini service unavailable after {max_retries} attempts: {last_err}")

    async def extract_claims(self, text: str) -> List[Claim]:
        """Extracts at most 3 atomic check-worthy claims from untrusted text."""
        if not settings.gemini_enabled:
            raise VeriJournalException(code="FEATURE_DISABLED", message="Gemini AI feature is currently disabled.")

        bounded_text = text[:30000]

        if not self.client:
            # Deterministic mock extraction for tests and dev without credentials
            first_sentence = bounded_text.split(".")[0].strip() or "Primary statement extracted from input"
            return [
                Claim(
                    claimId=_generate_id("clm"),
                    claimText=first_sentence[:300],
                    speaker=None,
                    claimDate=None,
                    locations=[],
                    entities=[],
                    checkWorthiness=CheckWorthiness.high,
                )
            ]

        user_content = f"<untrusted_input>\n{bounded_text}\n</untrusted_input>"

        async def _invoke():
            from google.genai import types
            config = types.GenerateContentConfig(
                system_instruction=CLAIM_EXTRACTION_SYSTEM_PROMPT,
                temperature=0.1,
                max_output_tokens=settings.max_output_tokens,
                response_mime_type="application/json",
            )
            response = await self.client.aio.models.generate_content(
                model=self.primary_model,
                contents=user_content,
                config=config,
            )
            return response.text

        raw_json = await self._call_with_retry(_invoke)
        try:
            data = json.loads(raw_json)
            extracted_claims = []
            for item in data.get("claims", [])[:3]:
                cid = _generate_id("clm")
                cw = item.get("checkWorthiness", "high").lower()
                worthiness = CheckWorthiness.high if cw == "high" else (CheckWorthiness.medium if cw == "medium" else CheckWorthiness.low)
                extracted_claims.append(
                    Claim(
                        claimId=cid,
                        claimText=item.get("claimText", "")[:2000],
                        speaker=item.get("speaker"),
                        claimDate=item.get("claimDate"),
                        locations=item.get("locations", [])[:10],
                        entities=item.get("entities", [])[:20],
                        checkWorthiness=worthiness,
                    )
                )
            if not extracted_claims:
                extracted_claims.append(
                    Claim(
                        claimId=_generate_id("clm"),
                        claimText=bounded_text[:300],
                        speaker=None,
                        claimDate=None,
                        locations=[],
                        entities=[],
                        checkWorthiness=CheckWorthiness.medium,
                    )
                )
            return extracted_claims
        except Exception as e:
            logger.error(f"Failed to parse Gemini claims response: {e}")
            raise VeriJournalException(code="PROVIDER_INVALID_RESPONSE", message="Model returned invalid claim schema.")

    async def synthesize_evidence(
        self,
        claims: List[Claim],
        evidence_items: List[EvidenceItem],
    ) -> dict:
        """Synthesizes collected evidence items to assess evidence status and confidence."""
        if not evidence_items:
            return {
                "evidenceStatus": EvidenceStatus.insufficient_evidence,
                "evidenceConfidence": EvidenceConfidence.low,
                "assessmentExplanation": "Insufficient independent evidence was found to corroborate or contradict the extracted claims.",
                "evidenceItemStances": [],
                "limitations": ["No corroborating or debunking sources discovered in current fact checks or search indexes."],
            }

        if not self.client:
            # Deterministic synthesis for test harness
            return {
                "evidenceStatus": EvidenceStatus.supported if len(evidence_items) > 1 else EvidenceStatus.insufficient_evidence,
                "evidenceConfidence": EvidenceConfidence.medium if len(evidence_items) > 1 else EvidenceConfidence.low,
                "assessmentExplanation": f"Assessment synthesized based on {len(evidence_items)} retrieved evidence source(s).",
                "evidenceItemStances": [
                    {
                        "evidenceId": e.evidenceId,
                        "stance": e.stance.value,
                        "excerpt": e.excerpt,
                    }
                    for e in evidence_items
                ],
                "limitations": ["Investigation relies on currently published search results."],
            }

        prompt_data = {
            "claims": [c.model_dump() for c in claims],
            "evidence": [e.model_dump() for e in evidence_items],
        }
        user_content = f"<retrieved_evidence>\n{json.dumps(prompt_data, indent=2)}\n</retrieved_evidence>"

        async def _invoke():
            from google.genai import types
            config = types.GenerateContentConfig(
                system_instruction=EVIDENCE_SYNTHESIS_SYSTEM_PROMPT,
                temperature=0.2,
                max_output_tokens=settings.max_output_tokens,
                response_mime_type="application/json",
            )
            response = await self.client.aio.models.generate_content(
                model=self.primary_model,
                contents=user_content,
                config=config,
            )
            return response.text

        raw_json = await self._call_with_retry(_invoke)
        try:
            data = json.loads(raw_json)
            status_str = data.get("evidenceStatus", "insufficient_evidence")
            conf_str = data.get("evidenceConfidence", "low")

            status = EvidenceStatus(status_str) if status_str in EvidenceStatus._value2member_map_ else EvidenceStatus.insufficient_evidence
            confidence = EvidenceConfidence(conf_str) if conf_str in EvidenceConfidence._value2member_map_ else EvidenceConfidence.low

            return {
                "evidenceStatus": status,
                "evidenceConfidence": confidence,
                "assessmentExplanation": data.get("assessmentExplanation", "")[:5000],
                "evidenceItemStances": data.get("evidenceItemStances", []),
                "limitations": data.get("limitations", []),
            }
        except Exception as e:
            logger.error(f"Failed to parse evidence synthesis response: {e}")
            return {
                "evidenceStatus": EvidenceStatus.could_not_complete,
                "evidenceConfidence": EvidenceConfidence.low,
                "assessmentExplanation": "Synthesis schema parsing failed.",
                "evidenceItemStances": [],
                "limitations": ["AI response formatting failure."],
            }

    async def stream_chat(
        self,
        entry_summary: dict,
        chat_history: List[dict],
        new_message: str,
    ) -> AsyncGenerator[str, None]:
        """Authenticated SSE streaming for entry chat."""
        if not settings.gemini_enabled:
            raise VeriJournalException(code="FEATURE_DISABLED", message="Chat feature is currently disabled.")

        context_header = (
            f"JOURNAL ENTRY CONTEXT:\n"
            f"Title: {entry_summary.get('title')}\n"
            f"Evidence Status: {entry_summary.get('evidenceStatus')}\n"
            f"Evidence Confidence: {entry_summary.get('evidenceConfidence')}\n"
            f"Assessment: {entry_summary.get('assessmentExplanation')}\n"
            f"Claims: {json.dumps(entry_summary.get('claims', []))}\n"
            f"Evidence Items: {json.dumps(entry_summary.get('evidence', []))}\n"
            f"Limitations: {json.dumps(entry_summary.get('limitations', []))}\n\n"
        )

        if not self.client:
            # Deterministic streaming simulation for tests
            tokens = [
                "I ", "have ", "reviewed ", "the ", "evidence ", "for ", "this ", "entry. ",
                "Based ", "on ", "the ", "recorded ", "sources, ",
                f"the status is {entry_summary.get('evidenceStatus', 'insufficient_evidence')}. ",
                "Let me know if you would like more detail on specific claims."
            ]
            for t in tokens:
                await asyncio.sleep(0.05)
                yield f"data: {json.dumps({'text': t})}\n\n"
            yield "data: [DONE]\n\n"
            return

        # Prepare messages
        messages_payload = [context_header]
        for msg in chat_history[-6:]:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            messages_payload.append(f"{role.upper()}: {content}")
        messages_payload.append(f"USER: {new_message}")
        full_prompt = "\n\n".join(messages_payload)

        try:
            from google.genai import types
            config = types.GenerateContentConfig(
                system_instruction=ENTRY_CHAT_SYSTEM_PROMPT,
                temperature=0.3,
                max_output_tokens=settings.max_output_tokens,
            )
            async for chunk in await self.client.aio.models.generate_content_stream(
                model=self.primary_model,
                contents=full_prompt,
                config=config,
            ):
                if chunk.text:
                    yield f"data: {json.dumps({'text': chunk.text})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.error(f"Chat streaming error: {e}")
            yield f"data: {json.dumps({'error': 'Streaming interrupted due to provider error.'})}\n\n"
            yield "data: [DONE]\n\n"


gemini_gateway = GeminiGateway()

