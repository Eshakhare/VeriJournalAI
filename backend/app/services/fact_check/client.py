"""Google Fact Check Tools API v1alpha1 client with explicit typed status handling."""
from dataclasses import dataclass, field
from typing import List, Literal, Optional
import httpx

from app.core.config import settings
from app.core.logging import logger

FactCheckStatus = Literal["matched", "no_match", "unavailable", "invalid_response", "disabled"]


@dataclass
class FactCheckResultItem:
    claim_text: str
    claimant: Optional[str]
    claim_date: Optional[str]
    publisher_name: str
    publisher_site: Optional[str]
    review_url: str
    review_title: str
    review_date: Optional[str]
    textual_rating: str
    language_code: Optional[str]


@dataclass
class FactCheckResponse:
    status: FactCheckStatus
    items: List[FactCheckResultItem] = field(default_factory=list)
    raw_error: Optional[str] = None


class FactCheckClient:
    def __init__(self, api_key: Optional[str] = None, enabled: bool = True):
        self.api_key = api_key or settings.google_factcheck_api_key
        self.enabled = enabled and settings.fact_check_enabled

    async def search_claims(self, query: str, language_code: str = "en") -> FactCheckResponse:
        """Searches Google Fact Check Tools API with normalized query string."""
        if not self.enabled:
            return FactCheckResponse(status="disabled")

        if not self.api_key:
            logger.info("Fact Check API key not configured, returning unavailable.")
            return FactCheckResponse(status="unavailable")

        url = "https://factchecktools.googleapis.com/v1alpha1/claims:search"
        params = {
            "key": self.api_key,
            "query": query[:200],  # bounded query length
            "languageCode": language_code,
            "pageSize": 5,
        }

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.get(url, params=params)

                if res.status_code == 403 or res.status_code == 429:
                    logger.warning(f"Fact Check API rate limited or quota exceeded: {res.status_code}")
                    return FactCheckResponse(status="unavailable", raw_error=f"HTTP_{res.status_code}")

                if res.status_code >= 500:
                    logger.warning(f"Fact Check API server error: {res.status_code}")
                    return FactCheckResponse(status="unavailable", raw_error=f"HTTP_{res.status_code}")

                if res.status_code != 200:
                    logger.warning(f"Fact Check API unexpected status: {res.status_code}")
                    return FactCheckResponse(status="invalid_response", raw_error=f"HTTP_{res.status_code}")

                data = res.json()
                raw_claims = data.get("claims", [])
                if not raw_claims:
                    return FactCheckResponse(status="no_match", items=[])

                items: List[FactCheckResultItem] = []
                for rc in raw_claims:
                    claim_text = rc.get("text", "")
                    claimant = rc.get("claimant")
                    claim_date = rc.get("claimDate")

                    for review in rc.get("claimReview", []):
                        pub = review.get("publisher", {})
                        review_url = review.get("url")
                        rating = review.get("textualRating")

                        if review_url and rating:
                            items.append(
                                FactCheckResultItem(
                                    claim_text=claim_text,
                                    claimant=claimant,
                                    claim_date=claim_date,
                                    publisher_name=pub.get("name", "Unknown Fact-Checker"),
                                    publisher_site=pub.get("site"),
                                    review_url=review_url,
                                    review_title=review.get("title") or f"Fact Check by {pub.get('name')}",
                                    review_date=review.get("reviewDate"),
                                    textual_rating=rating,
                                    language_code=review.get("languageCode"),
                                )
                            )

                if items:
                    return FactCheckResponse(status="matched", items=items)
                return FactCheckResponse(status="no_match", items=[])

        except httpx.TimeoutException:
            logger.warning("Fact Check API request timed out.")
            return FactCheckResponse(status="unavailable", raw_error="Timeout")
        except Exception as e:
            logger.warning(f"Fact Check API error: {e}")
            return FactCheckResponse(status="invalid_response", raw_error=str(e))


fact_check_client = FactCheckClient()

