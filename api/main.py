import sys
import os
import logging
import traceback

# Configuração de logging básica
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Adicionar o diretório backend ao path
# Vercel executa as funções no diretório raiz do projeto
backend_path = os.path.join(os.path.dirname(__file__), '..', 'backend')
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

logger.info(f"Backend path added: {backend_path}")
logger.info(f"Current sys.path: {sys.path}")

# Log environment variables (sem valores sensíveis)
env_status = {
    "SUPABASE_URL": bool(os.getenv("SUPABASE_URL")),
    "SUPABASE_SERVICE_KEY": bool(os.getenv("SUPABASE_SERVICE_KEY")),
}
logger.info(f"Environment status: {env_status}")

startup_error = None

try:
    from app.main import app
    handler = app
    logger.info("Application loaded successfully")
except Exception as e:
    startup_error = f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}"
    logger.error(f"Failed to load application: {startup_error}")

    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware

    app = FastAPI()

    # Adicionar CORS para o app de fallback
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/v1/health")
    @app.get("/api/health")
    @app.get("/health")
    def health():
        return {
            "status": "error",
            "error": str(e),
            "env_status": env_status
        }

    @app.get("/api/v1/debug")
    @app.get("/api/debug")
    def debug():
        return {
            "startup_error": startup_error,
            "env_status": env_status,
            "python_version": sys.version,
            "backend_path": backend_path,
            "cwd": os.getcwd()
        }

    @app.get("/{path:path}")
    def catch_all(path: str):
        return {
            "error": "Initialization failure",
            "details": str(e),
            "path": path,
            "env_status": env_status
        }

    handler = app

