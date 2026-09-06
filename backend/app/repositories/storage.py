"""Cloud Storage repository enforcing private isolated paths from contracts/firestore-schema.md."""
import os
import uuid
from typing import Dict, Optional, Tuple

from app.core.config import settings
from app.core.logging import logger

_storage_client = None
try:
    from google.cloud import storage
    if not settings.dev_mode:
        _storage_client = storage.Client(project=settings.google_cloud_project)
except Exception as e:
    logger.info(f"Google Cloud Storage client unavailable: {e}")


class InMemoryStorage:
    def __init__(self):
        self.files: Dict[str, bytes] = {}

    def reset(self):
        self.files.clear()


_mock_storage = InMemoryStorage()


class StorageRepository:
    def __init__(self, client=None):
        self.client = client or _storage_client
        self.mock = _mock_storage
        self.bucket_name = settings.media_bucket

    def _generate_name(self, original_filename: Optional[str] = None) -> str:
        ext = ""
        if original_filename and "." in original_filename:
            raw_ext = original_filename.rsplit(".", 1)[-1].lower()
            if raw_ext in ("jpg", "jpeg", "png", "webp", "mp4", "webm", "mov", "json", "zip"):
                ext = f".{raw_ext}"
        return f"obj_{uuid.uuid4().hex[:16]}{ext}"

    async def upload_media(
        self,
        uid: str,
        operation_id: str,
        media_id: str,
        file_bytes: bytes,
        content_type: str,
        filename: Optional[str] = None,
    ) -> str:
        """Stores media under uploads/{uid}/{operationId}/{mediaId}/{serverGeneratedName}."""
        obj_name = self._generate_name(filename)
        path = f"uploads/{uid}/{operation_id}/{media_id}/{obj_name}"

        if self.client and self.bucket_name:
            bucket = self.client.bucket(self.bucket_name)
            blob = bucket.blob(path)
            blob.upload_from_string(file_bytes, content_type=content_type)
            return path
        else:
            self.mock.files[path] = file_bytes
            return path

    async def upload_export(
        self,
        uid: str,
        export_id: str,
        file_bytes: bytes,
        content_type: str = "application/json",
    ) -> str:
        """Stores user export under exports/{uid}/{exportId}/{serverGeneratedName}."""
        obj_name = self._generate_name("export.json")
        path = f"exports/{uid}/{export_id}/{obj_name}"

        if self.client and self.bucket_name:
            bucket = self.client.bucket(self.bucket_name)
            blob = bucket.blob(path)
            blob.upload_from_string(file_bytes, content_type=content_type)
            return path
        else:
            self.mock.files[path] = file_bytes
            return path

    async def get_file_bytes(self, path: str, owner_uid: str) -> Optional[bytes]:
        """Ensures that the requested path belongs strictly to owner_uid before returning."""
        parts = path.split("/")
        if len(parts) < 2 or parts[1] != owner_uid:
            logger.warning(f"Unauthorized storage access attempt to {path} by UID {owner_uid}")
            return None

        if self.client and self.bucket_name:
            bucket = self.client.bucket(self.bucket_name)
            blob = bucket.blob(path)
            if not blob.exists():
                return None
            return blob.download_as_bytes()
        else:
            return self.mock.files.get(path)

    async def delete_operation_media(self, uid: str, operation_id: str) -> None:
        prefix = f"uploads/{uid}/{operation_id}/"
        if self.client and self.bucket_name:
            bucket = self.client.bucket(self.bucket_name)
            blobs = bucket.list_blobs(prefix=prefix)
            for b in blobs:
                b.delete()
        else:
            keys_to_del = [k for k in self.mock.files if k.startswith(prefix)]
            for k in keys_to_del:
                del self.mock.files[k]


storage_repo = StorageRepository()

