"""Multi-turn journal entry chat endpoint with authenticated SSE fetch streaming."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.auth.firebase import UserPrincipal, get_current_user
from app.core.errors import VeriJournalException
from app.models.schemas import ChatRequest
from app.repositories.firestore import firestore_repo
from app.services.ai.gemini_gateway import gemini_gateway

router = APIRouter(prefix="/journal/entries", tags=["Chat"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.post("/{entryId}/chat")
async def chat_about_entry(
    entryId: str,
    chat_request: ChatRequest,
    user: UserPrincipal = Depends(get_current_user),
):
    entry = await firestore_repo.get_journal_entry(uid=user.uid, entry_id=entryId)
    if not entry:
        raise VeriJournalException(code="OPERATION_NOT_FOUND", message="Journal entry not found.")

    # Fetch prior chat history
    history = await firestore_repo.get_chat_history(uid=user.uid, entry_id=entryId, limit=10)

    # Save user message
    user_msg_id = f"msg_{uuid.uuid4().hex[:16]}"
    await firestore_repo.save_chat_message(
        uid=user.uid,
        entry_id=entryId,
        message={
            "messageId": user_msg_id,
            "role": "user",
            "content": chat_request.message,
            "createdAt": _now_iso(),
        },
    )

    async def event_generator():
        async for chunk in gemini_gateway.stream_chat(
            entry_summary=entry,
            chat_history=history,
            new_message=chat_request.message,
        ):
            yield chunk

        # Save assistant message once streaming completes
        assistant_msg_id = f"msg_{uuid.uuid4().hex[:16]}"
        await firestore_repo.save_chat_message(
            uid=user.uid,
            entry_id=entryId,
            message={
                "messageId": assistant_msg_id,
                "role": "assistant",
                "content": "Assistant discussion response generated.",
                "createdAt": _now_iso(),
            },
        )

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
