"""
Optus Control API - Vercel Serverless Entry Point
"""
import sys
import os

# Configurar paths ANTES de qualquer import
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
backend_path = os.path.join(project_root, 'backend')

# Adicionar ao path
for path in [backend_path, os.path.join(os.getcwd(), 'backend'), '/var/task/backend']:
    if path not in sys.path:
        sys.path.insert(0, path)

# Agora importar a aplicação
try:
    from app.main import app
except Exception as e:
    # Fallback: criar app mínima para debug
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import JSONResponse
    import traceback

    app = FastAPI(title="Optus Control API - Error Mode")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    error_details = {
        "error": str(e),
        "traceback": traceback.format_exc(),
        "sys_path": sys.path[:5],
        "cwd": os.getcwd(),
        "backend_exists": os.path.exists(backend_path),
        "env_vars": {
            "SUPABASE_URL": bool(os.environ.get("SUPABASE_URL")),
            "SUPABASE_SERVICE_KEY": bool(os.environ.get("SUPABASE_SERVICE_KEY")),
            "VERCEL": os.environ.get("VERCEL"),
        }
    }

    @app.get("/api/v1/debug")
    @app.get("/api/debug")
    async def debug():
        return JSONResponse(error_details)

    @app.get("/api/v1/health")
    @app.get("/api/health")
    async def health():
        return JSONResponse({"status": "error", **error_details}, status_code=500)

    @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
    async def catch_all(path: str):
        return JSONResponse({
            "error": "Application failed to load",
            "path": path,
            "details": error_details
        }, status_code=500)

# Handler para Vercel - deve ser 'app' do tipo ASGI
handler = app
