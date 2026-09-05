# VeriJournal AI — AI Studio Technical Handoff & Governance Specification

**Contract Version**: 1.0.0  
**Application**: VeriJournal AI — Personal News & Integrity Journal  
**Specification Location**: `/contracts/openapi.yaml`  

---

## 1. Architectural Overview & Precedence

VeriJournal AI is built contract-first to guarantee rigorous multimodal verification, owner-isolated data persistence, and zero cross-user leakage.

When resolving any implementation ambiguities, the strict order of precedence is:
1. **Production System & Security Directives** (Zero data leakage, no client secrets, authenticated SSE streams).
2. **Canonical OpenAPI 3.1 Specification** (`/contracts/openapi.yaml`).
3. **Contract JSON Artifacts** (`/contracts/operation-states.json`, `/contracts/feature-flags.json`, `/contracts/error-codes.json`).
4. **Interactive Application Code & Component Tree**.

---

## 2. Zero Cross-User Data Leakage & Firestore Model

All user data is stored within strict per-user paths:

```
users/{uid}/journalEntries/{entryId}
users/{uid}/journalEntries/{entryId}/claims/{claimId}
users/{uid}/journalEntries/{entryId}/evidence/{evidenceId}
users/{uid}/journalEntries/{entryId}/timeline/{eventId}
users/{uid}/journalEntries/{entryId}/chatHistory/{messageId}
users/{uid}/operations/{operationId}
```

### Firestore Security Rule Principles
- **Authentication Required**: `request.auth != null`
- **Owner Isolation**: `request.auth.uid == uid`
- **No Global Queries**: No collection group queries spanning across user UIDs are permitted.
- **Client UID Ignored for Authority**: The backend extracts the verified user identity exclusively from the validated Firebase ID token (`request.auth.token.uid`), never trusting client-provided query parameters or payload UIDs.

---

## 3. Asynchronous 202 Operation Flow & Resilience

Every verification submission (`POST /verify/*`) responds with **HTTP 202 Accepted**:
1. **Idempotency**: The client generates a cryptographically strong UUID `Idempotency-Key` sent in request headers to safely permit retries without duplicate billing or verification jobs.
2. **Polling Loop**:
   - Client follows `statusUrl` (e.g. `/operations/{operationId}`).
   - Polling checks `If-None-Match` (ETag) to receive HTTP 304 when stages are unmodified.
   - Respects `Retry-After` headers returned by the server.
   - Pauses or slows polling to 8-second intervals when the document tab is inactive/hidden (`document.visibilityState === 'hidden'`).
   - Aborts ongoing requests upon user logout or navigation.
3. **Nine Contract Verification Stages**:
   - `1. validating_input`
   - `2. checking_url` (Safe Browsing & SSRF)
   - `3. extracting_content`
   - `4. extracting_claims`
   - `5. checking_fact_checks` (Fact Check Tools API)
   - `6. retrieving_evidence` (Search-grounded RAG)
   - `7. analyzing_media` (C2PA, EXIF, Cloud Vision)
   - `8. building_timeline` (Chronology assembly)
   - `9. saving_report` (Durable storage in user journal)
4. **Validated Partial Results**: The progress watcher only renders server-validated signals (`partialResult.safeBrowsingStatus`, `partialResult.publisherRegistryMatch`, validated claims). Never fabricates intermediate tokens.

---

## 4. Primary Enhancements Implemented

### 1. Evidence Ledger (`EvidenceLedger.tsx`)
- Structured, reproducible table of all citations linked to extracted atomic claims.
- Records publisher, source URL, publication date, retrieval date, verbatim quote excerpt, and stance (`supports`, `contradicts`, `contextual`, `insufficient`).
- Integrates Google Fact Check Tools API status (`matched`, `no_match`, `unavailable`, `invalid_response`, `disabled`).

### 2. Claim Evolution Timeline (`ClaimTimeline.tsx`)
- Distinct chronology categorizing:
  - `claim_evidence` (reported event occurrences)
  - `observed_media_history` (reverse-search match discovery dates; explicitly disclaiming earliest reverse-search match as original upload)
  - `video_content` (timecoded keyframe events)
- Explicit date confidence ratings (`high`, `medium`, `low`).

### 3. Personal Integrity Reflection (`PersonalReflectionPanel.tsx`)
- Measures individual epistemic growth without profiling or political bias inference.
- Captures pre-evidence prior confidence (0–100%) and prior reflection.
- Captures post-evidence updated confidence and reasoned reflection.
- Calculates net confidence shift delta.
- Persists via `PUT /journal/entries/{entryId}/reflection`.

---

## 5. Security & Secret Management

- **No Secrets in Browser**: Neither Gemini API keys, Google Cloud API keys, nor service account keys are accessible on the client.
- **Backend Resolution**: All third-party queries (Vertex AI, Fact Check Tools API, Safe Browsing, Vision API) run through the backend using Application Default Credentials (ADC) or Google Cloud Secret Manager.
- **Audited Markdown Sanitizer**: Stored excerpts and model-generated streaming responses are rendered through `SafeContent` (`sanitizer.tsx`), avoiding `dangerouslySetInnerHTML` and mitigating XSS.

---

## 6. Development Mock Adapter vs. Production API

- **Development (`VITE_USE_DEV_MOCK=true` or dev server fallback)**:
  - Automatically simulates realistic 202 asynchronous operations, progressive stage transitions, ETag caching, cancel/retry, and sample fact-checks.
- **Production (`VITE_API_BASE_URL` configured)**:
  - Disables dev mocking and proxies all requests to the backend server with standard `Authorization: Bearer <firebase_id_token>` authentication headers.
