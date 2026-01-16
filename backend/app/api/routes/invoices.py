"""
Rotas de Notas Fiscais (NF-e)
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from typing import List, Optional
from ...db.supabase_client import supabase
from ...core.nfe_parser import parse_nfe_xml
from ...core.auth import get_current_user
from ...schemas.models import InvoiceCreate, InvoiceResponse
from fastapi import Depends

router = APIRouter(prefix="/invoices", tags=["Invoices"])


@router.get("")
async def list_invoices(
    company_id: str = Query(...),
    status: Optional[str] = None,
    project_id: Optional[str] = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
) -> List[dict]:
    """Lista notas fiscais de uma empresa."""
    # Blindagem Multi-tenant
    if not current_user.get("is_developer") and current_user.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Acesso negado aos dados desta empresa.")

    query = supabase.table("invoices").select("*").eq("company_id", company_id)
    
    if status:
        query = query.eq("status", status)
    
    if project_id:
        query = query.eq("project_id", project_id)
    
    result = query.order("created_at", desc=True).limit(limit).execute()
    return result.data


@router.get("/{invoice_id}")
async def get_invoice(invoice_id: str) -> dict:
    """Retorna uma nota fiscal específica."""
    result = supabase.table("invoices").select("*").eq("id", invoice_id).single().execute()
    return result.data


@router.post("/upload")
async def upload_xml(
    file: UploadFile = File(...),
    company_id: str = Query(...),
    project_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
) -> dict:
    """
    Faz upload e processa um arquivo XML de NF-e.
    Cria automaticamente os registros de invoice e payables.
    """
    # Blindagem Multi-tenant
    if not current_user.get("is_developer") and current_user.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Acesso negado para realizar upload nesta empresa.")
    if not file.filename.endswith('.xml'):
        raise HTTPException(status_code=400, detail="O arquivo deve ser um XML")
    
    try:
        # Ler conteúdo do arquivo
        content = await file.read()
        xml_content = content.decode('utf-8')
        
        # Parsear o XML
        parsed = parse_nfe_xml(xml_content)
        
        # Verificar se já existe
        if parsed.get('access_key'):
            existing = supabase.table("invoices").select("id").eq("access_key", parsed['access_key']).execute()
            if existing.data:
                raise HTTPException(status_code=409, detail="Nota fiscal já cadastrada")
        
        # Criar registro da invoice
        invoice_data = {
            "company_id": company_id,
            "project_id": project_id,
            "access_key": parsed.get('access_key'),
            "number": parsed.get('number', ''),
            "series": parsed.get('series'),
            "supplier_cnpj": parsed.get('supplier_cnpj', ''),
            "supplier_name": parsed.get('supplier_name', ''),
            "supplier_state": parsed.get('supplier_state'),
            "issue_date": parsed.get('issue_date'),
            "total_products": parsed.get('total_products', 0),
            "total_services": parsed.get('total_services', 0),
            "total_value": parsed.get('total_value', 0),
            "icms_value": parsed.get('icms_value', 0),
            "ipi_value": parsed.get('ipi_value', 0),
            "xml_content": xml_content,
            "status": "processed"
        }
        
        invoice_result = supabase.table("invoices").insert(invoice_data).execute()
        invoice = invoice_result.data[0]
        
        # Criar payables a partir das duplicatas
        payables_created = []
        for payment in parsed.get('payments', []):
            if payment.get('amount') and payment.get('due_date'):
                payable_data = {
                    "company_id": company_id,
                    "project_id": project_id,
                    "invoice_id": invoice['id'],
                    "description": f"NF {parsed.get('number')} - Parcela {payment.get('number', '1')}",
                    "supplier_name": parsed.get('supplier_name', ''),
                    "supplier_cnpj": parsed.get('supplier_cnpj'),
                    "due_date": payment['due_date'],
                    "amount": payment['amount'],
                    "status": "pending"
                }
                payable_result = supabase.table("payables").insert(payable_data).execute()
                payables_created.append(payable_result.data[0])
        
        # Se não houver duplicatas, criar uma única parcela com valor total
        if not payables_created and parsed.get('total_value'):
            payable_data = {
                "company_id": company_id,
                "project_id": project_id,
                "invoice_id": invoice['id'],
                "description": f"NF {parsed.get('number')} - Pagamento único",
                "supplier_name": parsed.get('supplier_name', ''),
                "supplier_cnpj": parsed.get('supplier_cnpj'),
                "due_date": parsed.get('issue_date'),
                "amount": parsed.get('total_value'),
                "status": "pending"
            }
            payable_result = supabase.table("payables").insert(payable_data).execute()
            payables_created.append(payable_result.data[0])
        
        return {
            "success": True,
            "invoice": invoice,
            "payables_created": len(payables_created),
            "items_count": len(parsed.get('items', []))
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao processar XML: {str(e)}")


@router.delete("/{invoice_id}")
async def delete_invoice(invoice_id: str) -> dict:
    """Remove uma nota fiscal."""
    supabase.table("invoices").delete().eq("id", invoice_id).execute()
    return {"success": True}
