"""
Rotas de Empresas (CRUD completo) + Gestão de Usuários
Módulo SaaS multi-empresa
"""
from fastapi import APIRouter, HTTPException, Query, Body
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from ...db.supabase_client import supabase

router = APIRouter(prefix="/companies", tags=["Companies"])


# ====== Schemas ======

class CompanyCreate(BaseModel):
    name: str
    cnpj: str
    fantasy_name: Optional[str] = None
    state_registration: Optional[str] = None
    municipal_registration: Optional[str] = None
    address: Optional[str] = None
    address_number: Optional[str] = None
    address_complement: Optional[str] = None
    neighborhood: Optional[str] = None
    city: Optional[str] = None
    city_code: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    fantasy_name: Optional[str] = None
    cnpj: Optional[str] = None
    state_registration: Optional[str] = None
    municipal_registration: Optional[str] = None
    address: Optional[str] = None
    address_number: Optional[str] = None
    address_complement: Optional[str] = None
    neighborhood: Optional[str] = None
    city: Optional[str] = None
    city_code: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    logo_url: Optional[str] = None
    accountant_name: Optional[str] = None
    accountant_crc: Optional[str] = None
    accountant_cpf: Optional[str] = None
    accountant_email: Optional[str] = None


class UserInvite(BaseModel):
    email: str
    role: str = "operator"


# ====== Company CRUD ======

@router.get("")
async def list_companies(limit: int = 50) -> List[dict]:
    """Lista todas as empresas."""
    result = supabase.table("companies").select("*").order("created_at", desc=True).limit(limit).execute()
    return result.data


@router.get("/{company_id}")
async def get_company(company_id: str) -> dict:
    """Retorna uma empresa específica com todos os dados."""
    result = supabase.table("companies").select("*").eq("id", company_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    return result.data


@router.post("")
async def create_company(company: CompanyCreate) -> dict:
    """Cria uma nova empresa."""
    company_data = company.model_dump(exclude_none=True)
    company_data["subscription_status"] = "trial"
    company_data["subscription_plan"] = "free"
    company_data["trial_ends_at"] = (datetime.now().replace(day=1) + 
                                      __import__('dateutil.relativedelta', fromlist=['relativedelta']).relativedelta(months=1)).isoformat()
    
    try:
        result = supabase.table("companies").insert(company_data).execute()
        return result.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{company_id}")
async def update_company(company_id: str, company: CompanyUpdate) -> dict:
    """Atualiza uma empresa."""
    update_data = company.model_dump(exclude_none=True)
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
    
    update_data["updated_at"] = datetime.now().isoformat()
    
    result = supabase.table("companies").update(update_data).eq("id", company_id).execute()
    return result.data[0] if result.data else {"success": True}


@router.delete("/{company_id}")
async def delete_company(company_id: str) -> dict:
    """Remove uma empresa (soft delete)."""
    supabase.table("companies").update({"is_active": False}).eq("id", company_id).execute()
    return {"success": True}


@router.get("/{company_id}/stats")
async def get_company_stats(company_id: str) -> dict:
    """Retorna estatísticas da empresa."""
    projects = supabase.table("projects").select("id").eq("company_id", company_id).execute()
    invoices = supabase.table("invoices").select("id, total_value").eq("company_id", company_id).execute()
    payables = supabase.table("payables").select("id, amount, status").eq("company_id", company_id).execute()
    receipts = supabase.table("receipts").select("id, total_amount").eq("company_id", company_id).execute()
    users = supabase.table("user_roles").select("id").eq("company_id", company_id).eq("is_active", True).execute()
    
    return {
        "projects_count": len(projects.data or []),
        "invoices_count": len(invoices.data or []),
        "invoices_total": sum(i.get("total_value", 0) or 0 for i in (invoices.data or [])),
        "payables_count": len(payables.data or []),
        "payables_pending": sum(p.get("amount", 0) or 0 for p in (payables.data or []) if p.get("status") == "pending"),
        "receipts_count": len(receipts.data or []),
        "receipts_total": sum(r.get("total_amount", 0) or 0 for r in (receipts.data or [])),
        "users_count": len(users.data or [])
    }


# ====== User Management ======

@router.get("/{company_id}/users")
async def list_company_users_legacy(company_id: str) -> List[dict]:
    """Lista usuários da empresa (Legado)."""
    result = supabase.table("user_roles").select(
        "*"
    ).eq("company_id", company_id).eq("is_active", True).execute()
    
    # Formatar resposta
    users = []
    for ur in (result.data or []):
        user_info = ur.get("user") or {}
        users.append({
            "id": ur.get("id"),
            "user_id": ur.get("user_id"),
            "email": user_info.get("email", ""),
            "name": (user_info.get("raw_user_meta_data") or {}).get("full_name", ""),
            "role": ur.get("role"),
            "is_active": ur.get("is_active"),
            "invited_at": ur.get("invited_at"),
            "accepted_at": ur.get("accepted_at")
        })
    return users


@router.post("/{company_id}/users/invite")
async def invite_user(company_id: str, invite: UserInvite) -> dict:
    """Convida um usuário para a empresa."""
    # Verificar se role é válido
    valid_roles = ["owner", "admin", "accountant", "manager", "operator"]
    if invite.role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Role inválido. Usar: {valid_roles}")
    
    # Criar convite (usuário será criado quando aceitar)
    invite_data = {
        "company_id": company_id,
        "role": invite.role,
        "invited_at": datetime.now().isoformat(),
        # user_id será preenchido quando aceitar o convite
    }
    
    # Por enquanto, retornamos o link de convite
    # Em produção: enviar email com link
    return {
        "success": True,
        "email": invite.email,
        "role": invite.role,
        "message": "Convite enviado com sucesso"
    }


@router.put("/{company_id}/users/{user_role_id}")
async def update_user_role(company_id: str, user_role_id: str, role: str = Query(...)) -> dict:
    """Atualiza o role de um usuário."""
    valid_roles = ["owner", "admin", "accountant", "manager", "operator"]
    if role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Role inválido. Usar: {valid_roles}")
    
    result = supabase.table("user_roles").update({
        "role": role,
        "updated_at": datetime.now().isoformat()
    }).eq("id", user_role_id).eq("company_id", company_id).execute()
    
    return {"success": True, "role": role}


@router.delete("/{company_id}/users/{user_role_id}")
async def remove_user(company_id: str, user_role_id: str) -> dict:
    """Remove um usuário da empresa (soft delete)."""
    supabase.table("user_roles").update({
        "is_active": False,
        "updated_at": datetime.now().isoformat()
    }).eq("id", user_role_id).eq("company_id", company_id).execute()
    
    return {"success": True}


# ====== Permissions ======

@router.get("/permissions/{role}")
async def get_role_permissions(role: str) -> List[dict]:
    """Retorna permissões de um role."""
    result = supabase.table("role_permissions").select("*").eq("role", role).execute()
    return result.data or []


@router.get("/{company_id}/my-permissions")
async def get_my_permissions(company_id: str, user_id: str = Query(...)) -> dict:
    """Retorna permissões do usuário atual na empresa."""
    # Buscar role do usuário
    user_role = supabase.table("user_roles").select("role").eq(
        "company_id", company_id
    ).eq("user_id", user_id).eq("is_active", True).single().execute()
    
    if not user_role.data:
        raise HTTPException(status_code=404, detail="Usuário não encontrado na empresa")
    
    role = user_role.data.get("role")
    
    # Buscar permissões do role
    perms = supabase.table("role_permissions").select("*").eq("role", role).execute()
    
    return {
        "role": role,
        "permissions": {p.get("module"): {
            "create": p.get("can_create"),
            "read": p.get("can_read"),
            "update": p.get("can_update"),
            "delete": p.get("can_delete"),
            "export": p.get("can_export")
        } for p in (perms.data or [])}
    }
