"""
Rotas de Contas a Pagar (CRUD completo)
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import date
from ...db.supabase_client import supabase
from ...core.auth import get_current_user
from fastapi import Depends

router = APIRouter(prefix="/payables", tags=["Payables"])


@router.get("")
async def list_payables(
    company_id: str = Query(...),
    status: Optional[str] = None,
    project_id: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
) -> List[dict]:
    """Lista contas a pagar de uma empresa."""
    # Blindagem Multi-tenant
    if not current_user.get("is_developer") and current_user.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Acesso negado aos dados desta empresa.")

    query = supabase.table("payables").select("*").eq("company_id", company_id)
    
    if status:
        query = query.eq("status", status)
    
    if project_id:
        query = query.eq("project_id", project_id)
    
    result = query.order("due_date", desc=False).limit(limit).execute()
    return result.data


@router.get("/summary")
async def get_payables_summary(
    company_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
) -> dict:
    """Retorna resumo das contas a pagar."""
    # Blindagem Multi-tenant
    if not current_user.get("is_developer") and current_user.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Acesso negado.")

    result = supabase.table("payables").select("*").eq("company_id", company_id).execute()
    payables = result.data
    
    pending = [p for p in payables if p.get("status") == "pending"]
    paid = [p for p in payables if p.get("status") == "paid"]
    overdue = [p for p in payables if p.get("status") == "overdue"]
    
    return {
        "total_pending": sum(p.get("amount", 0) for p in pending),
        "total_paid": sum(p.get("amount", 0) for p in paid),
        "total_overdue": sum(p.get("amount", 0) for p in overdue),
        "count_pending": len(pending),
        "count_paid": len(paid),
        "count_overdue": len(overdue)
    }


@router.get("/{payable_id}")
async def get_payable(payable_id: str) -> dict:
    """Retorna uma conta a pagar específica."""
    result = supabase.table("payables").select("*").eq("id", payable_id).single().execute()
    return result.data


@router.post("")
async def create_payable(
    company_id: str = Query(...),
    description: str = Query(...),
    supplier_name: str = Query(...),
    due_date: str = Query(...),
    amount: float = Query(...),
    project_id: Optional[str] = None,
    supplier_cnpj: Optional[str] = None,
    account_category: Optional[str] = None,
    is_provision: bool = False,
    current_user: dict = Depends(get_current_user)
) -> dict:
    """Cria uma nova conta a pagar."""
    # Blindagem Multi-tenant
    if not current_user.get("is_developer") and current_user.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Acesso negado para criar contas nesta empresa.")
    payable_data = {
        "company_id": company_id,
        "project_id": project_id,
        "description": description,
        "supplier_name": supplier_name,
        "supplier_cnpj": supplier_cnpj,
        "due_date": due_date,
        "amount": amount,
        "account_category": account_category,
        "is_provision": is_provision,
        "status": "pending"
    }
    
    result = supabase.table("payables").insert(payable_data).execute()
    return result.data[0]


@router.put("/{payable_id}")
async def update_payable(
    payable_id: str,
    description: Optional[str] = None,
    supplier_name: Optional[str] = None,
    supplier_cnpj: Optional[str] = None,
    due_date: Optional[str] = None,
    amount: Optional[float] = None,
    account_category: Optional[str] = None,
    status: Optional[str] = None
) -> dict:
    """Atualiza uma conta a pagar."""
    update_data = {}
    if description is not None: update_data["description"] = description
    if supplier_name is not None: update_data["supplier_name"] = supplier_name
    if supplier_cnpj is not None: update_data["supplier_cnpj"] = supplier_cnpj
    if due_date is not None: update_data["due_date"] = due_date
    if amount is not None: update_data["amount"] = amount
    if account_category is not None: update_data["account_category"] = account_category
    if status is not None: update_data["status"] = status
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
    
    result = supabase.table("payables").update(update_data).eq("id", payable_id).execute()
    return result.data[0] if result.data else {"success": True}


@router.post("/{payable_id}/pay")
async def mark_as_paid(
    payable_id: str,
    payment_date: str = Query(...)
) -> dict:
    """Marca uma conta como paga."""
    update_data = {
        "status": "paid",
        "payment_date": payment_date
    }
    
    supabase.table("payables").update(update_data).eq("id", payable_id).execute()
    return {"success": True}


@router.delete("/{payable_id}")
async def delete_payable(payable_id: str) -> dict:
    """Remove uma conta a pagar."""
    supabase.table("payables").delete().eq("id", payable_id).execute()
    return {"success": True}
