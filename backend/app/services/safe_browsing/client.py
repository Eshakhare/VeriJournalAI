"""Google Safe Browsing API v4 client."""
from typing import Literal, Optional
import httpx

from app.core.config import settings
from app.core.logging import logger

SafeBrowsingOutcome = Literal["known_threat", "no_known_threat", "unavailable"]


class SafeBrowsingClient:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.google_safe_browsing_api_key

    async def check_url(self, url: str) -> SafeBrowsingOutcome:
        """Checks URL against Google Safe Browsing API v4. Returns known_threat, no_known_threat, or unavailable."""
        if not self.api_key:
            logger.info("Safe Browsing API key not configured, returning unavailable.")
            return "unavailable"

        endpoint = f"https://safebrowsing.googleapis.com/v4/threatMatches:find?key={self.api_key}"
        payload = {
            "client": {
                "clientId": "verijournal-ai",
                "clientVersion": "1.0.0",
            },
            "threatInfo": {
                "threatTypes": [
                    "MALWARE",
                    "SOCIAL_ENGINEERING",
                    "UNWANTED_SOFTWARE",
                    "POTENTIALLY_HARMFUL_APPLICATION",
                ],
                "platformTypes": ["ANY_PLATFORM"],
                "threatEntryTypes": ["URL"],
                "threatEntries": [{"url": url}],
            },
        }

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.post(endpoint, json=payload)
                if res.status_code != 200:
                    logger.warning(f"Safe Browsing API returned status {res.status_code}")
                    return "unavailable"

                data = res.json()
                matches = data.get("matches", [])
                if matches:
                    logger.warning(f"Safe Browsing matched threats for {url}: {matches}")
                    return "known_threat"
                return "no_known_threat"
        except Exception as e:
            logger.warning(f"Safe Browsing request failed: {e}")
            return "unavailable"


safe_browsing_client = SafeBrowsingClient()

