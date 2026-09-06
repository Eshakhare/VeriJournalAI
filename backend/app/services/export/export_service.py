"""User data export service compiling owner data into machine-readable JSON."""
from datetime import datetime, timezone
import json
from typing import Optional

from app.core.logging import logger
from app.repositories.firestore import firestore_repo
from app.repositories.storage import storage_repo


class ExportService:
    async def generate_user_export(self, uid: str, export_id: str) -> str:
        """Collects all journal entries, claims, evidence, timeline, and reflection for uid."""
        entries, _ = await firestore_repo.list_journal_entries(uid, limit=500)

        full_entries = []
        for summary in entries:
            eid = summary.get("entryId")
            if eid:
                full = await firestore_repo.get_journal_entry(uid, eid)
                if full:
                    full_entries.append(full)

        export_data = {
            "contractVersion": "1.0",
            "ownerUid": uid,
            "exportedAt": datetime.now(timezone.utc).isoformat(),
            "journalEntries": full_entries,
        }

        export_bytes = json.dumps(export_data, indent=2).encode("utf-8")
        path = await storage_repo.upload_export(
            uid=uid,
            export_id=export_id,
            file_bytes=export_bytes,
            content_type="application/json",
        )
        logger.info(f"Generated user export for UID {uid} at {path}")
        return path


export_service = ExportService()

