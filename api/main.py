import sys
import os
import logging

# Configuração de logging básica
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Adicionar o diretório backend ao path
# Vercel executa as funções no diretório raiz do projeto
backend_path = os.path.join(os.path.dirname(__file__), '..', 'backend')
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

logger.info(f"Backend path added: {backend_path}")
logger.info(f"Current sys.path: {sys.path}")

try:
    from app.main import app
    handler = app
    logger.info("Application loaded successfully")
except Exception as e:
    logger.error(f"Failed to load application: {e}", exc_info=True)
    from fastapi import FastAPI
    app = FastAPI()
    
    @app.get("/api/v1/health")
    def health():
        return {"status": "error", "error": str(e)}
        
    @app.get("/{path:path}")
    def catch_all(path: str):
        return {"error": "Initialization failure", "details": str(e)}
    
    handler = app

