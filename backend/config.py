from pathlib import Path
from typing import List
from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).parent / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database
    DATABASE_URL: str = "sqlite:///./crm.db"

    # Auth
    JWT_SECRET: str = "nexus-crm-dev-secret-change-in-prod"
    ADMIN_EMAIL: str = "admin@nexus.com"
    ADMIN_PASSWORD: str = "admin123"

    # CORS — comma-separated string in .env, exposed as list
    CORS_ORIGINS_STR: str = (
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost,http://127.0.0.1"
    )

    @computed_field
    @property
    def CORS_ORIGINS(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS_STR.split(",") if o.strip()]

    # Logging
    LOG_FORMAT: str = "json"
    LOG_LEVEL: str = "INFO"


settings = Settings()

# Flat aliases so existing `import config; config.DATABASE_URL` keeps working
DATABASE_URL = settings.DATABASE_URL
JWT_SECRET = settings.JWT_SECRET
ADMIN_EMAIL = settings.ADMIN_EMAIL
ADMIN_PASSWORD = settings.ADMIN_PASSWORD
CORS_ORIGINS = settings.CORS_ORIGINS
LOG_FORMAT = settings.LOG_FORMAT
LOG_LEVEL = settings.LOG_LEVEL
