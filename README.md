# VeriJournal AI — Personal News & Integrity Journal

**Version**: 1.0.0  
**Contract Version**: 1.0  
**Architecture**: React (TypeScript) frontend + Python 3.12+ (FastAPI) on Google Cloud Run + Firebase Authentication + Cloud Firestore + Cloud Storage + Cloud Tasks + Gemini on Vertex AI.

---

## 1. Architectural Overview & Trust Model

VeriJournal AI is an authenticated personal fact-checking and integrity journal. It enables users to submit news articles, social posts, direct images, and text claims for multi-stage verification grounded in search evidence and official Fact Check Tools, while fostering epistemic reflection.

```text
[ Browser / React Client ]
         │  HTTPS (Bearer <Firebase-ID-token>)
         ▼
[ FastAPI on Cloud Run (Public Ingress) ]
   ├── Request-ID & Security Headers Middleware (CSP, HSTS, no-sniff)
   ├── Firebase Token Verification (Derives UID strictly from token; rejects client UIDs)
   ├── Rate Limiting & Quota Guards (Per-UID sliding window)
   ├── Idempotency Service (Deduplicates submissions via Idempotency-Key)
   └── Cloud Tasks Publisher (Publishes minimal task {operationId, contractVersion: "1.0"})
         │
         │  HTTP 202 Accepted {operationId, status: "queued", statusUrl}
         ▼
[ Google Cloud Tasks Queue ]
         │  OIDC Authenticated HTTP POST (Dedicated invoker SA)
         ▼
[ FastAPI Worker Endpoint /internal/tasks/worker ]
   ├── Stage 1: Validating Input
   ├── Stage 2: Checking URL (Google Safe Browsing v4 + Domain Impersonation Heuristics)
   ├── Stage 3: Extracting Content (Hardened SSRF-Safe Fetcher with Pre-Resolution)
   ├── Stage 4: Extracting Claims (Gemini on Vertex AI - max 3 atomic claims)
   ├── Stage 5: Checking Fact Checks (Google Fact Check Tools API v1alpha1)
   ├── Stage 6: Retrieving Evidence (Search-grounded RAG + Evidence Ledger)
   ├── Stage 7: Analyzing Media (Pillow Magic Bytes, EXIF/GPS Privacy, Web Detection)
   ├── Stage 8: Building Timeline (Claim Evolution, Observed Media, Published Dates)
   └── Stage 9: Saving Report (Durable persistence in owner's Firestore subcollections)
```

### Trust Boundaries & Security Decisions
- **Zero Client Secrets**: No Gemini API keys, Google Cloud service account keys, or third-party secrets exist on the client.
- **Firebase Token Boundary**: Authentication is enforced on every protected route. User identity (`uid`) is derived exclusively from verified cryptographic token claims, never from request bodies or parameters.
- **Strict Tenant Isolation**: All personal journal data resides under `users/{uid}/journal_entries/{entryId}/...`. Operations, chats, and reflections are strictly owner-scoped. Cross-tenant access attempts return `404 Not Found` to prevent existence leakage.
- **SSRF & DNS Rebinding Defenses**: Safe URL fetcher validates HTTP/HTTPS schemes, pre-resolves DNS before connection, and strictly blocks private (RFC 1918), loopback (`127.0.0.1`, `::1`), link-local metadata (`169.254.169.254`), and multicast addresses on every resolution and redirect hop.
- **Data-Only Prompt Envelopes**: Scraped text, search snippets, and external content are treated as untrusted candidates and delimited in `<untrusted_input>` and `<retrieved_evidence>` envelopes to mitigate indirect prompt injection.
- **Transparent Evidence Confidence**: Replaces misleading truth percentages with categorical `evidenceStatus` (`supported`, `contradicted`, `mixed`, `insufficient_evidence`, `could_not_complete`) and `evidenceConfidence` (`low`, `medium`, `high`).
- **Observed Media History**: Reverse-image search results are labeled as *Observed Media History* and explicitly disclaim being the definitive "first-ever publication".
- **Privacy-Safe GPS**: Precise EXIF GPS coordinates are stripped by default and never passed to the AI model. Coordinates are stored only upon explicit opt-in (`saveExactGps: true`).

---

## 2. P0, P1, and P2 Implementation Status

| Tier | Control Area | Status | Implementation Details |
|---|---|---|---|
| **P0** | Firebase Authentication | **Implemented & Tested** | `app/auth/firebase.py` verifies tokens using Firebase Admin SDK; derives UID from token. |
| **P0** | Tenant & Object Isolation | **Implemented & Tested** | `app/repositories/firestore.py` and `firestore.rules` enforce owner prefix `users/{uid}/...`. |
| **P0** | Secret Protection | **Implemented & Tested** | Google Cloud Secret Manager integration and zero secrets in client bundle. |
| **P0** | Input/Output Schemas | **Implemented & Tested** | Pydantic v2 schemas strictly matching `contracts/openapi.yaml`. |
| **P0** | Server-Side AI Access | **Implemented & Tested** | `app/services/ai/gemini_gateway.py` with Vertex AI Application Default Credentials (ADC). |
| **P0** | SSRF Defense | **Implemented & Tested** | `app/services/scraping/safe_fetch.py` with pre-resolution, redirect re-checks, and IP filters. |
| **P0** | Request & Body Limits | **Implemented & Tested** | `PayloadLimitMiddleware` enforces body size bounds (413 on oversized requests). |
| **P0** | Safe Structured Logging | **Implemented & Tested** | `app/core/logging.py` redacts tokens, API keys, passwords, and precise GPS coordinates. |
| **P0** | Rate Limiting & Kill Switches| **Implemented & Tested** | `app/services/abuse/rate_limiter.py` per-UID limit; `capability_service.py` kill switches. |
| **P0** | Error Code Mapping | **Implemented & Tested** | `app/core/errors.py` strictly mapping to `contracts/error-codes.json`. |
| **P0** | Cloud Tasks Worker Queue | **Implemented & Tested** | Asynchronous 202 Accepted pattern with OIDC worker authentication and transactional leases. |
| **P0** | CI Gates & Tests | **Implemented & Tested** | 22 backend pytest tests and 27 frontend vitest tests passing with 0 warnings. |
| **P1** | App Check Rollout | **Configured** | Server-side flag `app_check_enforced` ready for staged enforcement. |
| **P1** | User Export & Deletion | **Implemented & Tested** | `POST /api/v1/me/export` and `DELETE /api/v1/journal/entries/{id}` for GDPR compliance. |
| **P2** | Load & Disaster Testing | **Deferred** | Advanced multi-region failover and penetration testing deferred to enterprise tier. |

---

## 3. Local Development Setup & Verification

### Prerequisites
- **Python**: 3.12 or 3.13 (`uv` package manager recommended)
- **Node.js**: v20+ or v22+ (`npm`)
- **Google Cloud SDK**: `gcloud` installed

### 1. Frontend Setup & Verification
```bash
cd frontend
npm ci
npm run lint      # Runs eslint src && tsc --noEmit (0 warnings)
npm run test      # Runs vitest test suites (27 tests passing)
npm run build     # Builds production dist bundle
```

### 2. Backend Setup & Verification
```bash
cd backend
# Create virtual environment and install all dependencies
uv sync --extra dev

# Run code formatting and linter
uv run ruff check .

# Run automated backend test suites (22 tests passing)
uv run pytest
```

### 3. Running Stack Locally
```bash
# Terminal 1: Run FastAPI backend on port 8000
cd backend
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Run Vite frontend on port 3000
cd frontend
npm run dev
```
---

## 4. Security & Privacy Guarantees

1. **Minors & Children's Data**: VeriJournal AI is intended for general audiences aged 18 and older. It does not knowingly collect, profile, or process data from minors.
2. **Right to Erasure (GDPR/CCPA)**: Users can permanently delete any journal entry via `DELETE /api/v1/journal/entries/{entryId}`, which immediately purges the entry and its claims, evidence, timeline, media metadata, and chat messages.
3. **Data Portability**: Users can export their complete historical journal via `POST /api/v1/me/export`, which compiles all investigations into an owner-isolated JSON archive.
4. **Log Privacy**: Structured logs redact authorization tokens, API keys, passwords, and precise GPS coordinates using regex sanitization filters.

