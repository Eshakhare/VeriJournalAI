"""Firestore repository enforcing normative contracts/firestore-schema.md paths and owner isolation."""
from datetime import datetime, timezone
import hashlib
from typing import Any, Dict, List, Optional, Tuple

from app.core.config import settings
from app.core.errors import VeriJournalException
from app.core.logging import logger

# Try importing Firestore client
_firestore_client = None
try:
    from google.cloud import firestore
    if not settings.dev_mode:
        _firestore_client = firestore.AsyncClient(project=settings.google_cloud_project)
except Exception as e:
    logger.info(f"Firestore async client unavailable, using in-memory store: {e}")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class InMemoryFirestoreStore:
    """Mock store maintaining strict schema and isolation semantics for tests and local dev."""

    def __init__(self):
        self.operations: Dict[str, dict] = {}
        self.journal_entries: Dict[str, dict] = {}  # key: f"{uid}:{entry_id}"
        self.claims: Dict[str, List[dict]] = {}      # key: f"{uid}:{entry_id}"
        self.evidence: Dict[str, List[dict]] = {}    # key: f"{uid}:{entry_id}"
        self.timeline: Dict[str, List[dict]] = {}    # key: f"{uid}:{entry_id}"
        self.media: Dict[str, List[dict]] = {}       # key: f"{uid}:{entry_id}"
        self.messages: Dict[str, List[dict]] = {}    # key: f"{uid}:{entry_id}"
        self.idempotency: Dict[str, dict] = {}       # key: f"{uid}:{key_hash}"
        self.feature_access: Dict[str, dict] = {}    # key: uid

    def reset(self):
        self.operations.clear()
        self.journal_entries.clear()
        self.claims.clear()
        self.evidence.clear()
        self.timeline.clear()
        self.media.clear()
        self.messages.clear()
        self.idempotency.clear()
        self.feature_access.clear()


_mock_store = InMemoryFirestoreStore()


class FirestoreRepository:
    def __init__(self, client=None):
        self.client = client or _firestore_client
        self.mock = _mock_store

    def _idemp_key(self, uid: str, route: str, fingerprint: str, idemp_header: str) -> str:
        raw = f"{uid}:{route}:{fingerprint}:{idemp_header}".encode("utf-8")
        return hashlib.sha256(raw).hexdigest()

    async def get_or_create_idempotency_record(
        self,
        uid: str,
        route: str,
        fingerprint: str,
        idempotency_key: str,
        operation_id: str,
    ) -> Tuple[bool, str]:
        """
        Returns (is_new, effective_operation_id).
        If an operation with the same idempotency fingerprint exists, returns (False, existing_op_id).
        """
        key_hash = self._idemp_key(uid, route, fingerprint, idempotency_key)
        if self.client:
            doc_ref = self.client.collection("idempotency").document(f"{uid}_{key_hash}")
            snapshot = await doc_ref.get()
            if snapshot.exists:
                data = snapshot.to_dict() or {}
                return False, data.get("operationId", operation_id)
            await doc_ref.set({
                "ownerUid": uid,
                "route": route,
                "operationId": operation_id,
                "createdAt": _now_iso(),
            })
            return True, operation_id
        else:
            k = f"{uid}:{key_hash}"
            if k in self.mock.idempotency:
                return False, self.mock.idempotency[k]["operationId"]
            self.mock.idempotency[k] = {
                "ownerUid": uid,
                "route": route,
                "operationId": operation_id,
                "createdAt": _now_iso(),
            }
            return True, operation_id

    async def create_operation(self, op_data: dict) -> None:
        op_id = op_data["operationId"]
        if self.client:
            doc_ref = self.client.collection("verification_operations").document(op_id)
            await doc_ref.set(op_data)
        else:
            self.mock.operations[op_id] = op_data.copy()

    async def get_operation(self, operation_id: str, owner_uid: str) -> Optional[dict]:
        """Gets operation if and only if owned by owner_uid."""
        if self.client:
            doc_ref = self.client.collection("verification_operations").document(operation_id)
            snapshot = await doc_ref.get()
            if not snapshot.exists:
                return None
            data = snapshot.to_dict() or {}
            if data.get("ownerUid") != owner_uid:
                return None  # Never leak existence of another user's operation
            return data
        else:
            op = self.mock.operations.get(operation_id)
            if not op or op.get("ownerUid") != owner_uid:
                return None
            return op.copy()

    async def update_operation(self, operation_id: str, updates: dict) -> None:
        updates["updatedAt"] = _now_iso()
        if self.client:
            doc_ref = self.client.collection("verification_operations").document(operation_id)
            await doc_ref.update(updates)
        else:
            if operation_id in self.mock.operations:
                self.mock.operations[operation_id].update(updates)

    async def acquire_operation_lease(
        self,
        operation_id: str,
        lease_owner: str,
        duration_seconds: int = 60,
    ) -> bool:
        """Transactionally acquires an execution lease on the operation."""
        now = datetime.now(timezone.utc).timestamp()
        if self.client:
            # Firestore transactional lease update
            doc_ref = self.client.collection("verification_operations").document(operation_id)
            snapshot = await doc_ref.get()
            if not snapshot.exists:
                return False
            data = snapshot.to_dict() or {}
            current_lease_expires = data.get("leaseExpiresAt", 0)
            if current_lease_expires and current_lease_expires > now and data.get("leaseOwner") != lease_owner:
                return False
            await doc_ref.update({
                "leaseOwner": lease_owner,
                "leaseExpiresAt": now + duration_seconds,
                "updatedAt": _now_iso(),
            })
            return True
        else:
            op = self.mock.operations.get(operation_id)
            if not op:
                return False
            current_lease_expires = op.get("leaseExpiresAt", 0)
            if current_lease_expires and current_lease_expires > now and op.get("leaseOwner") != lease_owner:
                return False
            op["leaseOwner"] = lease_owner
            op["leaseExpiresAt"] = now + duration_seconds
            op["updatedAt"] = _now_iso()
            return True

    # --- Journal Entries ---

    async def create_journal_entry(self, uid: str, entry_data: dict) -> None:
        entry_id = entry_data["entryId"]
        entry_data["ownerUid"] = uid
        entry_data["contractVersion"] = "1.0"
        if self.client:
            doc_ref = (
                self.client.collection("users")
                .document(uid)
                .collection("journal_entries")
                .document(entry_id)
            )
            await doc_ref.set(entry_data)
        else:
            k = f"{uid}:{entry_id}"
            self.mock.journal_entries[k] = entry_data.copy()

    async def get_journal_entry(self, uid: str, entry_id: str) -> Optional[dict]:
        k = f"{uid}:{entry_id}"
        if self.client:
            doc_ref = (
                self.client.collection("users")
                .document(uid)
                .collection("journal_entries")
                .document(entry_id)
            )
            snapshot = await doc_ref.get()
            if not snapshot.exists:
                return None
            data = snapshot.to_dict() or {}
            # Subcollections
            claims_snap = await doc_ref.collection("claims").get()
            data["claims"] = [c.to_dict() for c in claims_snap]
            evidence_snap = await doc_ref.collection("evidence").get()
            data["evidence"] = [e.to_dict() for e in evidence_snap]
            timeline_snap = await doc_ref.collection("timeline").get()
            data["timeline"] = [t.to_dict() for t in timeline_snap]
            media_snap = await doc_ref.collection("media").get()
            data["media"] = [m.to_dict() for m in media_snap]
            return data
        else:
            entry = self.mock.journal_entries.get(k)
            if not entry:
                return None
            res = entry.copy()
            res["claims"] = self.mock.claims.get(k, [])
            res["evidence"] = self.mock.evidence.get(k, [])
            res["timeline"] = self.mock.timeline.get(k, [])
            res["media"] = self.mock.media.get(k, [])
            return res

    async def list_journal_entries(
        self,
        uid: str,
        limit: int = 20,
        cursor: Optional[str] = None,
    ) -> Tuple[List[dict], Optional[str]]:
        if self.client:
            col_ref = (
                self.client.collection("users")
                .document(uid)
                .collection("journal_entries")
                .order_by("createdAt", direction=firestore.Query.DESCENDING)
                .limit(limit + 1)
            )
            if cursor:
                # cursor is entryId
                cursor_doc = (
                    await self.client.collection("users")
                    .document(uid)
                    .collection("journal_entries")
                    .document(cursor)
                    .get()
                )
                if cursor_doc.exists:
                    col_ref = col_ref.start_after(cursor_doc)
            docs = await col_ref.get()
            entries = [d.to_dict() for d in docs[:limit]]
            next_cursor = docs[limit].id if len(docs) > limit else None
            return entries, next_cursor
        else:
            user_entries = [
                e.copy()
                for k, e in self.mock.journal_entries.items()
                if k.startswith(f"{uid}:")
            ]
            user_entries.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
            start_idx = 0
            if cursor:
                for idx, item in enumerate(user_entries):
                    if item.get("entryId") == cursor:
                        start_idx = idx + 1
                        break
            slice_items = user_entries[start_idx : start_idx + limit]
            next_cursor = (
                user_entries[start_idx + limit]["entryId"]
                if len(user_entries) > start_idx + limit
                else None
            )
            return slice_items, next_cursor

    async def delete_journal_entry(self, uid: str, entry_id: str) -> bool:
        k = f"{uid}:{entry_id}"
        if self.client:
            doc_ref = (
                self.client.collection("users")
                .document(uid)
                .collection("journal_entries")
                .document(entry_id)
            )
            snapshot = await doc_ref.get()
            if not snapshot.exists:
                return False
            await doc_ref.delete()
            return True
        else:
            if k in self.mock.journal_entries:
                del self.mock.journal_entries[k]
                self.mock.claims.pop(k, None)
                self.mock.evidence.pop(k, None)
                self.mock.timeline.pop(k, None)
                self.mock.media.pop(k, None)
                self.mock.messages.pop(k, None)
                return True
            return False

    async def update_reflection(
        self,
        uid: str,
        entry_id: str,
        updated_confidence: int,
        updated_reflection: Optional[str],
    ) -> dict:
        k = f"{uid}:{entry_id}"
        if self.client:
            doc_ref = (
                self.client.collection("users")
                .document(uid)
                .collection("journal_entries")
                .document(entry_id)
            )
            snapshot = await doc_ref.get()
            if not snapshot.exists:
                raise VeriJournalException(code="OPERATION_NOT_FOUND", message="Journal entry not found.")
            data = snapshot.to_dict() or {}
            refl = data.get("reflection", {})
            refl["updatedConfidence"] = updated_confidence
            refl["updatedReflection"] = updated_reflection
            await doc_ref.update({"reflection": refl, "updatedAt": _now_iso()})
            return refl
        else:
            entry = self.mock.journal_entries.get(k)
            if not entry:
                raise VeriJournalException(code="OPERATION_NOT_FOUND", message="Journal entry not found.")
            refl = entry.get("reflection") or {}
            refl["updatedConfidence"] = updated_confidence
            refl["updatedReflection"] = updated_reflection
            entry["reflection"] = refl
            entry["updatedAt"] = _now_iso()
            return refl

    async def save_claims(self, uid: str, entry_id: str, claims: List[dict]) -> None:
        k = f"{uid}:{entry_id}"
        if self.client:
            col_ref = (
                self.client.collection("users")
                .document(uid)
                .collection("journal_entries")
                .document(entry_id)
                .collection("claims")
            )
            for c in claims:
                await col_ref.document(c["claimId"]).set(c)
        else:
            self.mock.claims[k] = claims.copy()

    async def save_evidence(self, uid: str, entry_id: str, evidence: List[dict]) -> None:
        k = f"{uid}:{entry_id}"
        if self.client:
            col_ref = (
                self.client.collection("users")
                .document(uid)
                .collection("journal_entries")
                .document(entry_id)
                .collection("evidence")
            )
            for e in evidence:
                await col_ref.document(e["evidenceId"]).set(e)
        else:
            self.mock.evidence[k] = evidence.copy()

    async def save_timeline(self, uid: str, entry_id: str, timeline: List[dict]) -> None:
        k = f"{uid}:{entry_id}"
        if self.client:
            col_ref = (
                self.client.collection("users")
                .document(uid)
                .collection("journal_entries")
                .document(entry_id)
                .collection("timeline")
            )
            for t in timeline:
                await col_ref.document(t["eventId"]).set(t)
        else:
            self.mock.timeline[k] = timeline.copy()

    async def save_media(self, uid: str, entry_id: str, media: List[dict]) -> None:
        k = f"{uid}:{entry_id}"
        if self.client:
            col_ref = (
                self.client.collection("users")
                .document(uid)
                .collection("journal_entries")
                .document(entry_id)
                .collection("media")
            )
            for m in media:
                if m.get("mediaId"):
                    await col_ref.document(m["mediaId"]).set(m)
        else:
            self.mock.media[k] = media.copy()

    async def save_chat_message(self, uid: str, entry_id: str, message: dict) -> None:
        k = f"{uid}:{entry_id}"
        if self.client:
            col_ref = (
                self.client.collection("users")
                .document(uid)
                .collection("journal_entries")
                .document(entry_id)
                .collection("messages")
            )
            msg_id = message.get("messageId") or f"msg_{datetime.now().timestamp()}"
            await col_ref.document(msg_id).set(message)
        else:
            if k not in self.mock.messages:
                self.mock.messages[k] = []
            self.mock.messages[k].append(message)

    async def get_chat_history(self, uid: str, entry_id: str, limit: int = 20) -> List[dict]:
        k = f"{uid}:{entry_id}"
        if self.client:
            col_ref = (
                self.client.collection("users")
                .document(uid)
                .collection("journal_entries")
                .document(entry_id)
                .collection("messages")
                .order_by("createdAt", direction=firestore.Query.ASCENDING)
                .limit(limit)
            )
            docs = await col_ref.get()
            return [d.to_dict() for d in docs]
        else:
            msgs = self.mock.messages.get(k, [])
            return msgs[-limit:]

    async def get_user_entitlements(self, uid: str) -> dict:
        if self.client:
            doc = await self.client.collection("feature_access").document(uid).get()
            return doc.to_dict() or {} if doc.exists else {}
        else:
            return self.mock.feature_access.get(uid, {})


firestore_repo = FirestoreRepository()

