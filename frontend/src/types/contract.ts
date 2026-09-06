/**
 * Canonical Types matching contracts/openapi.yaml version 1.0.0
 * DO NOT ALTER CONTRACT DEFINITIONS.
 */

export type Identifier = string;

export interface HealthResponse {
  status: 'ok';
}

export interface CapabilitiesResponse {
  contractVersion: '1.0';
  capabilities: {
    textVerification: boolean;
    urlVerification: boolean;
    socialVerification: boolean;
    imageProvenance: boolean;
    youtubeVideo: boolean;
    shortVideoUpload: boolean;
    c2paInspection: boolean;
    maps: boolean;
    appCheckEnforced: boolean;
    maintenanceMode: boolean;
  };
}

export interface ReflectionSeed {
  initialReflection?: string | null;
  initialConfidence?: number | null; // 0..100
}

export interface TextVerificationRequest {
  text: string;
  initialReflection?: string | null;
  initialConfidence?: number | null;
}

export interface UrlVerificationRequest {
  url: string;
  initialReflection?: string | null;
  initialConfidence?: number | null;
}

export interface SocialVerificationRequest {
  url: string;
  accompanyingClaim?: string | null;
  initialReflection?: string | null;
  initialConfidence?: number | null;
}

export interface MediaVerificationRequest {
  file: File | Blob;
  accompanyingClaim?: string | null;
  initialReflection?: string | null;
  initialConfidence?: number | null;
  saveExactGps?: boolean;
}

export interface OperationAccepted {
  contractVersion: '1.0';
  operationId: Identifier;
  status: 'queued';
  statusUrl: string;
}

export type OperationState =
  | 'pending'
  | 'queued'
  | 'processing'
  | 'partial'
  | 'complete'
  | 'failed'
  | 'cancelled';

export type OperationStage =
  | 'validating_input'
  | 'checking_url'
  | 'extracting_content'
  | 'extracting_claims'
  | 'checking_fact_checks'
  | 'retrieving_evidence'
  | 'analyzing_media'
  | 'building_timeline'
  | 'saving_report'
  | 'complete';

export type FactCheckProviderStatus =
  | 'matched'
  | 'no_match'
  | 'unavailable'
  | 'invalid_response'
  | 'disabled';

export type EvidenceStatus =
  | 'supported'
  | 'contradicted'
  | 'mixed'
  | 'insufficient_evidence'
  | 'could_not_complete';

export type EvidenceConfidence = 'low' | 'medium' | 'high';

export type ConsistencyStatus =
  | 'consistent'
  | 'conflicting'
  | 'unknown'
  | 'not_analyzed';

export type CheckWorthiness = 'high' | 'medium' | 'low';

export interface Claim {
  claimId: Identifier;
  claimText: string;
  speaker?: string | null;
  claimDate?: string | null; // date-time
  locations?: string[];
  entities?: string[];
  checkWorthiness: CheckWorthiness;
}

export type EvidenceStance =
  | 'supports'
  | 'contradicts'
  | 'contextual'
  | 'insufficient';

export interface EvidenceItem {
  evidenceId: Identifier;
  claimId: Identifier;
  sourceUrl: string;
  sourceTitle: string;
  publisher?: string | null;
  stance: EvidenceStance;
  publishedAt?: string | null;
  retrievedAt: string;
  excerpt?: string | null;
}

export type TimelineType =
  | 'claim_evidence'
  | 'observed_media_history'
  | 'video_content';

export type DateType =
  | 'published'
  | 'modified'
  | 'retrieved'
  | 'claimed_event'
  | 'exif_capture'
  | 'fact_check_review'
  | 'video_timestamp';

export interface TimelineEvent {
  eventId: Identifier;
  timelineType: TimelineType;
  dateType: DateType;
  occurredAt: string;
  description: string;
  sourceUrl?: string | null;
  dateConfidence?: 'low' | 'medium' | 'high';
}

export type C2paStatus =
  | 'trusted'
  | 'valid_untrusted_signer'
  | 'invalid'
  | 'not_present'
  | 'unsupported'
  | 'not_checked';

export interface MediaSummary {
  mediaId?: Identifier;
  mediaType?: 'image' | 'video';
  metadataStatus?: 'complete' | 'partial' | 'absent' | 'unavailable';
  exactGpsSaved?: boolean;
  c2paStatus?: C2paStatus;
  dateConsistency?: ConsistencyStatus;
  locationConsistency?: ConsistencyStatus;
  priorContextConsistency?: ConsistencyStatus;
  earliestObservedMatchAt?: string | null;
  limitations?: string[];
}

export interface Reflection {
  initialReflection?: string | null;
  initialConfidence?: number | null;
  updatedReflection?: string | null;
  updatedConfidence?: number | null;
}

export interface ReflectionUpdate {
  updatedReflection?: string | null;
  updatedConfidence: number;
}

export interface ValidatedPartialResult {
  safeBrowsingStatus?: 'known_threat' | 'no_known_threat' | 'unavailable' | null;
  publisherRegistryMatch?:
    | 'recognized'
    | 'unknown'
    | 'possible_impersonation'
    | 'not_applicable'
    | null;
  claims?: Claim[];
  analysisCoverage?: Record<
    string,
    'complete' | 'partial' | 'unavailable' | 'not_applicable' | 'not_completed'
  >;
}

export interface ApiError {
  contractVersion: '1.0';
  error: {
    code: string;
    message: string;
    retryable: boolean;
    requestId: string;
  };
}

export interface OperationStatus {
  contractVersion: '1.0';
  operationId: Identifier;
  status: OperationState;
  stage: OperationStage;
  progressPercent: number; // 0..100
  message?: string | null;
  completedStages: OperationStage[];
  partialResult?: ValidatedPartialResult | null;
  resultUrl?: string | null;
  error?: ApiError | null;
  updatedAt: string;
}

export type JournalInputType =
  | 'text'
  | 'article_url'
  | 'social_post'
  | 'image'
  | 'youtube_video'
  | 'video_upload'
  | 'export';

export interface JournalEntrySummary {
  entryId: Identifier;
  inputType: JournalInputType;
  title?: string | null;
  status: OperationState;
  evidenceStatus?: EvidenceStatus | null;
  evidenceConfidence?: EvidenceConfidence | null;
  createdAt: string;
  updatedAt: string;
}

export interface JournalEntry {
  contractVersion: '1.0';
  entryId: Identifier;
  inputType: JournalInputType;
  title?: string | null;
  status: OperationState;
  evidenceStatus?: EvidenceStatus | null;
  evidenceConfidence?: EvidenceConfidence | null;
  createdAt: string;
  updatedAt: string;
  canonicalUrl?: string | null;
  factCheckProviderStatus?: FactCheckProviderStatus | null;
  assessmentExplanation?: string | null;
  claims: Claim[];
  evidence: EvidenceItem[];
  timeline: TimelineEvent[];
  media?: MediaSummary[];
  reflection: Reflection;
  limitations: string[];
}

export interface JournalEntryPage {
  contractVersion: '1.0';
  entries: JournalEntrySummary[];
  nextCursor?: string | null;
}

export interface ChatRequest {
  message: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  citations?: Array<{
    title: string;
    url: string;
  }>;
}
