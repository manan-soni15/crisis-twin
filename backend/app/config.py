import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings:
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", 8000))
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    
    # Database
    DATABASE_PATH: str = os.getenv("DATABASE_PATH", str(BASE_DIR / "crisis_twin.db"))
    
    # CORS
    CORS_ORIGINS: list[str] = [
        origin.strip() 
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8000").split(",")
        if origin.strip()
    ]
    
    # Meta Model Settings (For Manan's LLMClient)
    META_API_KEY: str = os.getenv("META_API_KEY", "")
    META_MODEL: str = os.getenv("META_MODEL", "llama-3.3-70b-instruct")
    META_BASE_URL: str = os.getenv("META_BASE_URL", "https://api.together.xyz/v1")
    
    # Macro fallback API
    FRED_API_KEY: str = os.getenv("FRED_API_KEY", "")
    MASSIVE_API_KEY: str = os.getenv("MASSIVE_API_KEY", "")

settings = Settings()
