import sys
import os
import logging
import traceback

# Configuração de logging básica
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Guardar erro de inicialização
startup_error = None
env_status = {}

try:
    # Log do ambiente
    env_status = {
        "SUPABASE_URL": bool(os.getenv("SUPABASE_URL")),
        "SUPABASE_SERVICE_KEY": bool(os.getenv("SUPABASE_SERVICE_KEY")),
        "cwd": os.getcwd(),
        "file_dir": os.path.dirname(__file__),
    }
    logger.info(f"Environment status: {env_status}")

    # Adicionar o diretório backend ao path
    # Na Vercel, o diretório de trabalho é a raiz do projeto
    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(current_dir)
    backend_path = os.path.join(project_root, 'backend')

    # Adicionar múltiplos caminhos possíveis
    paths_to_add = [
        backend_path,
        os.path.join(os.getcwd(), 'backend'),
        '/var/task/backend',
    ]

    for path in paths_to_add:
        if path not in sys.path:
            sys.path.insert(0, path)

    logger.info(f"Backend paths added: {paths_to_add}")
    logger.info(f"sys.path: {sys.path[:5]}")  # Primeiros 5 itens

    # Verificar se o diretório backend existe
    backend_exists = os.path.exists(backend_path)
    logger.info(f"Backend path exists: {backend_exists}")

    if backend_exists:
        backend_contents = os.listdir(backend_path)
        logger.info(f"Backend contents: {backend_contents}")

    # Tentar importar a aplicação
    from app.main import app
    handler = app
    logger.info("Application loaded successfully!")

except Exception as e:
    startup_error = f"{type(e).__name__}: {str(e)}"
    full_traceback = traceback.format_exc()
    logger.error(f"Failed to load application: {startup_error}")
    logger.error(f"Full traceback: {full_traceback}")

    # Criar aplicação de fallback com informações de debug
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import JSONResponse

    app = FastAPI(title="Optus Control API - Debug Mode")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/v1/debug")
    @app.get("/api/debug")
    @app.get("/debug")
    async def debug():
        return JSONResponse({
            "status": "error",
            "startup_error": startup_error,
            "full_traceback": full_traceback,
            "env_status": env_status,
            "python_version": sys.version,
            "sys_path": sys.path[:10],
            "cwd": os.getcwd(),
            "listdir_cwd": os.listdir(os.getcwd()) if os.path.exists(os.getcwd()) else []
        })

    @app.get("/api/v1/health")
    @app.get("/api/health")
    @app.get("/health")
    async def health():
        return JSONResponse({
            "status": "error",
            "error": startup_error,
            "env_status": env_status
        }, status_code=500)

    @app.get("/api/v1/auth/me")
    async def auth_me():
        return JSONResponse({
            "error": "Application failed to initialize",
            "details": startup_error
        }, status_code=500)

    @app.get("/api/v1/notifications")
    async def notifications():
        return JSONResponse({
            "error": "Application failed to initialize",
            "details": startup_error
        }, status_code=500)

    @app.get("/{path:path}")
    async def catch_all(path: str):
        return JSONResponse({
            "error": "Initialization failure",
            "path": path,
            "startup_error": startup_error,
            "hint": "Access /api/v1/debug for more details"
        }, status_code=500)

    handler = app

# Garantir que 'app' é a aplicação ASGI para Vercel
# A Vercel espera encontrar 'app' como ASGI application
app = handler
