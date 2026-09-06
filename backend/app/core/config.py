import os
from typing import List, Optional
try:
    from pydantic_settings import BaseSettings
except ImportError:
    try:
        from pydantic import BaseSettings
    except ImportError:
        class BaseSettings:
            def __init__(self, **kwargs):
                # Populate class defaults
                for cls in reversed(self.__class__.__mro__):
                    for k, v in cls.__dict__.items():
                        if not k.startswith("_") and not callable(v) and not isinstance(v, (classmethod, staticmethod)):
                            setattr(self, k, v)
                # Overwrite with kwargs or os.environ
                for k, v in kwargs.items():
                    setattr(self, k, v)
                for k in list(self.__dict__.keys()):
                    if k in os.environ:
                        env_v = os.environ[k]
                        curr_v = getattr(self, k)
                        if isinstance(curr_v, bool):
                            setattr(self, k, env_v.lower() in ("true", "1", "yes"))
                        elif isinstance(curr_v, int):
                            setattr(self, k, int(env_v))
                        elif isinstance(curr_v, float):
                            setattr(self, k, float(env_v))
                        elif isinstance(curr_v, list):
                            setattr(self, k, [x.strip() for x in env_v.split(",")])
                        else:
                            setattr(self, k, env_v)

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
    DATABASE_URL: str = f"sqlite:///{os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'sovereign_workbench.db')}"
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "sovereign_workbench"
    POSTGRES_PORT: str = "5432"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Storage Paths (Anchored to backend/data directory)
    STORAGE_DIR: str = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "storage")
    DOCUMENTS_DIR: str = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "documents")
    VECTOR_DB_DIR: str = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "vectordb")
    AUDIT_LOG_DIR: str = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "audit")

    # Hardware & Model Control
    HARDWARE_TIER_OVERRIDE: Optional[str] = None
    MAX_RAM_ALLOCATION_GB: float = 3.0
    SELECTED_MODEL_TYPE: str = "local_neural_cpu"
    LOCAL_MODEL_PATH: str = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "models")
    EMBEDDING_MODEL_TYPE: str = "local_semantic"

    # Hardware-Aware Model Gateway & Safety Margins
    MODEL_ROUTING_ENABLED: bool = True
    MODEL_MAX_RAM_UTILIZATION: float = 0.70  # Leave at least 30% RAM for OS, browser & background tasks
    MODEL_MAX_VRAM_UTILIZATION: float = 0.80 # Leave at least 20% VRAM for display and compositor
    MODEL_MIN_FREE_RAM_GB: float = 1.0       # Strict absolute minimum free RAM floor
    MODEL_MIN_FREE_VRAM_GB: float = 0.5      # Strict absolute minimum free VRAM floor
    MODEL_AUTO_DISCOVERY: bool = True        # Automatically discover .gguf files in LOCAL_MODEL_PATH
    MODEL_ROUTING_STRATEGY: str = "hardware_aware" # "hardware_aware" | "performance" | "conservative"

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
