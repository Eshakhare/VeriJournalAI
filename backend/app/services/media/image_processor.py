"""Image security validation, EXIF metadata extraction, GPS privacy controls, and Cloud Vision Web Detection."""
from dataclasses import dataclass
from datetime import datetime, timezone
import io
from typing import List, Optional, Tuple

from PIL import Image, ExifTags
import exifread

from app.core.config import settings
from app.core.errors import VeriJournalException
from app.core.logging import logger
from app.models.schemas import ConsistencyStatus, MediaSummary

# Magic byte signatures
IMAGE_SIGNATURES = {
    b"\xff\xd8\xff": "image/jpeg",
    b"\x89PNG\r\n\x1a\n": "image/png",
    b"RIFF": "image/webp",  # WebP begins with RIFF...WEBP
}

# Try initializing Vision client
_vision_client = None
try:
    from google.cloud import vision
    if not settings.dev_mode:
        _vision_client = vision.ImageAnnotatorClient()
except Exception as e:
    logger.info(f"Google Cloud Vision client initialization skipped: {e}")


@dataclass
class ExifMetadata:
    capture_date: Optional[str] = None
    camera_make: Optional[str] = None
    camera_model: Optional[str] = None
    software: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


def verify_image_bytes(file_bytes: bytes) -> str:
    """Validates magic bytes and dimensions to prevent pixel bombs and buffer exploits."""
    if len(file_bytes) > settings.max_image_bytes:
        raise VeriJournalException(code="PAYLOAD_TOO_LARGE", message="Image file exceeds maximum permitted size.")

    # Magic byte check
    is_valid_magic = False
    detected_mime = "image/jpeg"
    for magic, mime in IMAGE_SIGNATURES.items():
        if file_bytes.startswith(magic):
            is_valid_magic = True
            detected_mime = mime
            break

    if not is_valid_magic:
        raise VeriJournalException(code="UNSUPPORTED_INPUT", message="File does not have valid image magic bytes (JPEG, PNG, WebP).")

    try:
        with Image.open(io.BytesIO(file_bytes)) as img:
            width, height = img.size
            if width * height > settings.max_image_pixels:
                raise VeriJournalException(code="PAYLOAD_TOO_LARGE", message="Image dimensions exceed 16 megapixel limit.")
            return detected_mime
    except VeriJournalException:
        raise
    except Exception as e:
        logger.warning(f"Image parsing failed: {e}")
        raise VeriJournalException(code="INVALID_INPUT", message="Could not decode image file.")


def _convert_to_degrees(value) -> Optional[float]:
    """Helper function to convert the GPS coordinates stored in EXIF to degress in float format"""
    try:
        d = float(value.values[0].num) / float(value.values[0].den)
        m = float(value.values[1].num) / float(value.values[1].den)
        s = float(value.values[2].num) / float(value.values[2].den)
        return d + (m / 60.0) + (s / 3600.0)
    except Exception:
        return None


def extract_exif(file_bytes: bytes, save_exact_gps: bool = False) -> Tuple[ExifMetadata, Optional[dict]]:
    """Extracts EXIF metadata. Strips exact GPS unless user gave explicit opt-in consent."""
    metadata = ExifMetadata()
    gps_info = None

    try:
        tags = exifread.process_file(io.BytesIO(file_bytes), details=False)

        if "EXIF DateTimeOriginal" in tags:
            metadata.capture_date = str(tags["EXIF DateTimeOriginal"])
        elif "Image DateTime" in tags:
            metadata.capture_date = str(tags["Image DateTime"])

        if "Image Make" in tags:
            metadata.camera_make = str(tags["Image Make"]).strip()
        if "Image Model" in tags:
            metadata.camera_model = str(tags["Image Model"]).strip()
        if "Image Software" in tags:
            metadata.software = str(tags["Image Software"]).strip()

        # GPS extraction
        if "GPS GPSLatitude" in tags and "GPS GPSLongitude" in tags:
            lat = _convert_to_degrees(tags["GPS GPSLatitude"])
            lat_ref = str(tags.get("GPS GPSLatitudeRef", "N"))
            if lat and lat_ref == "S":
                lat = -lat

            lon = _convert_to_degrees(tags["GPS GPSLongitude"])
            lon_ref = str(tags.get("GPS GPSLongitudeRef", "E"))
            if lon and lon_ref == "W":
                lon = -lon

            if lat is not None and lon is not None:
                if save_exact_gps:
                    metadata.latitude = round(lat, 6)
                    metadata.longitude = round(lon, 6)
                    gps_info = {"latitude": metadata.latitude, "longitude": metadata.longitude}
                else:
                    # Coarse locality approximate only
                    gps_info = {"approximateArea": "Location present in EXIF (exact coordinates withheld for privacy)"}

    except Exception as e:
        logger.info(f"EXIF parsing error or missing EXIF: {e}")

    return metadata, gps_info


async def run_web_detection(file_bytes: bytes) -> Tuple[Optional[str], List[dict], List[str]]:
    """
    Runs Cloud Vision Web Detection on image bytes to find earliest observed matching pages.
    Returns (earliest_observed_match_date, matching_pages, limitations).
    """
    if not _vision_client:
        # Mock or Vision disabled
        return (
            None,
            [],
            ["Cloud Vision Web Detection unavailable in current environment; reverse-image search skipped."],
        )

    try:
        from google.cloud import vision
        image = vision.Image(content=file_bytes)
        response = _vision_client.web_detection(image=image)
        web_detection = response.web_detection

        pages_with_matching_images = []
        earliest_date = None

        if web_detection.pages_with_matching_images:
            for page in web_detection.pages_with_matching_images:
                page_info = {
                    "url": page.url,
                    "title": page.page_title,
                    "fullMatchingImages": [img.url for img in page.full_matching_images],
                    "partialMatchingImages": [img.url for img in page.partial_matching_images],
                }
                pages_with_matching_images.append(page_info)

        limitations = [
            "Earliest discovered reverse-search match is an observed date, not conclusive proof of first-ever publication.",
            "Visual similarity signals do not constitute deepfake detection.",
        ]
        return earliest_date, pages_with_matching_images, limitations
    except Exception as e:
        logger.warning(f"Cloud Vision Web Detection failed: {e}")
        return None, [], [f"Web detection error: {str(e)}"]

