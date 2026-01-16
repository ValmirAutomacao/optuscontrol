"""
Rotas de Projetos/Obras (CRUD completo) + Medições + Provisões
"""
from fastapi import APIRouter, HTTPException, Query, Body
from typing import List, Optional
from pydantic import BaseModel
from datetime import date, datetime
from ...db.supabase_client import supabase
from ...core.auth import get_current_user
from fastapi import Depends

router = APIRouter(prefix="/projects", tags=["Projects"])


# ====== Schemas ======

class ProjectCreate(BaseModel):
    company_id: str
    name: str
    description: Optional[str] = None
    status: str = "active"
    budget: Optional[float] = None
    start_date: Optional[str] = None
    expected_end_date: Optional[str] = None
    zip_code: Optional[str] = None
    address: Optional[str] = None
    address_number: Optional[str] = None
    neighborhood: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    budget: Optional[float] = None
    start_date: Optional[str] = None
    expected_end_date: Optional[str] = None
    actual_end_date: Optional[str] = None
    zip_code: Optional[str] = None
    address: Optional[str] = None
    address_number: Optional[str] = None
    neighborhood: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None


class MeasurementCreate(BaseModel):
    project_id: str
    company_id: str
    reference_month: str  # YYYY-MM-DD (primeiro dia do mês)
    amount: float
    status: str = "pending"
    attachment_url: Optional[str] = None
    notes: Optional[str] = None


class ProvisionCreate(BaseModel):
    project_id: str
    company_id: str
    description: str
    supplier_name: Optional[str] = None
    expected_amount: float
    expected_date: Optional[str] = None


# ====== Projects CRUD ======

@router.get("")
async def list_projects(
    company_id: str = Query(...),
    status: Optional[str] = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
) -> List[dict]:
    """Lista projetos de uma empresa."""
    # Blindagem Multi-tenant
    if not current_user.get("is_developer") and current_user.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Acesso negado aos dados desta empresa.")

    query = supabase.table("projects").select("*").eq("company_id", company_id)
    
    if status:
        query = query.eq("status", status)
    
    result = query.order("created_at", desc=True).limit(limit).execute()
    return result.data or []


@router.get("/{project_id}")
async def get_project(project_id: str) -> dict:
    """Retorna um projeto específico."""
    result = supabase.table("projects").select("*").eq("id", project_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    return result.data


@router.post("")
async def create_project(
    project: ProjectCreate,
    current_user: dict = Depends(get_current_user)
) -> dict:
    """Cria um novo projeto."""
    # Blindagem Multi-tenant
    if not current_user.get("is_developer") and current_user.get("company_id") != project.company_id:
        raise HTTPException(status_code=403, detail="Acesso negado para criar projetos nesta empresa.")
    
    project_data = project.model_dump(exclude_none=True)
    result = supabase.table("projects").insert(project_data).execute()
    return result.data[0]


@router.put("/{project_id}")
async def update_project(project_id: str, project: ProjectUpdate) -> dict:
    """Atualiza um projeto."""
    update_data = project.model_dump(exclude_none=True)
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
    
    update_data["updated_at"] = datetime.now().isoformat()
    
    result = supabase.table("projects").update(update_data).eq("id", project_id).execute()
    return result.data[0] if result.data else {"success": True}


@router.delete("/{project_id}")
async def delete_project(project_id: str) -> dict:
    """Remove um projeto."""
    supabase.table("projects").delete().eq("id", project_id).execute()
    return {"success": True}


@router.get("/{project_id}/stats")
async def get_project_stats(project_id: str) -> dict:
    """Retorna estatísticas de um projeto."""
    # Buscar despesas do projeto
    expenses = supabase.table("receipts").select("id, total_amount").eq("project_id", project_id).execute()
    
    # Buscar NF-e do projeto
    invoices = supabase.table("invoices").select("id, total_value").eq("project_id", project_id).execute()
    
    # Buscar medições
    measurements = supabase.table("measurements").select("id, amount, status").eq("project_id", project_id).execute()
    
    # Buscar provisões
    provisions = supabase.table("provisions").select("id, expected_amount, status").eq("project_id", project_id).execute()
    
    return {
        "expenses_total": sum(e.get("total_amount", 0) or 0 for e in (expenses.data or [])),
        "invoices_total": sum(i.get("total_value", 0) or 0 for i in (invoices.data or [])),
        "measurements_total": sum(m.get("amount", 0) or 0 for m in (measurements.data or [])),
        "provisions_pending": sum(p.get("expected_amount", 0) or 0 for p in (provisions.data or []) if p.get("status") == "pending")
    }


# ====== Measurements (Medições) ======

@router.get("/{project_id}/measurements")
async def list_measurements(project_id: str) -> List[dict]:
    """Lista medições de um projeto."""
    result = supabase.table("measurements").select("*").eq("project_id", project_id).order("reference_month", desc=True).execute()
    return result.data or []


@router.post("/measurements")
async def create_measurement(measurement: MeasurementCreate) -> dict:
    """Cria uma nova medição."""
    data = measurement.model_dump(exclude_none=True)
    result = supabase.table("measurements").insert(data).execute()
    return result.data[0]


@router.put("/measurements/{measurement_id}")
async def update_measurement(
    measurement_id: str,
    amount: Optional[float] = None,
    status: Optional[str] = None,
    notes: Optional[str] = None
) -> dict:
    """Atualiza uma medição."""
    update_data = {}
    if amount is not None: update_data["amount"] = amount
    if status is not None: update_data["status"] = status
    if notes is not None: update_data["notes"] = notes
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
    
    result = supabase.table("measurements").update(update_data).eq("id", measurement_id).execute()
    return result.data[0] if result.data else {"success": True}


@router.delete("/measurements/{measurement_id}")
async def delete_measurement(measurement_id: str) -> dict:
    """Remove uma medição."""
    supabase.table("measurements").delete().eq("id", measurement_id).execute()
    return {"success": True}


# ====== Provisions (Provisões) ======

@router.get("/{project_id}/provisions")
async def list_provisions(project_id: str) -> List[dict]:
    """Lista provisões de um projeto."""
    result = supabase.table("provisions").select("*").eq("project_id", project_id).order("expected_date", desc=True).execute()
    return result.data or []


@router.post("/provisions")
async def create_provision(provision: ProvisionCreate) -> dict:
    """Cria uma nova provisão."""
    data = provision.model_dump(exclude_none=True)
    result = supabase.table("provisions").insert(data).execute()
    return result.data[0]


@router.put("/provisions/{provision_id}")
async def update_provision(
    provision_id: str,
    description: Optional[str] = None,
    expected_amount: Optional[float] = None,
    status: Optional[str] = None,
    matched_invoice_id: Optional[str] = None
) -> dict:
    """Atualiza uma provisão."""
    update_data = {}
    if description is not None: update_data["description"] = description
    if expected_amount is not None: update_data["expected_amount"] = expected_amount
    if status is not None: update_data["status"] = status
    if matched_invoice_id is not None: update_data["matched_invoice_id"] = matched_invoice_id
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
    
    result = supabase.table("provisions").update(update_data).eq("id", provision_id).execute()
    return result.data[0] if result.data else {"success": True}


@router.delete("/provisions/{provision_id}")
async def delete_provision(provision_id: str) -> dict:
    """Remove uma provisão."""
    supabase.table("provisions").delete().eq("id", provision_id).execute()
    return {"success": True}


@router.post("/provisions/{provision_id}/match")
async def match_provision_to_invoice(provision_id: str, invoice_id: str = Query(...)) -> dict:
    """Vincula uma provisão a uma NF-e (matching automático)."""
    # Atualizar provisão
    supabase.table("provisions").update({
        "matched_invoice_id": invoice_id,
        "status": "matched"
    }).eq("id", provision_id).execute()
    
    return {"success": True, "message": "Provisão vinculada à NF-e com sucesso"}


@router.get("/provisions/unmatched")
async def list_unmatched_provisions(
    company_id: str = Query(...),
    project_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
) -> List[dict]:
    """Lista provisões pendentes de matching."""
    # Blindagem Multi-tenant
    if not current_user.get("is_developer") and current_user.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Acesso negado.")

    query = supabase.table("provisions").select("*").eq("company_id", company_id).eq("status", "pending")
    
    if project_id:
        query = query.eq("project_id", project_id)
    
    result = query.order("expected_date", desc=True).execute()
    return result.data or []


@router.get("/provisions/{provision_id}/suggestions")
async def get_matching_suggestions(provision_id: str) -> List[dict]:
    """
    Retorna sugestões de NF-e para matching com uma provisão.
    Busca por fornecedor similar e valor próximo (±20%).
    """
    # Buscar provisão
    provision_result = supabase.table("provisions").select("*").eq("id", provision_id).single().execute()
    if not provision_result.data:
        raise HTTPException(status_code=404, detail="Provisão não encontrada")
    
    provision = provision_result.data
    company_id = provision["company_id"]
    project_id = provision.get("project_id")
    expected_amount = provision.get("expected_amount", 0)
    supplier_name = provision.get("supplier_name", "").lower()
    
    # Buscar NF-e não vinculadas do mesmo projeto (ou empresa)
    query = supabase.table("invoices").select("*").eq("company_id", company_id)
    
    if project_id:
        query = query.eq("project_id", project_id)
    
    invoices_result = query.execute()
    
    # Filtrar NF-e que já estão vinculadas
    matched_invoices = supabase.table("provisions").select("matched_invoice_id").eq(
        "company_id", company_id
    ).neq("matched_invoice_id", None).execute()
    matched_ids = set(p.get("matched_invoice_id") for p in (matched_invoices.data or []) if p.get("matched_invoice_id"))
    
    suggestions = []
    for inv in (invoices_result.data or []):
        if inv["id"] in matched_ids:
            continue
        
        inv_value = inv.get("total_value", 0)
        inv_supplier = (inv.get("supplier_name") or "").lower()
        
        # Calcular score de matching
        score = 0
        
        # Verificar valor (±20%)
        if expected_amount > 0:
            value_diff = abs(inv_value - expected_amount) / expected_amount
            if value_diff <= 0.05:  # Diferença até 5%
                score += 50
            elif value_diff <= 0.10:  # Diferença até 10%
                score += 30
            elif value_diff <= 0.20:  # Diferença até 20%
                score += 10
        
        # Verificar fornecedor
        if supplier_name and inv_supplier:
            if supplier_name in inv_supplier or inv_supplier in supplier_name:
                score += 40
            elif any(word in inv_supplier for word in supplier_name.split() if len(word) > 3):
                score += 20
        
        # Só incluir se tiver alguma relevância
        if score > 0:
            suggestions.append({
                "invoice": inv,
                "score": score,
                "value_match": abs(inv_value - expected_amount) <= expected_amount * 0.20 if expected_amount else False,
                "supplier_match": supplier_name in inv_supplier or inv_supplier in supplier_name if supplier_name and inv_supplier else False
            })
    
    # Ordenar por score
    suggestions.sort(key=lambda x: x["score"], reverse=True)
    
    return suggestions[:10]  # Retornar top 10


@router.post("/provisions/auto-match")
async def auto_match_provisions(
    company_id: str = Query(...),
    project_id: Optional[str] = None,
    max_value_diff: float = Query(0.05, description="Diferença máxima de valor permitida (0.05 = 5%)")
) -> dict:
    """
    Matching automático de provisões com NF-e.
    Vincula automaticamente quando valor e fornecedor coincidem exatamente.
    """
    # Buscar provisões pendentes
    query = supabase.table("provisions").select("*").eq("company_id", company_id).eq("status", "pending")
    if project_id:
        query = query.eq("project_id", project_id)
    provisions = query.execute().data or []
    
    # Buscar NF-e disponíveis
    inv_query = supabase.table("invoices").select("*").eq("company_id", company_id)
    if project_id:
        inv_query = inv_query.eq("project_id", project_id)
    invoices = inv_query.execute().data or []
    
    # Buscar NF-e já vinculadas
    matched_result = supabase.table("provisions").select("matched_invoice_id").eq(
        "company_id", company_id
    ).neq("matched_invoice_id", None).execute()
    matched_ids = set(p.get("matched_invoice_id") for p in (matched_result.data or []) if p.get("matched_invoice_id"))
    
    # Indexar NF-e por fornecedor
    invoices_available = [inv for inv in invoices if inv["id"] not in matched_ids]
    
    matches_made = []
    
    for provision in provisions:
        expected_amount = provision.get("expected_amount", 0)
        supplier_name = (provision.get("supplier_name") or "").lower().strip()
        
        if not expected_amount:
            continue
        
        for inv in invoices_available:
            inv_supplier = (inv.get("supplier_name") or "").lower().strip()
            inv_value = inv.get("total_value", 0)
            
            # Match exato de fornecedor ou substring
            supplier_matches = (
                supplier_name and inv_supplier and
                (supplier_name == inv_supplier or 
                 supplier_name in inv_supplier or 
                 inv_supplier in supplier_name)
            )
            
            # Match de valor dentro da tolerância
            value_diff = abs(inv_value - expected_amount) / expected_amount if expected_amount else 1
            value_matches = value_diff <= max_value_diff
            
            if supplier_matches and value_matches:
                # Executar match
                supabase.table("provisions").update({
                    "matched_invoice_id": inv["id"],
                    "status": "matched"
                }).eq("id", provision["id"]).execute()
                
                matches_made.append({
                    "provision_id": provision["id"],
                    "provision_description": provision.get("description"),
                    "invoice_id": inv["id"],
                    "invoice_number": inv.get("number"),
                    "expected_amount": expected_amount,
                    "actual_amount": inv_value,
                    "value_diff_pct": round(value_diff * 100, 2)
                })
                
                # Remover NF-e da lista de disponíveis
                invoices_available.remove(inv)
                break
    
    return {
        "success": True,
        "matches_made": len(matches_made),
        "matches": matches_made,
        "provisions_remaining": len(provisions) - len(matches_made)
    }


