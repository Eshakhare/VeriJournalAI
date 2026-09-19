"""Tavily-backed web search adapter for the evidence ledger."""
from dataclasses import dataclass, field
from typing import List, Optional
from urllib.parse import urlparse

import httpx

from app.core.config import settings
from app.core.logging import logger


@dataclass
class SearchResult:
    url: str
    title: str
    content: str
    published_date: Optional[str] = None
    publisher: Optional[str] = None


@dataclass
class SearchResponse:
    results: List[SearchResult] = field(default_factory=list)
    unavailable: bool = False
    raw_error: Optional[str] = None


class WebSearchClient:
    def __init__(self, api_key: Optional[str] = None, enabled: bool = True):
        self.api_key = api_key or settings.tavily_api_key
        self.enabled = enabled and settings.rag_search_enabled

    async def search(self, query: str, max_results: int = 5) -> SearchResponse:
        if not self.enabled or not self.api_key:
            return SearchResponse(unavailable=True, raw_error="search_disabled_or_missing_key")

        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                response = await client.post(
                    "https://api.tavily.com/search",
                    json={
                        "api_key": self.api_key,
                        "query": query[:400],
                        "search_depth": "advanced",
                        "max_results": max_results,
                        "include_answer": False,
                        "include_raw_content": False,
                    },
                )
                if response.status_code in (401, 403, 429) or response.status_code >= 500:
                    return SearchResponse(unavailable=True, raw_error=f"HTTP_{response.status_code}")
                if response.status_code != 200:
                    return SearchResponse(unavailable=True, raw_error=f"HTTP_{response.status_code}")

                results = []
                for item in response.json().get("results", []):
                    url = item.get("url")
                    content = (item.get("content") or "").strip()
                    if not url or not content:
                        continue
                    hostname = urlparse(url).hostname or ""
                    results.append(
                        SearchResult(
                            url=url,
                            title=(item.get("title") or hostname)[:500],
                            content=content[:1000],
                            published_date=item.get("published_date"),
                            publisher=hostname,
                        )
                    )
                return SearchResponse(results=results)
        except httpx.TimeoutException:
            return SearchResponse(unavailable=True, raw_error="Timeout")
        except Exception as exc:
            logger.warning(f"Web search request failed: {type(exc).__name__}")
            return SearchResponse(unavailable=True, raw_error=type(exc).__name__)


web_search_client = WebSearchClient()
