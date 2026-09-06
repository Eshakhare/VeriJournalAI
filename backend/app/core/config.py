"""Application configuration using Pydantic Settings and Google Cloud Secret Manager."""
from typing import Any, List, Optional
from pydantic import Field, ValidationInfo, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

INT_DEFAULTS = {
    "max_request_bytes": 10 * 1024 * 1024,
    "max_output_tokens": 2048,
    "max_image_bytes": 10 * 1024 * 1024,
    "max_image_pixels": 16 * 1024 * 1024,
    "max_video_bytes": 50 * 1024 * 1024,
    "max_video_duration_seconds": 60,
    "max_keyframes": 5,
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator(
        "max_request_bytes",
        "max_output_tokens",
        "max_image_bytes",
        "max_image_pixels",
        "max_video_bytes",
        "max_video_duration_seconds",
        "max_keyframes",
        mode="before",
    )
    @classmethod
    def parse_empty_int(cls, v: Any, info: ValidationInfo) -> int:
        if v == "" or v is None:
            return INT_DEFAULTS.get(info.field_name, 0)
        try:
            return int(v)
        except (ValueError, TypeError):
            return INT_DEFAULTS.get(info.field_name, 0)

    @field_validator(
        "gemini_api_key",
        "google_safe_browsing_api_key",
        "google_factcheck_api_key",
        "tavily_api_key",
        "google_maps_api_key",
        "media_bucket",
        mode="before",
    )
    @classmethod
    def parse_empty_str(cls, v: Any) -> Optional[str]:
        if v == "" or v is None:
            return None
        return str(v).strip()

    # Environment & Deployment
    environment: str = Field(default="development", alias="ENVIRONMENT")
    dev_mode: bool = Field(default=True, alias="DEV_MODE")
    allowed_origins: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173",
        alias="ALLOWED_ORIGINS",
    )

    # Google Cloud Project & Region
    google_cloud_project: str = Field(default="gen-ai-training-461815", alias="GOOGLE_CLOUD_PROJECT")
    google_cloud_location: str = Field(default="us-central1", alias="GOOGLE_CLOUD_LOCATION")

    # Vertex AI / Gemini Models
    gemini_model_primary: str = Field(default="gemini-2.5-flash", alias="GEMINI_MODEL_PRIMARY")
    gemini_model_fallback: str = Field(default="gemini-2.5-pro", alias="GEMINI_MODEL_FALLBACK")
    gemini_api_key: Optional[str] = Field(default=None, alias="GEMINI_API_KEY")
    use_vertex_ai: bool = Field(default=True, alias="USE_VERTEX_AI")

    # Third-Party / Google APIs
    google_safe_browsing_api_key: Optional[str] = Field(default=None, alias="GOOGLE_SAFE_BROWSING_API_KEY")
    google_factcheck_api_key: Optional[str] = Field(default=None, alias="GOOGLE_FACTCHECK_API_KEY")
    tavily_api_key: Optional[str] = Field(default=None, alias="TAVILY_API_KEY")
    google_maps_api_key: Optional[str] = Field(default=None, alias="GOOGLE_MAPS_API_KEY")

    # Cloud Storage
    media_bucket: Optional[str] = Field(default=None, alias="MEDIA_BUCKET")

    # Cloud Tasks
    cloud_tasks_queue: str = Field(default="verijournal-verification-queue", alias="CLOUD_TASKS_QUEUE")
    cloud_tasks_location: str = Field(default="us-central1", alias="CLOUD_TASKS_LOCATION")
    task_worker_url: str = Field(default="http://localhost:8000/api/v1/internal/tasks/worker", alias="TASK_WORKER_URL")
    task_worker_audience: str = Field(default="https://verijournal-worker", alias="TASK_WORKER_AUDIENCE")
    task_invoker_service_account: str = Field(default="cloud-tasks-invoker@gen-ai-training-461815.iam.gserviceaccount.com", alias="TASK_INVOKER_SERVICE_ACCOUNT")
    use_local_tasks_adapter: bool = Field(default=True, alias="USE_LOCAL_TASKS_ADAPTER")

    # Request, Upload, and Output Limits
    max_request_bytes: int = Field(default=10 * 1024 * 1024, alias="MAX_REQUEST_BYTES")  # 10 MB
    max_output_tokens: int = Field(default=2048, alias="MAX_OUTPUT_TOKENS")
    max_image_bytes: int = Field(default=10 * 1024 * 1024, alias="MAX_IMAGE_BYTES")  # 10 MB
    max_image_pixels: int = Field(default=16 * 1024 * 1024, alias="MAX_IMAGE_PIXELS")  # 16 MP
    max_video_bytes: int = Field(default=50 * 1024 * 1024, alias="MAX_VIDEO_BYTES")  # 50 MB
    max_video_duration_seconds: int = Field(default=60, alias="MAX_VIDEO_DURATION_SECONDS")
    max_keyframes: int = Field(default=5, alias="MAX_KEYFRAMES")

    # Feature Flags Defaults from contracts/feature-flags.json
    gemini_enabled: bool = Field(default=True, alias="FLAG_GEMINI_ENABLED")
    verification_processing_enabled: bool = Field(default=True, alias="FLAG_VERIFICATION_PROCESSING_ENABLED")
    text_verification_enabled: bool = Field(default=True, alias="FLAG_TEXT_VERIFICATION_ENABLED")
    url_verification_enabled: bool = Field(default=True, alias="FLAG_URL_VERIFICATION_ENABLED")
    social_verification_enabled: bool = Field(default=True, alias="FLAG_SOCIAL_VERIFICATION_ENABLED")
    fact_check_enabled: bool = Field(default=True, alias="FLAG_FACT_CHECK_ENABLED")
    rag_search_enabled: bool = Field(default=True, alias="FLAG_RAG_SEARCH_ENABLED")
    image_provenance_enabled: bool = Field(default=True, alias="FLAG_IMAGE_PROVENANCE_ENABLED")
    youtube_video_enabled: bool = Field(default=True, alias="FLAG_YOUTUBE_VIDEO_ENABLED")
    short_video_upload_enabled: bool = Field(default=False, alias="FLAG_SHORT_VIDEO_UPLOAD_ENABLED")
    c2pa_inspection_enabled: bool = Field(default=False, alias="FLAG_C2PA_INSPECTION_ENABLED")
    maps_enabled: bool = Field(default=False, alias="FLAG_MAPS_ENABLED")
    app_check_enforced: bool = Field(default=False, alias="FLAG_APP_CHECK_ENFORCED")
    maintenance_mode: bool = Field(default=False, alias="FLAG_MAINTENANCE_MODE")

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


settings = Settings()

