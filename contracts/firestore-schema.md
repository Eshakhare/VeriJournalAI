# VeriJournal Persistence and Storage Contract
Contract version: `1.0`
This file is normative. Google AI Studio and Antigravity must use these exact paths. A path or ownership change requires a contract-version change and a migration plan.
## Ownership rule
The verified Firebase token `uid` is the only source of user identity. Never accept `uid`, `userId`, an owner path, or a bucket path from a request body. The backend constructs all paths from the verified token and server-generated identifiers.
The frontend uses Firebase directly for authentication only. All journal, operation, chat, export, and upload access goes through FastAPI. The Firebase Admin SDK bypasses Firestore and Storage rules, so every backend read and write must independently check ownership and authorization.
## Firestore paths
| Path | Purpose | Access |
|---|---|---|
| `users/{uid}` | User profile, consent, retention preferences | Owner through API; backend service account |
| `users/{uid}/journal_entries/{entryId}` | Report summary, status, input metadata, reflection | Owner through API; backend service account |
| `users/{uid}/journal_entries/{entryId}/claims/{claimId}` | Extracted atomic claims | Owner through API; backend service account |
| `users/{uid}/journal_entries/{entryId}/evidence/{evidenceId}` | Evidence metadata, stance, dates, and short excerpt | Owner through API; backend service account |
| `users/{uid}/journal_entries/{entryId}/timeline/{eventId}` | Claim, observed-media, and video-content timeline events | Owner through API; backend service account |
| `users/{uid}/journal_entries/{entryId}/media/{mediaId}` | Metadata and provenance findings | Owner through API; backend service account |
| `users/{uid}/journal_entries/{entryId}/messages/{messageId}` | User/assistant journal chat | Owner through API; backend service account |
| `users/{uid}/journal_entries/{entryId}/matches/{matchId}` | Reverse-search match metadata | Owner through API; backend service account |
| `verification_operations/{operationId}` | Minimal worker registry and lease; no journal content | Backend only |
| `feature_access/{uid}` | Server-controlled entitlement overrides | Backend/admin only |
| `idempotency/{uid_hash_key}` | Request fingerprint and operation mapping | Backend only |
Use the same server-generated value for `operationId` and `entryId` for verification operations unless a documented migration changes this convention. This makes ownership lookup deterministic while keeping the public identifier unguessable.
## Required operation registry fields
`verification_operations/{operationId}` contains only operational metadata:
- `ownerUid`
- `journalEntryPath`
- `operationType`
- `state` and `stage` from `operation-states.json`
- `progressPercent`
- `completedStages`
- `attemptCount`
- `leaseOwner`, `leaseExpiresAt`, and `taskName`
- `cancelRequested`
- `createdAt`, `updatedAt`, and optional terminal timestamps
- sanitized public error code; never raw provider bodies, tokens, article text, or prompts
Cloud Tasks payloads contain only `operationId` and a contract version. The worker loads the owner and inputs from trusted storage, validates the task's OIDC identity, acquires a lease transactionally, and writes idempotently.
## Journal entry requirements
Each entry stores:
- `ownerUid` as a defense-in-depth invariant, even though the path is already owner-scoped
- `contractVersion: "1.0"`
- the normalized input type and redacted/canonical input metadata
- analysis coverage per stage (`complete`, `partial`, `unavailable`, `not_applicable`, or `not_completed`)
- evidence status and confidence as categorical values—not a fabricated truth probability
- Fact Check Tools provider status (`matched`, `no_match`, `unavailable`, `invalid_response`, or `disabled`)
- user-authored reflection separately from model-authored analysis
- retention/deletion timestamps where applicable
Do not store entire third-party pages, raw search-result bodies, secret-bearing headers, chain-of-thought/thinking content, or unnecessary precise GPS. Store short evidence excerpts and source metadata sufficient to explain the assessment. Exact GPS is opt-in and must have a clear delete path.
## Cloud Storage paths
Private uploads and derived media use:
```text
gs://<private-bucket>/uploads/{uid}/{operationId}/{mediaId}/{serverGeneratedName}
gs://<private-bucket>/derived/{uid}/{operationId}/{mediaId}/{serverGeneratedName}
gs://<private-bucket>/exports/{uid}/{exportId}/{serverGeneratedName}
```
## Client security-rule posture
The production frontend does not read or write journal data directly. Rules should therefore deny journal writes from clients and may deny all journal reads as well. A minimal explicit posture is:
```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if false;
      match /{document=**} {
        allow read, write: if false;
      }
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```
If a later contract permits direct client reads, add narrowly scoped owner-read rules and emulator tests before enabling them. Never use `allow read, write: if true`.
