# Integration Status Matrix — VeriJournal AI

| Component | Caller | Callee | Identity / Auth | Config / Port | Status | Verification Evidence |
|---|---|---|---|---|---|---|
| Frontend Web | Browser | Firebase Auth | Google OAuth 2.0 | `VITE_FIREBASE_*` | Verified | CSP updated, popup iframe allowed, mock leak removed |
| Frontend -> API | Browser | Cloud Run API | Firebase Bearer ID Token | `VITE_API_BASE_URL` | Verified | CORS 200 OK; GET `/me/capabilities` returns 200 OK |
| API Gateway | Cloud Run | Firestore Native | API Runtime SA | ADC (`roles/datastore.user`) | Verified | Native (default) DB read/write operational |
| API Gateway | Cloud Run | Cloud Tasks | API Runtime SA | ADC (`roles/cloudtasks.enqueuer`) | Verified | POST `/verifications/text` returns 202 Accepted |
| Cloud Tasks | Queue | Cloud Run Worker | Task Invoker SA | Google OIDC Bearer Token | Verified | Worker receiving and processing tasks |
| Worker Engine | Cloud Run | Vertex AI Gemini | Worker Runtime SA | ADC (`roles/aiplatform.user`) | Verified | Vertex AI Gemini 2.5 Flash pipeline execution |
| Worker Engine | Cloud Run | Cloud Storage | Worker Runtime SA | ADC (`roles/storage.objectUser`) | Verified | Private media bucket created with UBLA |
| Multi-User | User 2 | User 1 Resources | Firebase Bearer Token | Server UID extraction | Verified | 403 / 404 returned on cross-tenant access attempts |