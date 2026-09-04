import os
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl, validator

class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    PROJECT_NAME: str = "Sovereign Industrial AI Workbench"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"

    # Host & Port
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Security & Tokens
    SECRET_KEY: str = "sovereign_industrial_super_secure_jwt_secret_key_2026_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:8000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000",
        "*"
    ]

    # Database
    DATABASE_URL: str = "sqlite:///./sovereign_workbench.db"
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "sovereign_workbench"
    POSTGRES_PORT: str = "5432"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Storage Paths
    STORAGE_DIR: str = "./data/storage"
    DOCUMENTS_DIR: str = "./data/documents"
    VECTOR_DB_DIR: str = "./data/vectordb"
    AUDIT_LOG_DIR: str = "./data/audit"

    # Hardware & Model Control
    HARDWARE_TIER_OVERRIDE: Optional[str] = None
    MAX_RAM_ALLOCATION_GB: float = 3.0
    SELECTED_MODEL_TYPE: str = "local_neural_cpu"
    LOCAL_MODEL_PATH: str = "./models"
    EMBEDDING_MODEL_TYPE: str = "local_semantic"

    # Security Policies
    MFA_ISSUER: str = "Sovereign Industrial AI"
    MAX_FAILED_LOGIN_ATTEMPTS: int = 5
    LOCKOUT_DURATION_MINUTES: int = 15
    PROMPT_GUARD_ENABLED: bool = True
    OUTPUT_GUARD_ENABLED: bool = True
    DEV_MFA_AUTOFILL_ENABLED: bool = True  # Set to False in production to enforce strict physical authenticator apps only

    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "allow"

settings = Settings()

# Ensure required local directories exist
for path in [settings.STORAGE_DIR, settings.DOCUMENTS_DIR, settings.VECTOR_DB_DIR, settings.AUDIT_LOG_DIR]:
    os.makedirs(path, exist_ok=True)
