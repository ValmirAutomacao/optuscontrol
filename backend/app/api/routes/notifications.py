"""
Rotas de Notificações
"""
from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
from datetime import datetime
from ...db.supabase_client import supabase
from ...core.auth import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("")
async def list_notifications(
    unread_only: bool = False,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
) -> List[dict]:
    """Lista notificações do usuário."""
    user_id = current_user["user_id"]
    company_id = current_user.get("company_id")
    
    query = supabase.table("notifications").select("*").eq("user_id", user_id)
    
    if company_id:
        query = query.eq("company_id", company_id)
    
    if unread_only:
        query = query.eq("is_read", False)
    
    result = query.order("created_at", desc=True).limit(limit).execute()
    return result.data or []


@router.get("/count")
async def count_unread_notifications(
    current_user: dict = Depends(get_current_user)
) -> dict:
    """Conta notificações não lidas."""
    user_id = current_user["user_id"]
    company_id = current_user.get("company_id")
    
    query = supabase.table("notifications").select("id").eq("user_id", user_id).eq("is_read", False)
    
    if company_id:
        query = query.eq("company_id", company_id)
    
    result = query.execute()
    return {"unread_count": len(result.data or [])}


@router.post("")
async def create_private_notification(
    type: str,
    title: str,
    message: Optional[str] = None,
    action_url: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
) -> dict:
    """Cria uma nova notificação para o usuário logado."""
    user_id = current_user["user_id"]
    company_id = current_user["company_id"]
    
    data = {
        "user_id": user_id,
        "company_id": company_id,
        "type": type,
        "title": title,
        "message": message,
        "action_url": action_url,
        "is_read": False
    }
    
    result = supabase.table("notifications").insert(data).execute()
    return result.data[0]


@router.put("/{notification_id}/read")
async def mark_as_read(notification_id: str) -> dict:
    """Marca uma notificação como lida."""
    supabase.table("notifications").update({"is_read": True}).eq("id", notification_id).execute()
    return {"success": True}


@router.put("/read-all")
async def mark_all_as_read(current_user: dict = Depends(get_current_user)) -> dict:
    """Marca todas as notificações como lidas."""
    user_id = current_user["user_id"]
    supabase.table("notifications").update({"is_read": True}).eq("user_id", user_id).eq("is_read", False).execute()
    return {"success": True}


@router.delete("/{notification_id}")
async def delete_notification(notification_id: str) -> dict:
    """Remove uma notificação."""
    supabase.table("notifications").delete().eq("id", notification_id).execute()
    return {"success": True}


# ====== Notification Templates ======

async def notify_payment_due(user_id: str, company_id: str, payable_id: str, due_date: str, amount: float, supplier: str):
    """Cria notificação de conta a pagar próxima do vencimento."""
    return await create_notification(
        user_id=user_id,
        company_id=company_id,
        type="payment_due",
        title=f"Conta a pagar vence em breve",
        message=f"{supplier}: R$ {amount:.2f} vence em {due_date}",
        action_url=f"/payables?id={payable_id}"
    )


async def notify_new_document(user_id: str, company_id: str, doc_type: str, doc_id: str):
    """Cria notificação de novo documento recebido."""
    doc_names = {"invoice": "NF-e", "receipt": "Despesa"}
    return await create_notification(
        user_id=user_id,
        company_id=company_id,
        type="new_document",
        title=f"Novo documento: {doc_names.get(doc_type, doc_type)}",
        message="Um novo documento foi adicionado ao sistema",
        action_url=f"/{doc_type}s?id={doc_id}"
    )


async def notify_liquidity_alert(user_id: str, company_id: str, indicator: str, value: float):
    """Cria notificação de alerta de liquidez."""
    return await create_notification(
        user_id=user_id,
        company_id=company_id,
        type="liquidity_alert",
        title=f"Alerta: Índice {indicator} abaixo do mínimo",
        message=f"Valor atual: {value:.2f}. Recomendado: >= 1.0",
        action_url="/indicators"
    )
