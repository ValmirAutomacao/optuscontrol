"""
Rotas de Categorias de Despesas (CRUD completo)
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from ...db.supabase_client import supabase

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get("")
async def list_categories(
    company_id: Optional[str] = None,
    include_system: bool = True
) -> List[dict]:
    """Lista categorias de despesas."""
    query = supabase.table("expense_categories").select("*").eq("is_active", True)
    
    if include_system:
        if company_id:
            # Categorias do sistema + da empresa
            query = query.or_(f"is_system.eq.true,company_id.eq.{company_id}")
        else:
            # Só categorias do sistema
            query = query.eq("is_system", True)
    else:
        if company_id:
            query = query.eq("company_id", company_id)
    
    result = query.order("name").execute()
    return result.data


@router.get("/{category_id}")
async def get_category(category_id: str) -> dict:
    """Retorna uma categoria específica."""
    result = supabase.table("expense_categories").select("*").eq("id", category_id).single().execute()
    return result.data


@router.post("")
async def create_category(
    name: str = Query(...),
    company_id: Optional[str] = None,
    description: Optional[str] = None,
    icon: Optional[str] = None,
    color: Optional[str] = None
) -> dict:
    """Cria uma nova categoria."""
    category_data = {
        "name": name,
        "company_id": company_id,
        "description": description,
        "icon": icon,
        "color": color,
        "is_system": False,
        "is_active": True
    }
    
    result = supabase.table("expense_categories").insert(category_data).execute()
    return result.data[0]


@router.put("/{category_id}")
async def update_category(
    category_id: str,
    name: Optional[str] = None,
    description: Optional[str] = None,
    icon: Optional[str] = None,
    color: Optional[str] = None,
    is_active: Optional[bool] = None
) -> dict:
    """Atualiza uma categoria."""
    # Verificar se não é categoria do sistema
    existing = supabase.table("expense_categories").select("is_system").eq("id", category_id).single().execute()
    if existing.data and existing.data.get("is_system"):
        raise HTTPException(status_code=400, detail="Não é possível editar categorias do sistema")
    
    update_data = {}
    if name is not None: update_data["name"] = name
    if description is not None: update_data["description"] = description
    if icon is not None: update_data["icon"] = icon
    if color is not None: update_data["color"] = color
    if is_active is not None: update_data["is_active"] = is_active
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
    
    result = supabase.table("expense_categories").update(update_data).eq("id", category_id).execute()
    return result.data[0] if result.data else {"success": True}


@router.delete("/{category_id}")
async def delete_category(category_id: str) -> dict:
    """Remove uma categoria (soft delete)."""
    # Verificar se não é categoria do sistema
    existing = supabase.table("expense_categories").select("is_system").eq("id", category_id).single().execute()
    if existing.data and existing.data.get("is_system"):
        raise HTTPException(status_code=400, detail="Não é possível excluir categorias do sistema")
    
    # Soft delete
    supabase.table("expense_categories").update({"is_active": False}).eq("id", category_id).execute()
    return {"success": True}
