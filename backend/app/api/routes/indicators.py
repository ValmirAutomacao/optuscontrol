"""
Rotas de Indicadores Financeiros
"""
from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
from datetime import date
from ...db.supabase_client import supabase
from ...schemas.models import FinancialIndicatorsCreate, FinancialIndicatorsResponse
from ...core.auth import get_current_user

router = APIRouter(prefix="/indicators", tags=["Financial Indicators"])


def calculate_indicators(
    current_assets: float,
    non_current_assets: float,
    current_liabilities: float,
    non_current_liabilities: float,
    equity: float
) -> dict:
    """
    Calcula os índices de liquidez e endividamento.
    
    LC (Liquidez Corrente) = AC / PC >= 1.0
    LG (Liquidez Geral) = (AC + ANC) / (PC + PNC) >= 1.0
    GE (Grau de Endividamento) = (PC + PNC) / PL <= 1.0
    """
    total_assets = current_assets + non_current_assets
    total_liabilities = current_liabilities + non_current_liabilities
    
    # Evitar divisão por zero
    lc = round(current_assets / current_liabilities, 2) if current_liabilities > 0 else 0
    lg = round(total_assets / total_liabilities, 2) if total_liabilities > 0 else 0
    ge = round(total_liabilities / equity, 2) if equity > 0 else float('inf')
    
    # Verificar aptidão para licitação
    is_bidding_ready = lc >= 1.0 and lg >= 1.0 and ge <= 1.0
    
    return {
        "current_liquidity": lc,
        "general_liquidity": lg,
        "equity_degree": ge,
        "is_bidding_ready": is_bidding_ready
    }


@router.get("")
async def list_indicators(
    company_id: Optional[str] = None,
    limit: int = 12,
    current_user: dict = Depends(get_current_user)
) -> List[dict]:
    """Lista indicadores financeiros de uma empresa."""
    # Blindagem Multi-tenant
    if company_id and not current_user.get("is_developer") and current_user.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Acesso negado aos indicadores desta empresa.")
    
    cid = company_id or current_user.get("company_id")
    if not cid:
        raise HTTPException(status_code=400, detail="ID da empresa não associado")
        
    result = supabase.table("financial_indicators")\
        .select("*")\
        .eq("company_id", cid)\
        .order("reference_date", desc=True)\
        .limit(limit)\
        .execute()
    return result.data


@router.get("/latest")
async def get_latest_indicators(
    company_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
) -> dict:
    """Retorna os indicadores mais recentes."""
    cid = company_id or current_user.get("company_id")
    if not cid:
        return {"error": "No company associated"}
        
    result = supabase.table("financial_indicators")\
        .select("*")\
        .eq("company_id", cid)\
        .order("reference_date", desc=True)\
        .limit(1)\
        .execute()
    
    if not result.data:
        return {
            "current_liquidity": 0,
            "general_liquidity": 0,
            "equity_degree": 0,
            "is_bidding_ready": False,
            "message": "Nenhum indicador cadastrado"
        }
    
    return result.data[0]


@router.get("/bidding-status")
async def get_bidding_status(
    company_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
) -> dict:
    """
    Retorna o status de aptidão para licitação.
    Inclui detalhes sobre cada índice e o que está faltando.
    """
    cid = company_id or current_user.get("company_id")
    latest = await get_latest_indicators(cid, current_user)
    
    lc = latest.get("current_liquidity", 0)
    lg = latest.get("general_liquidity", 0)
    ge = latest.get("equity_degree", float('inf'))
    
    issues = []
    if lc < 1.0:
        issues.append(f"LC ({lc}) está abaixo de 1.0")
    if lg < 1.0:
        issues.append(f"LG ({lg}) está abaixo de 1.0")
    if ge > 1.0:
        issues.append(f"GE ({ge}) está acima de 1.0")
    
    return {
        "is_ready": len(issues) == 0,
        "current_liquidity": {"value": lc, "required": 1.0, "ok": lc >= 1.0},
        "general_liquidity": {"value": lg, "required": 1.0, "ok": lg >= 1.0},
        "equity_degree": {"value": ge, "required": 1.0, "ok": ge <= 1.0},
        "issues": issues,
        "reference_date": latest.get("reference_date")
    }


@router.post("")
async def create_indicators(
    data: FinancialIndicatorsCreate,
    current_user: dict = Depends(get_current_user)
) -> dict:
    """
    Cria/atualiza indicadores financeiros para uma data de referência.
    Os índices são calculados automaticamente.
    """
    # Blindagem Multi-tenant
    if not current_user.get("is_developer") and current_user.get("company_id") != data.company_id:
        raise HTTPException(status_code=403, detail="Acesso negado para salvar indicadores desta empresa.")
    # Calcular índices
    indices = calculate_indicators(
        data.current_assets,
        data.non_current_assets,
        data.current_liabilities,
        data.non_current_liabilities,
        data.equity
    )
    
    indicator_data = {
        "company_id": data.company_id,
        "reference_date": data.reference_date.isoformat(),
        "current_assets": data.current_assets,
        "non_current_assets": data.non_current_assets,
        "total_assets": data.current_assets + data.non_current_assets,
        "current_liabilities": data.current_liabilities,
        "non_current_liabilities": data.non_current_liabilities,
        "total_liabilities": data.current_liabilities + data.non_current_liabilities,
        "equity": data.equity,
        "gross_revenue": data.gross_revenue,
        "net_revenue": data.net_revenue,
        "net_profit": data.net_profit,
        **indices
    }
    
    result = supabase.table("financial_indicators").upsert(
        indicator_data,
        on_conflict="company_id,reference_date"
    ).execute()
    
    return {
        "success": True,
        "data": result.data[0],
        "indices": indices
    }


@router.post("/calculate")
async def calculate_only(data: FinancialIndicatorsCreate) -> dict:
    """
    Apenas calcula os índices sem salvar.
    Útil para preview antes de confirmar.
    """
    indices = calculate_indicators(
        data.current_assets,
        data.non_current_assets,
        data.current_liabilities,
        data.non_current_liabilities,
        data.equity
    )
    
    return indices


@router.get("/multi-company")
async def get_multi_company_indicators(
    current_user: dict = Depends(get_current_user)
) -> dict:
    """
    Retorna indicadores de todas as empresas que o usuário tem acesso.
    Para contadores que gerenciam múltiplas empresas.
    """
    user_id = current_user["user_id"]
    # Buscar empresas do usuário
    user_roles = supabase.table("user_roles").select(
        "company_id, role"
    ).eq("user_id", user_id).eq("is_active", True).execute()
    
    if not user_roles.data:
        return {"companies": [], "summary": {}}
    
    company_ids = [r["company_id"] for r in user_roles.data]
    
    # Buscar dados de cada empresa
    companies_data = []
    total_invoices = 0
    total_receipts = 0
    total_payables_pending = 0
    
    for cid in company_ids:
        # Info da empresa
        company = supabase.table("companies").select("id, name, fantasy_name, is_active").eq("id", cid).single().execute()
        if not company.data:
            continue
        
        # Indicadores mais recentes
        indicators = supabase.table("financial_indicators").select("*").eq(
            "company_id", cid
        ).order("reference_date", desc=True).limit(1).execute()
        
        # Contagem de documentos
        invoices = supabase.table("invoices").select("id").eq("company_id", cid).execute()
        receipts = supabase.table("receipts").select("id").eq("company_id", cid).execute()
        payables = supabase.table("payables").select("id, amount").eq("company_id", cid).eq("status", "pending").execute()
        
        inv_count = len(invoices.data or [])
        rec_count = len(receipts.data or [])
        pay_pending = sum(p.get("amount", 0) for p in (payables.data or []))
        
        total_invoices += inv_count
        total_receipts += rec_count
        total_payables_pending += pay_pending
        
        companies_data.append({
            "company": company.data,
            "indicators": indicators.data[0] if indicators.data else None,
            "stats": {
                "invoices_count": inv_count,
                "receipts_count": rec_count,
                "payables_pending": pay_pending
            }
        })
    
    return {
        "companies": companies_data,
        "summary": {
            "total_companies": len(companies_data),
            "total_invoices": total_invoices,
            "total_receipts": total_receipts,
            "total_payables_pending": total_payables_pending
        }
    }

