"""Canonical request, response, and domain models matching contracts/openapi.yaml."""
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from typing_extensions import Annotated

# Identifier matching ^[A-Za-z0-9_-]{16,128}$
Identifier = Annotated[
    str,
    StringConstraints(
        pattern=r"^[A-Za-z0-9_-]{16,128}$",
        min_length=16,
        max_length=128,
    ),
]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


# --- Enums matching contracts ---

class OperationState(str, Enum):
    pending = "pending"
    queued = "queued"
    processing = "processing"
    partial = "partial"
    complete = "complete"
    failed = "failed"
    cancelled = "cancelled"


class OperationStage(str, Enum):
    validating_input = "validating_input"
    checking_url = "checking_url"
    extracting_content = "extracting_content"
    extracting_claims = "extracting_claims"
    checking_fact_checks = "checking_fact_checks"
    retrieving_evidence = "retrieving_evidence"
    analyzing_media = "analyzing_media"
    building_timeline = "building_timeline"
    saving_report = "saving_report"
    complete = "complete"


class FactCheckProviderStatus(str, Enum):
    matched = "matched"
    no_match = "no_match"
    unavailable = "unavailable"
    invalid_response = "invalid_response"
    disabled = "disabled"


class EvidenceStatus(str, Enum):
    supported = "supported"
    contradicted = "contradicted"
    mixed = "mixed"
    insufficient_evidence = "insufficient_evidence"
    could_not_complete = "could_not_complete"


class EvidenceConfidence(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class ConsistencyStatus(str, Enum):
    consistent = "consistent"
    conflicting = "conflicting"
    unknown = "unknown"
    not_analyzed = "not_analyzed"


class CheckWorthiness(str, Enum):
    high = "high"
    medium = "medium"
    low = "low"


class EvidenceStance(str, Enum):
    supports = "supports"
    contradicts = "contradicts"
    contextual = "contextual"
    insufficient = "insufficient"


class TimelineType(str, Enum):
    claim_evidence = "claim_evidence"
    observed_media_history = "observed_media_history"
    video_content = "video_content"


class DateType(str, Enum):
    published = "published"
    modified = "modified"
    retrieved = "retrieved"
    claimed_event = "claimed_event"
    exif_capture = "exif_capture"
    fact_check_review = "fact_check_review"
    video_timestamp = "video_timestamp"


class InputType(str, Enum):
    text = "text"
    article_url = "article_url"
    social_post = "social_post"
    image = "image"
    youtube_video = "youtube_video"
    video_upload = "video_upload"
    export = "export"


# --- Schemas ---

class HealthResponse(StrictModel):
    status: Literal["ok"] = "ok"


class Capabilities(StrictModel):
    textVerification: bool
    urlVerification: bool
    socialVerification: bool
    imageProvenance: bool
    youtubeVideo: bool
    shortVideoUpload: bool
    c2paInspection: bool
    maps: bool
    appCheckEnforced: bool
    maintenanceMode: bool


class CapabilitiesResponse(StrictModel):
    contractVersion: Literal["1.0"] = "1.0"
    capabilities: Capabilities


class Reflection(StrictModel):
    initialReflection: Optional[str] = Field(default=None, max_length=2000)
    initialConfidence: Optional[int] = Field(default=None, ge=0, le=100)
    updatedReflection: Optional[str] = Field(default=None, max_length=2000)
    updatedConfidence: Optional[int] = Field(default=None, ge=0, le=100)


class ReflectionUpdate(StrictModel):
    updatedReflection: Optional[str] = Field(default=None, max_length=2000)
    updatedConfidence: int = Field(ge=0, le=100)


class TextVerificationRequest(StrictModel):
    text: str = Field(min_length=3, max_length=30000)
    initialReflection: Optional[str] = Field(default=None, max_length=2000)
    initialConfidence: Optional[int] = Field(default=None, ge=0, le=100)


class UrlVerificationRequest(StrictModel):
    url: str = Field(max_length=2048)
    initialReflection: Optional[str] = Field(default=None, max_length=2000)
    initialConfidence: Optional[int] = Field(default=None, ge=0, le=100)


class SocialVerificationRequest(StrictModel):
    url: str = Field(max_length=2048)
    accompanyingClaim: Optional[str] = Field(default=None, max_length=5000)
    initialReflection: Optional[str] = Field(default=None, max_length=2000)
    initialConfidence: Optional[int] = Field(default=None, ge=0, le=100)


class OperationAccepted(StrictModel):
    contractVersion: Literal["1.0"] = "1.0"
    operationId: Identifier
    status: Literal["queued"] = "queued"
    statusUrl: str


class Claim(StrictModel):
    claimId: Identifier
    claimText: str = Field(max_length=2000)
    speaker: Optional[str] = Field(default=None, max_length=300)
    claimDate: Optional[str] = None
    locations: List[str] = Field(default_factory=list, max_length=10)
    entities: List[str] = Field(default_factory=list, max_length=20)
    checkWorthiness: CheckWorthiness


class EvidenceItem(StrictModel):
    evidenceId: Identifier
    claimId: Identifier
    sourceUrl: str
    sourceTitle: str = Field(max_length=500)
    publisher: Optional[str] = Field(default=None, max_length=300)
    stance: EvidenceStance
    publishedAt: Optional[str] = None
    retrievedAt: str
    excerpt: Optional[str] = Field(default=None, max_length=1000)


class TimelineEvent(StrictModel):
    eventId: Identifier
    timelineType: TimelineType
    dateType: DateType
    occurredAt: str
    description: str = Field(max_length=1000)
    sourceUrl: Optional[str] = None
    dateConfidence: EvidenceConfidence


class MediaSummary(StrictModel):
    mediaId: Optional[Identifier] = None
    mediaType: Optional[Literal["image", "video"]] = None
    metadataStatus: Optional[Literal["complete", "partial", "absent", "unavailable"]] = None
    exactGpsSaved: Optional[bool] = False
    c2paStatus: Optional[
        Literal["trusted", "valid_untrusted_signer", "invalid", "not_present", "unsupported", "not_checked"]
    ] = None
    dateConsistency: Optional[ConsistencyStatus] = None
    locationConsistency: Optional[ConsistencyStatus] = None
    priorContextConsistency: Optional[ConsistencyStatus] = None
    earliestObservedMatchAt: Optional[str] = None
    limitations: List[str] = Field(default_factory=list)


class ValidatedPartialResult(StrictModel):
    safeBrowsingStatus: Optional[Literal["known_threat", "no_known_threat", "unavailable"]] = None
    publisherRegistryMatch: Optional[Literal["recognized", "unknown", "possible_impersonation", "not_applicable"]] = None
    claims: List[Claim] = Field(default_factory=list, max_length=3)
    analysisCoverage: Dict[str, str] = Field(default_factory=dict)


class ApiErrorDetail(StrictModel):
    code: str
    message: str = Field(max_length=500)
    retryable: bool
    requestId: str


class ApiError(StrictModel):
    contractVersion: Literal["1.0"] = "1.0"
    error: ApiErrorDetail


class OperationStatus(StrictModel):
    contractVersion: Literal["1.0"] = "1.0"
    operationId: Identifier
    status: OperationState
    stage: OperationStage
    progressPercent: int = Field(ge=0, le=100)
    message: Optional[str] = Field(default=None, max_length=300)
    completedStages: List[OperationStage] = Field(default_factory=list, max_length=12)
    partialResult: Optional[ValidatedPartialResult] = None
    resultUrl: Optional[str] = None
    error: Optional[ApiError] = None
    updatedAt: str


class JournalEntrySummary(StrictModel):
    entryId: Identifier
    inputType: InputType
    title: Optional[str] = Field(default=None, max_length=500)
    status: OperationState
    evidenceStatus: Optional[EvidenceStatus] = None
    evidenceConfidence: Optional[EvidenceConfidence] = None
    createdAt: str
    updatedAt: str


class JournalEntry(StrictModel):
    contractVersion: Literal["1.0"] = "1.0"
    entryId: Identifier
    inputType: InputType
    title: Optional[str] = Field(default=None, max_length=500)
    status: OperationState
    evidenceStatus: Optional[EvidenceStatus] = None
    evidenceConfidence: Optional[EvidenceConfidence] = None
    createdAt: str
    updatedAt: str
    canonicalUrl: Optional[str] = None
    factCheckProviderStatus: Optional[FactCheckProviderStatus] = None
    assessmentExplanation: Optional[str] = Field(default=None, max_length=5000)
    claims: List[Claim] = Field(default_factory=list, max_length=3)
    evidence: List[EvidenceItem] = Field(default_factory=list)
    timeline: List[TimelineEvent] = Field(default_factory=list)
    media: List[MediaSummary] = Field(default_factory=list)
    reflection: Optional[Reflection] = None
    limitations: List[str] = Field(default_factory=list)


class JournalEntryPage(StrictModel):
    contractVersion: Literal["1.0"] = "1.0"
    entries: List[JournalEntrySummary] = Field(default_factory=list)
    nextCursor: Optional[str] = None


class ChatRequest(StrictModel):
    message: str = Field(min_length=1, max_length=5000)

