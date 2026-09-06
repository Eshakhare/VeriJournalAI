"""SSRF security test suite verifying strict blocking of internal/private network targets."""
import pytest

from app.core.errors import VeriJournalException
from app.services.scraping.safe_fetch import validate_and_resolve_url, is_ip_blocked


def test_ip_blocking_logic():
    # Loopback
    assert is_ip_blocked("127.0.0.1") is True
    assert is_ip_blocked("127.0.1.1") is True
    assert is_ip_blocked("::1") is True

    # Cloud metadata / link-local
    assert is_ip_blocked("169.254.169.254") is True
    assert is_ip_blocked("fe80::1") is True

    # RFC 1918 Private ranges
    assert is_ip_blocked("10.0.0.1") is True
    assert is_ip_blocked("172.16.0.1") is True
    assert is_ip_blocked("192.168.1.1") is True

    # Public IPs should NOT be blocked
    assert is_ip_blocked("8.8.8.8") is False
    assert is_ip_blocked("1.1.1.1") is False


def test_protocol_restriction():
    with pytest.raises(VeriJournalException) as exc_info:
        validate_and_resolve_url("file:///etc/passwd")
    assert exc_info.value.code == "URL_BLOCKED"

    with pytest.raises(VeriJournalException) as exc_info:
        validate_and_resolve_url("ftp://ftp.example.com/file")
    assert exc_info.value.code == "URL_BLOCKED"


def test_url_credentials_blocked():
    with pytest.raises(VeriJournalException) as exc_info:
        validate_and_resolve_url("https://user:password@example.com/news")
    assert exc_info.value.code == "URL_BLOCKED"


def test_non_standard_port_blocked():
    with pytest.raises(VeriJournalException) as exc_info:
        validate_and_resolve_url("http://example.com:22/news")
    assert exc_info.value.code == "URL_BLOCKED"


def test_metadata_hostname_blocked():
    with pytest.raises(VeriJournalException) as exc_info:
        validate_and_resolve_url("http://metadata.google.internal/computeMetadata/v1/")
    assert exc_info.value.code == "URL_BLOCKED"

    with pytest.raises(VeriJournalException) as exc_info:
        validate_and_resolve_url("http://169.254.169.254/latest/meta-data/")
    assert exc_info.value.code == "URL_BLOCKED"

