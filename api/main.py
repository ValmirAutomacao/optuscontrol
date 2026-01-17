"""
Optus Control API - Vercel Serverless Entry Point
Usa Mangum para adaptar FastAPI (ASGI) para AWS Lambda/Vercel
"""
import sys
import os

# Configurar paths ANTES de qualquer import do backend
paths_to_add = [
    '/var/task/backend',
    os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'backend'),
    os.path.join(os.getcwd(), 'backend'),
]
for path in paths_to_add:
    abs_path = os.path.abspath(path)
    if abs_path not in sys.path and os.path.exists(abs_path):
        sys.path.insert(0, abs_path)

# Import do Mangum para adaptar ASGI -> Lambda
from mangum import Mangum

# Tentar importar a aplicação principal
try:
    from app.main import app

except Exception as import_error:
    # Fallback: criar app mínima para debug
    import traceback
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

    error_info = {
        "error": str(import_error),
        "traceback": traceback.format_exc(),
        "sys_path": sys.path[:5],
        "cwd": os.getcwd(),
        "env": {
            "SUPABASE_URL": bool(os.environ.get("SUPABASE_URL")),
            "SUPABASE_SERVICE_KEY": bool(os.environ.get("SUPABASE_SERVICE_KEY")),
            "VERCEL": os.environ.get("VERCEL"),
        }
    }

    @app.get("/api/v1/debug")
    @app.get("/api/debug")
    @app.get("/debug")
    async def debug():
        return JSONResponse(error_info)

    @app.get("/api/v1/health")
    @app.get("/api/health")
    @app.get("/health")
    async def health():
        return JSONResponse({"status": "error", **error_info}, status_code=500)

    @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
    async def catch_all(path: str):
        return JSONResponse({
            "error": "Application failed to initialize",
            "path": path,
            "hint": "Check /api/v1/debug for details",
            **error_info
        }, status_code=500)

# Criar handler Mangum - este é o formato que Vercel espera
handler = Mangum(app, lifespan="off")
