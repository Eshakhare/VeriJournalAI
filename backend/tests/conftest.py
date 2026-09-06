"""Test configuration and fixtures for backend pytest suites."""
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.repositories.firestore import firestore_repo
from app.repositories.storage import storage_repo


@pytest.fixture(autouse=True)
def reset_stores():
    """Resets mock databases before each test."""
    firestore_repo.mock.reset()
    storage_repo.mock.reset()


@pytest.fixture
def auth_headers_user1():
    return {"Authorization": "Bearer test_token_user_alice"}


@pytest.fixture
def auth_headers_user2():
    return {"Authorization": "Bearer test_token_user_bob"}


@pytest.fixture
def worker_auth_headers():
    return {"Authorization": "Bearer test_worker_token"}


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

