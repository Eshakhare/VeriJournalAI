"""Journal entry management endpoints with strict owner isolation."""
from typing import Optional
from fastapi import APIRouter, Depends, Query, Response, status

from app.auth.firebase import UserPrincipal, get_current_user
from app.core.errors import VeriJournalException
from app.models.schemas import (
    JournalEntry,
    JournalEntryPage,
    JournalEntrySummary,
    Reflection,
    ReflectionUpdate,
)
from app.repositories.firestore import firestore_repo

router = APIRouter(prefix="/journal", tags=["Journal"])


@router.get("/entries", response_model=JournalEntryPage)
async def list_journal_entries(
    cursor: Optional[str] = Query(None, max_length=512),
    limit: int = Query(20, ge=1, le=50),
    user: UserPrincipal = Depends(get_current_user),
):
    entries_data, next_cursor = await firestore_repo.list_journal_entries(
        uid=user.uid,
        limit=limit,
        cursor=cursor,
    )

    summaries = []
    for ed in entries_data:
        summaries.append(
            JournalEntrySummary(
                entryId=ed["entryId"],
                inputType=ed["inputType"],
                title=ed.get("title"),
                status=ed["status"],
                evidenceStatus=ed.get("evidenceStatus"),
                evidenceConfidence=ed.get("evidenceConfidence"),
                createdAt=ed["createdAt"],
                updatedAt=ed["updatedAt"],
            )
        )

    return JournalEntryPage(
        contractVersion="1.0",
        entries=summaries,
        nextCursor=next_cursor,
    )


@router.get("/entries/{entryId}", response_model=JournalEntry)
async def get_journal_entry(
    entryId: str,
    user: UserPrincipal = Depends(get_current_user),
):
    entry_data = await firestore_repo.get_journal_entry(uid=user.uid, entry_id=entryId)
    if not entry_data:
        raise VeriJournalException(code="OPERATION_NOT_FOUND", message="Journal entry not found.")

    entry_data.pop("ownerUid", None)
    return JournalEntry(**entry_data)


@router.delete("/entries/{entryId}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_journal_entry(
    entryId: str,
    user: UserPrincipal = Depends(get_current_user),
):
    deleted = await firestore_repo.delete_journal_entry(uid=user.uid, entry_id=entryId)
    if not deleted:
        raise VeriJournalException(code="OPERATION_NOT_FOUND", message="Journal entry not found.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/entries/{entryId}/reflection", response_model=Reflection)
async def update_reflection(
    entryId: str,
    reflection_update: ReflectionUpdate,
    user: UserPrincipal = Depends(get_current_user),
):
    updated = await firestore_repo.update_reflection(
        uid=user.uid,
        entry_id=entryId,
        updated_confidence=reflection_update.updatedConfidence,
        updated_reflection=reflection_update.updatedReflection,
    )
    return Reflection(**updated)
