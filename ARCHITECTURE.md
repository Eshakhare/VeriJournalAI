# VeriJournal AI Architecture & Security Boundaries

## 1. System Topology
- **Frontend Presentation Layer:** Static SPA served via Firebase Hosting over HTTPS.
- **Public API Layer:** Containerized FastAPI application hosted on Cloud Run (`verijournal-ai-api`), network-accessible via HTTPS, secured at the application layer via Firebase ID Token verification (`Authorization: Bearer <token>`).
- **Asynchronous Task Queue:** Cloud Tasks queue (`verijournal-ai-verification`) buffering verification jobs.
- **Private Worker Layer:** Containerized FastAPI application on Cloud Run (`verijournal-ai-worker`), private (`--no-allow-unauthenticated`), invocable strictly via Cloud Tasks with Google OIDC identity tokens.
- **Persistence & Storage:** Cloud Firestore (Native mode) and Google Cloud Storage (Private media bucket with Uniform Bucket-Level Access).
- **Intelligence Layer:** Google Cloud Vertex AI (Gemini 2.5 Flash / Gemini 2.5 Pro) accessed through service-account ADC.

## 2. Trust Boundaries & Identity Model
1. **End-User Identity:**
   - Users authenticate with Google Sign-In via Firebase Authentication.
   - The frontend transmits short-lived Firebase ID tokens in the `Authorization` header.
   - The API verifies token signatures, project claims, expiry, and revocation via Firebase Admin SDK.
   - The user's UID is derived strictly from the verified token. All Firestore journal entries and operations are strictly partitioned under `users/{uid}/...`.
2. **Task Invocation Identity:**
   - The API enqueues tasks containing only `{"contractVersion": "1.0", "operationId": "..."}`.
   - Cloud Tasks generates a signed Google OIDC token using `verijournal-ai-task-invoker@${PROJECT_ID}.iam.gserviceaccount.com` targeting audience `${TASK_WORKER_AUDIENCE}`.
   - The Worker validates the token signature, audience, and invoker email.
3. **Storage & Database Isolation:**
   - Firestore security rules deny all direct client-side reads/writes.
   - Backend services interact with Firestore via Google Cloud ADC.
   - GCS objects are segregated by owner UID: `uploads/{uid}/{operationId}/{mediaId}/{filename}`.