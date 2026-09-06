"""Domain and publisher context analysis using tldextract and news_domains.json."""
import json
from pathlib import Path
from typing import Dict, List, Literal, Optional, Tuple
from urllib.parse import urlparse

import tldextract

from app.core.logging import logger

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
DOMAINS_FILE = DATA_DIR / "news_domains.json"

# Configure tldextract without runtime download
_extractor = tldextract.TLDExtract(cache_dir=str(DATA_DIR / ".tld_cache"))


def levenshtein_distance(s1: str, s2: str) -> int:
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)

    prev = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        curr = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = prev[j + 1] + 1
            deletions = curr[j] + 1
            substitutions = prev[j] + (c1 != c2)
            curr.append(min(insertions, deletions, substitutions))
        prev = curr
    return prev[-1]


class DomainContextService:
    def __init__(self):
        self.publishers: Dict[str, dict] = {}
        self.load_registry()

    def load_registry(self) -> None:
        if DOMAINS_FILE.exists():
            try:
                with open(DOMAINS_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for pub in data.get("publishers", []):
                        domain = pub.get("registrableDomain", "").lower()
                        if domain:
                            self.publishers[domain] = pub
                logger.info(f"Loaded {len(self.publishers)} recognized domains from news_domains.json.")
            except Exception as e:
                logger.error(f"Failed to load news_domains.json: {e}")
        else:
            logger.warning(f"news_domains.json not found at {DOMAINS_FILE}")

    def extract_registrable_domain(self, url_or_domain: str) -> Tuple[str, str]:
        """Returns (registrable_domain, full_host)."""
        if "://" in url_or_domain:
            host = urlparse(url_or_domain).hostname or ""
        else:
            host = url_or_domain.split("/")[0]

        host = host.lower().strip(".")
        extracted = _extractor(host)
        reg_domain = extracted.registered_domain or host
        return reg_domain, host

    def evaluate_domain(
        self,
        url_or_domain: str,
    ) -> Tuple[
        Literal["recognized", "unknown", "possible_impersonation", "not_applicable"],
        Optional[str],
        Optional[str],
    ]:
        """
        Evaluates domain against the publisher recognition seed.
        Returns (status, publisher_name, warning_note).
        Does NOT prove authenticity or truth; unknown continues through the evidence pipeline.
        """
        reg_domain, host = self.extract_registrable_domain(url_or_domain)
        if not reg_domain:
            return "not_applicable", None, None

        # 1. Exact registrable domain match
        if reg_domain in self.publishers:
            pub = self.publishers[reg_domain]
            return "recognized", pub.get("publisherName"), None

        # 2. Impersonation / Typosquatting heuristic
        for known_domain, pub in self.publishers.items():
            dist = levenshtein_distance(reg_domain, known_domain)
            # Distance of 1 or 2 on similar length domain suggests possible typo or impersonation
            if 0 < dist <= 2 and abs(len(reg_domain) - len(known_domain)) <= 2:
                warning = (
                    f"Domain '{reg_domain}' is visually similar to recognized domain '{known_domain}' "
                    f"({pub.get('publisherName')}). This is a heuristic warning, not proof."
                )
                return "possible_impersonation", None, warning

            # Check if recognized domain is contained as an inner prefix with hyphens (e.g. bbc-news.site)
            clean_known = known_domain.split(".")[0]
            if len(clean_known) >= 4 and clean_known in reg_domain and reg_domain != known_domain:
                warning = (
                    f"Domain '{reg_domain}' contains brand name '{clean_known}' from '{known_domain}'. "
                    "Review context carefully."
                )
                return "possible_impersonation", None, warning

        return "unknown", None, None


domain_service = DomainContextService()

