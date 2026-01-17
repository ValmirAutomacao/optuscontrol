"""
Optus Control API
Backend FastAPI para gestão financeira e conformidade de licitações.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings
from .api.routes import invoices, receipts, indicators, projects, payables, companies, categories, export, notifications, admin, auth, users

# Criar aplicação
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="API para gestão de notas fiscais, cupons e indicadores financeiros",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "https://optusagentiasaas.shop",
        "https://www.optusagentiasaas.shop",
        "https://api.optusagentiasaas.shop",
        "https://*.vercel.app",
        "https://*.supabase.co"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar rotas
app.include_router(invoices.router, prefix=settings.API_V1_PREFIX)
app.include_router(receipts.router, prefix=settings.API_V1_PREFIX)
app.include_router(indicators.router, prefix=settings.API_V1_PREFIX)
app.include_router(projects.router, prefix=settings.API_V1_PREFIX)
app.include_router(payables.router, prefix=settings.API_V1_PREFIX)
app.include_router(companies.router, prefix=settings.API_V1_PREFIX)
app.include_router(categories.router, prefix=settings.API_V1_PREFIX)
app.include_router(export.router, prefix=settings.API_V1_PREFIX)
app.include_router(notifications.router, prefix=settings.API_V1_PREFIX)
app.include_router(admin.router, prefix=settings.API_V1_PREFIX)
app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(users.router, prefix=settings.API_V1_PREFIX)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "name": settings.PROJECT_NAME,
        "version": "1.0.0",
        "status": "healthy"
    }


@app.get("/health")
async def health_check():
    """Verificação de saúde da API."""
    return {"status": "ok"}


# Endpoint de informações da API
@app.get(f"{settings.API_V1_PREFIX}/info")
async def api_info():
    """Informações sobre a API."""
    return {
        "name": settings.PROJECT_NAME,
        "version": "1.0.0",
        "endpoints": {
            "invoices": f"{settings.API_V1_PREFIX}/invoices",
            "receipts": f"{settings.API_V1_PREFIX}/receipts",
            "indicators": f"{settings.API_V1_PREFIX}/indicators"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
