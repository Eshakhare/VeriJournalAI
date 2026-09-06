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

## 4. Google Cloud Deployment Runbook

### Environment Variables
Configure the following deployment variables:
```bash
export PROJECT_ID="gen-ai-training-461815"
export REGION="us-central1"
export SERVICE_NAME="verijournal-ai"
export RUNTIME_SA="verijournal-runner@${PROJECT_ID}.iam.gserviceaccount.com"
export TASKS_INVOKER_SA="verijournal-task-invoker@${PROJECT_ID}.iam.gserviceaccount.com"
export MEDIA_BUCKET="${PROJECT_ID}-verijournal-media"
export QUEUE_NAME="verijournal-verification-queue"
```

### 1. Enable Required Google Cloud APIs
```bash
gcloud services enable \
    run.googleapis.com \
    cloudtasks.googleapis.com \
    secretmanager.googleapis.com \
    firestore.googleapis.com \
    storage.googleapis.com \
    aiplatform.googleapis.com \
    vision.googleapis.com \
    safebrowsing.googleapis.com \
    --project="${PROJECT_ID}"
```

### 2. Create Service Accounts & Grant Least Privilege IAM
```bash
# Runtime Service Account for Cloud Run
gcloud iam service-accounts create verijournal-runner \
    --display-name="VeriJournal Cloud Run Runtime SA" \
    --project="${PROJECT_ID}"

# Grant Firestore, Storage, Vertex AI, and Vision access
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/datastore.user"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/aiplatform.user"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/cloudtasks.enqueuer"

# Task Invoker Service Account for Cloud Tasks OIDC calls
gcloud iam service-accounts create verijournal-task-invoker \
    --display-name="VeriJournal Cloud Tasks Invoker SA" \
    --project="${PROJECT_ID}"

gcloud run services add-iam-policy-binding "${SERVICE_NAME}" \
    --region="${REGION}" \
    --member="serviceAccount:${TASKS_INVOKER_SA}" \
    --role="roles/run.invoker" \
    --project="${PROJECT_ID}"
```

### 3. Store Secrets in Secret Manager (Interactive Stdin)
Never pass secrets as command-line arguments to avoid shell history leakage:
```bash
# Safe Browsing API Key
gcloud secrets create GOOGLE_SAFE_BROWSING_API_KEY --project="${PROJECT_ID}"
gcloud secrets versions add GOOGLE_SAFE_BROWSING_API_KEY --data-file=- --project="${PROJECT_ID}"

# Fact Check Tools API Key
gcloud secrets create GOOGLE_FACTCHECK_API_KEY --project="${PROJECT_ID}"
gcloud secrets versions add GOOGLE_FACTCHECK_API_KEY --data-file=- --project="${PROJECT_ID}"

# Grant runtime service account access to secrets
gcloud secrets add-iam-policy-binding GOOGLE_SAFE_BROWSING_API_KEY \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/secretmanager.secretAccessor" \
    --project="${PROJECT_ID}"

gcloud secrets add-iam-policy-binding GOOGLE_FACTCHECK_API_KEY \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/secretmanager.secretAccessor" \
    --project="${PROJECT_ID}"
```

### 4. Create Cloud Tasks Queue & Storage Bucket
```bash
# Create durable verification task queue
gcloud tasks queues create "${QUEUE_NAME}" \
    --location="${REGION}" \
    --max-concurrent-dispatches=10 \
    --max-attempts=3 \
    --project="${PROJECT_ID}"

# Create private media storage bucket
gcloud storage buckets create "gs://${MEDIA_BUCKET}" \
    --location="${REGION}" \
    --uniform-bucket-level-access \
    --project="${PROJECT_ID}"

gcloud storage buckets add-iam-policy-binding "gs://${MEDIA_BUCKET}" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/storage.objectUser"
```

### 5. Deploy Cloud Firestore Rules
```bash
firebase deploy --only firestore:rules,storage
```

### 6. Build and Deploy Cloud Run Service
```bash
# Build container image via Google Cloud Build
gcloud builds submit --tag "gcr.io/${PROJECT_ID}/${SERVICE_NAME}:1.0.0" .

# Deploy to Cloud Run with least-privilege identity and secret injection
gcloud run deploy "${SERVICE_NAME}" \
    --image="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:1.0.0" \
    --region="${REGION}" \
    --service-account="${RUNTIME_SA}" \
    --allow-unauthenticated \
    --set-env-vars="GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GOOGLE_CLOUD_LOCATION=${REGION},ENVIRONMENT=production,DEV_MODE=false,MEDIA_BUCKET=${MEDIA_BUCKET},CLOUD_TASKS_QUEUE=${QUEUE_NAME},TASK_INVOKER_SERVICE_ACCOUNT=${TASKS_INVOKER_SA}" \
    --set-secrets="GOOGLE_SAFE_BROWSING_API_KEY=GOOGLE_SAFE_BROWSING_API_KEY:latest,GOOGLE_FACTCHECK_API_KEY=GOOGLE_FACTCHECK_API_KEY:latest" \
    --cpu=2 \
    --memory=2Gi \
    --min-instances=0 \
    --max-instances=10 \
    --concurrency=40 \
    --timeout=300s \
    --project="${PROJECT_ID}"
```

---

## 5. Security & Privacy Guarantees

1. **Minors & Children's Data**: VeriJournal AI is intended for general audiences aged 18 and older. It does not knowingly collect, profile, or process data from minors.
2. **Right to Erasure (GDPR/CCPA)**: Users can permanently delete any journal entry via `DELETE /api/v1/journal/entries/{entryId}`, which immediately purges the entry and its claims, evidence, timeline, media metadata, and chat messages.
3. **Data Portability**: Users can export their complete historical journal via `POST /api/v1/me/export`, which compiles all investigations into an owner-isolated JSON archive.
4. **Log Privacy**: Structured logs redact authorization tokens, API keys, passwords, and precise GPS coordinates using regex sanitization filters.

