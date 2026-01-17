from supabase import create_client, Client
from ..core.config import settings
import logging

logger = logging.getLogger(__name__)

def get_supabase_client() -> Client:
    """Retorna cliente Supabase com service key para operações do backend."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        logger.error(f"Supabase config missing - URL: {bool(settings.SUPABASE_URL)}, KEY: {bool(settings.SUPABASE_SERVICE_KEY)}")
        raise ValueError("SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórios")
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

try:
    supabase: Client = get_supabase_client()
    logger.info("Supabase client initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize Supabase client: {e}")
    supabase = None
