"""In-memory sliding window rate limiter with per-UID enforcement."""
from collections import defaultdict
import time
from typing import Dict, List

from app.core.errors import VeriJournalException
from app.core.logging import logger


class SlidingWindowRateLimiter:
    def __init__(self):
        # maps uid -> list of timestamps
        self.submissions: Dict[str, List[float]] = defaultdict(list)
        self.pollings: Dict[str, List[float]] = defaultdict(list)

    def check_submission_limit(self, uid: str, max_requests: int = 20, window_seconds: int = 60) -> None:
        """Enforces rate limits on expensive verification submissions."""
        now = time.time()
        cutoff = now - window_seconds
        timestamps = [t for t in self.submissions[uid] if t > cutoff]
        self.submissions[uid] = timestamps

        if len(timestamps) >= max_requests:
            logger.warning(f"Rate limit exceeded for UID {uid}: {len(timestamps)} requests in window.")
            raise VeriJournalException(
                code="RATE_LIMITED",
                message="Submission quota exceeded. Please wait before submitting another verification.",
            )

        self.submissions[uid].append(now)

    def check_polling_limit(self, uid: str, max_requests: int = 120, window_seconds: int = 60) -> None:
        now = time.time()
        cutoff = now - window_seconds
        timestamps = [t for t in self.pollings[uid] if t > cutoff]
        self.pollings[uid] = timestamps

        if len(timestamps) >= max_requests:
            raise VeriJournalException(
                code="RATE_LIMITED",
                message="Polling request limit reached. Please reduce polling frequency.",
            )

        self.pollings[uid].append(now)


rate_limiter = SlidingWindowRateLimiter()

