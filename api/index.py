import sys
import os

# Adicionar o diretório backend ao path para que os imports funcionem corretamente na Vercel
backend_path = os.path.join(os.path.dirname(__file__), '..', 'backend')
sys.path.insert(0, backend_path)

# Tentar importar a aplicação FastAPI com tratamento de erro
try:
    from app.main import app
    handler = app
except Exception as e:
    # Se falhar, criar uma app minimalista para diagnóstico
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse
    
    app = FastAPI()
    
    @app.get("/api/v1/health")
    def health():
        return {"status": "error", "message": f"Failed to load main app: {str(e)}"}
    
    @app.get("/{path:path}")
    def catch_all(path: str):
        return JSONResponse(
            status_code=500,
            content={
                "error": "Application failed to initialize",
                "details": str(e),
                "backend_path": backend_path,
                "sys_path": sys.path[:5]
            }
        )
    
    handler = app

