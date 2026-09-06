"""Hardened SSRF-safe URL fetcher with pre-resolution, redirect verification, and byte bounds."""
import asyncio
from dataclasses import dataclass
import html
import ipaddress
import re
import socket
from typing import List, Optional, Tuple
from urllib.parse import urljoin, urlparse

import httpx

from app.core.errors import VeriJournalException
from app.core.logging import logger

BLOCKED_HOSTNAMES = {
    "localhost",
    "metadata.google.internal",
    "metadata",
    "169.254.169.254",
}


@dataclass
class FetchResult:
    final_url: str
    status_code: int
    content_type: str
    text_content: str
    title: Optional[str]
    published_date: Optional[str]


def is_ip_blocked(ip_str: str) -> bool:
    """Blocks private, loopback, link-local, multicast, reserved, and unspecified IPs."""
    try:
        ip = ipaddress.ip_address(ip_str)
        return (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        )
    except ValueError:
        return True


def validate_and_resolve_url(url_str: str) -> Tuple[str, str, int, List[str]]:
    """
    Validates scheme and host, resolves DNS, and returns (scheme, hostname, port, resolved_ips).
    Raises VeriJournalException(URL_BLOCKED) if destination is invalid or restricted.
    """
    try:
        parsed = urlparse(url_str)
    except Exception:
        raise VeriJournalException(code="INVALID_INPUT", message="Malformed URL structure.")

    scheme = parsed.scheme.lower()
    if scheme not in ("http", "https"):
        raise VeriJournalException(code="URL_BLOCKED", message="Only HTTP and HTTPS protocols are permitted.")

    if parsed.username or parsed.password:
        raise VeriJournalException(code="URL_BLOCKED", message="URLs containing user credentials are not permitted.")

    hostname = parsed.hostname
    if not hostname:
        raise VeriJournalException(code="URL_BLOCKED", message="URL must contain a valid hostname.")

    hostname_clean = hostname.lower().strip(".")
    if hostname_clean in BLOCKED_HOSTNAMES:
        raise VeriJournalException(code="URL_BLOCKED", message="Target host is restricted.")

    port = parsed.port or (443 if scheme == "https" else 80)
    if port not in (80, 443, 8080, 8443):
        raise VeriJournalException(code="URL_BLOCKED", message="Non-standard ports are restricted.")

    # Pre-resolve DNS
    try:
        addr_info = socket.getaddrinfo(hostname, port, socket.AF_UNSPEC, socket.SOCK_STREAM)
    except socket.gaierror as e:
        logger.warning(f"DNS lookup failed for {hostname}: {e}")
        raise VeriJournalException(code="URL_UNAVAILABLE", message="Could not resolve target host DNS.")

    resolved_ips = []
    for family, socktype, proto, canonname, sockaddr in addr_info:
        ip_addr = sockaddr[0]
        if is_ip_blocked(ip_addr):
            logger.warning(f"SSRF block: {hostname} resolved to restricted IP {ip_addr}")
            raise VeriJournalException(
                code="URL_BLOCKED",
                message="Target URL resolves to a restricted internal or private address.",
            )
        resolved_ips.append(ip_addr)

    if not resolved_ips:
        raise VeriJournalException(code="URL_UNAVAILABLE", message="No valid IP addresses found for host.")

    return scheme, hostname, port, resolved_ips


def extract_title_and_text(raw_html: str) -> Tuple[Optional[str], str, Optional[str]]:
    """Extracts title, plain text body, and published date from HTML without running JavaScript."""
    # Title
    title_match = re.search(r"<title[^>]*>(.*?)</title>", raw_html, re.IGNORECASE | re.DOTALL)
    title = html.unescape(title_match.group(1).strip()) if title_match else None

    # Date
    date_match = re.search(
        r'<meta[^>]+(?:name|property)=["\'](?:article:published_time|date|publish_date)["\'][^>]+content=["\']([^"\']+)["\']',
        raw_html,
        re.IGNORECASE,
    )
    pub_date = date_match.group(1).strip() if date_match else None

    # Strip scripts, styles, comments
    cleaned = re.sub(r"<(script|style|noscript|svg|canvas)[^>]*>.*?</\1>", " ", raw_html, flags=re.IGNORECASE | re.DOTALL)
    cleaned = re.sub(r"<!--.*?-->", " ", cleaned, flags=re.DOTALL)
    cleaned = re.sub(r"<[^>]+>", " ", cleaned)
    text = html.unescape(re.sub(r"\s+", " ", cleaned)).strip()

    return title, text[:30000], pub_date


async def safe_fetch_url(
    url: str,
    max_bytes: int = 5 * 1024 * 1024,  # 5MB max
    max_redirects: int = 3,
    connect_timeout: float = 5.0,
    read_timeout: float = 10.0,
) -> FetchResult:
    """
    Fetches URL with mandatory pre-resolution and per-hop SSRF validation.
    Enforces byte limits and redirect bounds.
    """
    current_url = url
    hops = 0

    transport = httpx.AsyncHTTPTransport(retries=0)
    async with httpx.AsyncClient(transport=transport, follow_redirects=False) as client:
        while hops <= max_redirects:
            scheme, host, port, resolved_ips = validate_and_resolve_url(current_url)

            try:
                # Issue request with strict timeouts
                req = client.build_request(
                    "GET",
                    current_url,
                    headers={
                        "User-Agent": "VeriJournalAI-Verification/1.0 (+https://verijournal.app/bot)",
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8",
                    },
                    timeout=httpx.Timeout(read_timeout, connect=connect_timeout),
                )
                response = await client.send(req, stream=True)
            except httpx.ConnectTimeout:
                raise VeriJournalException(code="URL_UNAVAILABLE", message="Connection to host timed out.")
            except httpx.ReadTimeout:
                raise VeriJournalException(code="URL_UNAVAILABLE", message="Read from host timed out.")
            except httpx.RequestError as e:
                raise VeriJournalException(code="URL_UNAVAILABLE", message=f"Failed to connect: {str(e)}")

            # Handle redirects manually to re-verify SSRF on each hop
            if response.status_code in (301, 302, 303, 307, 308):
                await response.aclose()
                location = response.headers.get("Location")
                if not location:
                    raise VeriJournalException(code="URL_UNAVAILABLE", message="Redirect missing Location header.")
                current_url = urljoin(current_url, location)
                hops += 1
                if hops > max_redirects:
                    raise VeriJournalException(code="URL_BLOCKED", message="Exceeded maximum allowed redirects.")
                continue

            if response.status_code >= 400:
                await response.aclose()
                raise VeriJournalException(
                    code="URL_UNAVAILABLE",
                    message=f"Target URL returned HTTP status {response.status_code}.",
                )

            # Check content length header if provided
            content_length = response.headers.get("Content-Length")
            if content_length and int(content_length) > max_bytes:
                await response.aclose()
                raise VeriJournalException(code="PAYLOAD_TOO_LARGE", message="Target content exceeds maximum fetch size.")

            # Read bounded byte stream
            body_chunks = []
            total_bytes = 0
            async for chunk in response.aiter_bytes():
                total_bytes += len(chunk)
                if total_bytes > max_bytes:
                    await response.aclose()
                    raise VeriJournalException(code="PAYLOAD_TOO_LARGE", message="Decompressed content exceeds maximum allowed size.")
                body_chunks.append(chunk)

            await response.aclose()
            raw_bytes = b"".join(body_chunks)
            encoding = response.encoding or "utf-8"
            try:
                raw_text = raw_bytes.decode(encoding, errors="replace")
            except Exception:
                raw_text = raw_bytes.decode("utf-8", errors="replace")

            title, text, pub_date = extract_title_and_text(raw_text)
            content_type = response.headers.get("Content-Type", "text/html")

            return FetchResult(
                final_url=current_url,
                status_code=response.status_code,
                content_type=content_type,
                text_content=text,
                title=title,
                published_date=pub_date,
            )

        raise VeriJournalException(code="URL_BLOCKED", message="Exceeded maximum allowed redirects.")

