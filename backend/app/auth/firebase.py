"""Firebase ID token authentication dependency."""
from dataclasses import dataclass
from typing import Optional
from fastapi import Header
import firebase_admin
from firebase_admin import auth as firebase_auth

from app.core.config import settings
from app.core.errors import VeriJournalException
from app.core.logging import logger

# Initialize Firebase Admin app if not already initialized
if not firebase_admin._apps:
    try:
        firebase_admin.initialize_app()
        logger.info("Initialized default Firebase Admin application.")
    except Exception as e:
        logger.warning(f"Firebase Admin default initialization skipped: {e}")


@dataclass(frozen=True)
class UserPrincipal:
    uid: str
    email: Optional[str] = None
    claims: Optional[dict] = None


async def get_current_user(
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> UserPrincipal:
    """Verifies Firebase ID token and yields authenticated UserPrincipal."""
    if not authorization:
        raise VeriJournalException(
            code="AUTH_REQUIRED",
            message="Missing Authorization header with Firebase ID token.",
        )

    parts = authorization.strip().split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise VeriJournalException(
            code="AUTH_INVALID",
            message="Invalid Authorization header format. Must be 'Bearer <token>'.",
        )

    token = parts[1].strip()

    # Development / Emulator / Test harness support
    if settings.dev_mode and token.startswith("test_token_"):
        uid = token.replace("test_token_", "")
        return UserPrincipal(uid=uid, email=f"{uid}@test.local", claims={})

    try:
        # Verify signature, expiry, and revocation via Firebase Admin SDK
        decoded = firebase_auth.verify_id_token(token, check_revoked=True)
        uid = decoded.get("uid")
        if not uid:
            raise VeriJournalException(
                code="AUTH_INVALID",
                message="Firebase token missing subject UID.",
            )
        return UserPrincipal(
            uid=uid,
            email=decoded.get("email"),
            claims=decoded,
        )
    except firebase_auth.RevokedIdTokenError:
        raise VeriJournalException(
            code="AUTH_INVALID",
            message="Firebase ID token has been revoked.",
        )
    except firebase_auth.ExpiredIdTokenError:
        raise VeriJournalException(
            code="AUTH_INVALID",
            message="Firebase ID token has expired.",
        )
    except Exception as e:
        logger.warning(f"Firebase token verification failed: {type(e).__name__}")
        raise VeriJournalException(
            code="AUTH_INVALID",
            message="Invalid Firebase ID token.",
        )

