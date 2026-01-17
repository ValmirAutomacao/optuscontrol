"""
Cliente Supabase - Inicialização Lazy para evitar erros em serverless
"""
from supabase import create_client, Client
from ..core.config import settings
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Cliente global - inicializado sob demanda
_supabase_client: Optional[Client] = None


def get_supabase_client() -> Client:
    """
    Retorna cliente Supabase com service key para operações do backend.
    Usa inicialização lazy para evitar erros durante import em ambientes serverless.
    """
    global _supabase_client

    if _supabase_client is not None:
        return _supabase_client

    url = settings.SUPABASE_URL
    key = settings.SUPABASE_SERVICE_KEY

    if not url or not key:
        logger.error(f"Supabase config missing - URL: {bool(url)}, KEY: {bool(key)}")
        raise ValueError("SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórios")

    logger.info(f"Initializing Supabase client with URL: {url[:30]}...")
    _supabase_client = create_client(url, key)
    logger.info("Supabase client initialized successfully")

    return _supabase_client


# Propriedade para acesso compatível com código existente
class _SupabaseProxy:
    """Proxy que inicializa o cliente apenas quando acessado."""

    def __getattr__(self, name):
        client = get_supabase_client()
        return getattr(client, name)


# Exportar proxy em vez de cliente direto
supabase = _SupabaseProxy()
