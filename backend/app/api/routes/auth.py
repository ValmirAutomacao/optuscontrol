"""
Rotas de Autenticação e Permissões
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from ...core.auth import get_current_user, get_user_permissions

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.get("/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)) -> dict:
    """Retorna informações do usuário logado."""
    return {
        "user_id": current_user.get("user_id"),
        "email": current_user.get("email"),
        "company_id": current_user.get("company_id"),
        "role": current_user.get("role"),
        "companies": current_user.get("companies", []),
        "is_developer": current_user.get("is_developer", False)
    }


@router.get("/permissions")
async def get_my_permissions(
    current_user: dict = Depends(get_current_user),
    company_id: Optional[str] = Query(None)
) -> dict:
    """Retorna permissões do usuário para uma empresa."""
    target_company = company_id or current_user.get("company_id")
    
    if not target_company:
        raise HTTPException(status_code=400, detail="company_id é obrigatório")
    
    # Developers têm todas as permissões
    if current_user.get("is_developer"):
        return {
            "role": "developer",
            "is_developer": True,
            "permissions": {
                "dashboard": {"create": True, "read": True, "update": True, "delete": True, "export": True},
                "companies": {"create": True, "read": True, "update": True, "delete": True, "export": True},
                "users": {"create": True, "read": True, "update": True, "delete": True, "export": True},
                "invoices": {"create": True, "read": True, "update": True, "delete": True, "export": True},
                "receipts": {"create": True, "read": True, "update": True, "delete": True, "export": True},
                "payables": {"create": True, "read": True, "update": True, "delete": True, "export": True},
                "projects": {"create": True, "read": True, "update": True, "delete": True, "export": True},
                "export": {"create": True, "read": True, "update": True, "delete": True, "export": True},
            }
        }
    
    # Verificar se usuário pertence à empresa
    user_companies = [c["company_id"] for c in current_user.get("companies", [])]
    if target_company not in user_companies:
        raise HTTPException(status_code=403, detail="Você não pertence a esta empresa")
    
    perms = await get_user_permissions(current_user["user_id"], target_company)
    
    return {
        "role": perms.get("role"),
        "is_developer": False,
        "permissions": perms.get("permissions", {})
    }


@router.get("/switch-company/{company_id}")
async def validate_company_switch(
    company_id: str,
    current_user: dict = Depends(get_current_user)
) -> dict:
    """Valida se usuário pode acessar outra empresa (para contadores)."""
    user_companies = [c["company_id"] for c in current_user.get("companies", [])]
    
    if company_id not in user_companies and not current_user.get("is_developer"):
        raise HTTPException(status_code=403, detail="Você não tem acesso a esta empresa")
    
    # Buscar dados da empresa
    from ..db.supabase_client import supabase
    company = supabase.table("companies").select("id, name, fantasy_name").eq("id", company_id).single().execute()
    
    if not company.data:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    
    # Buscar role do usuário nesta empresa
    role = "developer" if current_user.get("is_developer") else None
    for c in current_user.get("companies", []):
        if c["company_id"] == company_id:
            role = c["role"]
            break
    
    return {
        "valid": True,
        "company": company.data,
        "role": role
    }
