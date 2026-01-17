"""
Optus Control API - Vercel Serverless Entry Point
"""
import sys
import os
import traceback

# Configurar paths ANTES de qualquer import do backend
def setup_paths():
    paths_to_add = [
        '/var/task/backend',
        os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'backend'),
        os.path.join(os.getcwd(), 'backend'),
    ]
    for path in paths_to_add:
        abs_path = os.path.abspath(path)
        if abs_path not in sys.path and os.path.exists(abs_path):
            sys.path.insert(0, abs_path)
    return paths_to_add

added_paths = setup_paths()

# Coletar informações de ambiente para debug
env_info = {
    "SUPABASE_URL": os.environ.get("SUPABASE_URL", "")[:50] + "..." if os.environ.get("SUPABASE_URL") else "NOT SET",
    "SUPABASE_SERVICE_KEY": "SET" if os.environ.get("SUPABASE_SERVICE_KEY") else "NOT SET",
    "FRONTEND_URL": os.environ.get("FRONTEND_URL", "NOT SET"),
    "VERCEL": os.environ.get("VERCEL", "NOT SET"),
    "paths_added": added_paths,
    "cwd": os.getcwd(),
}

# Tentar importar a aplicação principal
app = None
import_error = None

try:
    from app.main import app as main_app
    app = main_app
except Exception as e:
    import_error = {
        "error": str(e),
        "type": type(e).__name__,
        "traceback": traceback.format_exc(),
    }

# Se falhou, criar app de fallback
if app is None:
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
            "mode": "fallback",
            "env": env_info,
            "import_error": import_error,
        })

    @app.get("/api/v1/health")
    @app.get("/api/health")
    @app.get("/health")
    async def health():
        return JSONResponse({
            "status": "error",
            "message": "Application failed to initialize",
            "env": env_info,
            "import_error": import_error,
        }, status_code=500)

    @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
    async def catch_all(path: str):
        return JSONResponse({
            "error": "Application failed to initialize",
            "path": path,
            "hint": "Check /api/v1/debug for details",
            "env": env_info,
        }, status_code=500)

# Criar handler - Vercel detecta automaticamente funções Python
# NÃO usar Mangum, exportar diretamente o app ASGI
handler = app

