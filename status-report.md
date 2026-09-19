
---

### Required Status Report

#### Implemented and verified
- **Frontend Test Suite & Static Analysis:**
  - `npm test`: 27 of 27 Vitest unit and integration tests passing (`1.52s`).
  - `npm run lint`: ESLint and `tsc --noEmit` pass with zero errors and zero warnings.
  - `npm run build`: Production bundle built cleanly into `dist/`.
- **Backend Test Suite & Isolation:**
  - `uv run pytest`: 22 of 22 test cases passing (`test_auth.py`, `test_contracts.py`, `test_fact_check.py`, `test_idempotency.py`, `test_isolation.py`, `test_pipeline.py`, `test_redaction.py`, `test_ssrf.py`).
- **Cloud Run Deployments & IAM:**
  - `verijournal-ai-api`: Deployed on Cloud Run, verified reachable over HTTPS.
  - `verijournal-ai-worker`: Deployed on Cloud Run as a private service protected by Cloud Tasks OIDC token validation.
  - Dedicated service accounts (`verijournal-ai-api`, `verijournal-ai-worker`, `verijournal-ai-task-invoker`) configured with least-privilege IAM roles.
- **Live Deployed API Verification:**
  - `GET /api/v1/health` -> HTTP 200 OK (`{"status": "ok"}`).
  - `GET /api/v1/me/capabilities` -> HTTP 200 OK with authentic Firebase ID token.
  - `POST /api/v1/verifications/text` -> HTTP 202 Accepted with canonical `Location` and `Retry-After` headers and `operationId`.
  - Durable polling on `GET /api/v1/operations/{op_id}` -> Returns stage transitions and progress updates.
- **Frontend Hosting & Security Headers:**
  - Frontend hosted on Firebase Hosting with strict CSP allowing Google Auth frames and Cloud Run API connections.
  - Preflight CORS requests (`OPTIONS`) from the hosting origin return HTTP 200 with credentials permitted.
  - Client-side mock user bypass removed so genuine user tokens are dispatched to the backend.

#### Implemented but not externally verified
- **Third-Party External APIs (Tavily, Google Fact Check, Safe Browsing):**
  - Fallback logic and validation schemas are fully implemented in the pipeline. Live external calls depend on optional secret provisioning in Secret Manager (`GOOGLE_FACTCHECK_API_KEY`, `TAVILY_API_KEY`, `GOOGLE_SAFE_BROWSING_API_KEY`); when absent, the system safely falls back to Vertex AI search and structured synthesis.

#### Blocked—user action required
- **No blocking items for core functionality.** All primary flows (authentication, text verification, queuing, processing, persistence, and hosting) are operational. Optional operational keys can be injected into Secret Manager as desired.

#### Deferred or feature-flagged
- `FLAG_SHORT_VIDEO_UPLOAD_ENABLED`: Default `false` in `contracts/feature-flags.json`.
- `FLAG_C2PA_INSPECTION_ENABLED`: Default `false` in `contracts/feature-flags.json`.
- `FLAG_MAPS_ENABLED`: Default `false` in `contracts/feature-flags.json`.
- `FLAG_APP_CHECK_ENFORCED`: Default `false` (App Check registration optional per environment).