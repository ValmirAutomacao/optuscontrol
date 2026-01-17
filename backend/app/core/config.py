import os
from dotenv import load_dotenv

# Só carregar .env se não estiver em produção (Vercel define VERCEL=1)
# Isso evita que .env.example sobrescreva variáveis de ambiente reais
if not os.getenv("VERCEL"):
    load_dotenv()

class Settings:
    # Supabase - usar os.environ para garantir que pega da env var real
    SUPABASE_URL: str = os.environ.get("SUPABASE_URL", "")
    SUPABASE_SERVICE_KEY: str = os.environ.get("SUPABASE_SERVICE_KEY", "")
    
    # OCR Providers (múltiplos para fallback)
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    RESEND_API_KEY: str = os.getenv("RESEND_API_KEY", "")
    
    # API Settings
    API_V1_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "Optus Control API"
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"

settings = Settings()
