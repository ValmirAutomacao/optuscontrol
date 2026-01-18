"""
Rotas de Cupons Fiscais (OCR)
Cria automaticamente contas a pagar a partir de despesas.
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timedelta
import uuid
from ...db.supabase_client import supabase
from ...core.ocr_service import process_receipt_image
from ...core.auth import get_current_user
from ...schemas.models import ReceiptCreate, ReceiptResponse
from fastapi import Depends

router = APIRouter(prefix="/receipts", tags=["Receipts"])


def generate_document_number(company_id: str, document_type: str) -> str:
    """
    Gera um número sequencial para documentos sem número (recibos/comprovantes).
    Formato: REC-2026-0001, COMP-2026-0001
    """
    year = datetime.now().year
    prefix = "REC" if document_type == "recibo" else "COMP"
    
    # Buscar último número do ano
    result = supabase.table("receipts").select("document_number") \
        .eq("company_id", company_id) \
        .like("document_number", f"{prefix}-{year}-%") \
        .order("document_number", desc=True) \
        .limit(1) \
        .execute()
    
    if result.data and result.data[0].get("document_number"):
        # Extrair número e incrementar
        last_number = result.data[0]["document_number"]
        try:
            seq = int(last_number.split("-")[-1]) + 1
        except ValueError:
            seq = 1
    else:
        seq = 1
    
    return f"{prefix}-{year}-{seq:04d}"


def create_payables_from_receipt(receipt: dict, ocr_result: dict) -> List[dict]:
    """
    Cria contas a pagar automaticamente a partir de um cupom fiscal.
    Suporta parcelamento.
    """
    payables_created = []
    
    total_amount = ocr_result.get("total_amount")
    if not total_amount or total_amount <= 0:
        return payables_created
    
    company_id = receipt["company_id"]
    receipt_id = receipt["id"]
    establishment_name = ocr_result.get("establishment_name") or "Não identificado"
    establishment_cnpj = ocr_result.get("establishment_cnpj")
    document_type = ocr_result.get("document_type", "outro").upper()
    document_number = ocr_result.get("document_number") or ""
    payment_method = ocr_result.get("payment_method") or ""
    payment_type = ocr_result.get("payment_type", "avista")
    installments = ocr_result.get("installments", 1) or 1
    
    # Data base para vencimento
    receipt_date_str = ocr_result.get("receipt_date")
    if receipt_date_str:
        try:
            base_date = datetime.strptime(receipt_date_str, "%Y-%m-%d").date()
        except ValueError:
            base_date = datetime.now().date()
    else:
        base_date = datetime.now().date()
    
    # Determinar se já foi pago (pagamento à vista)
    paid_methods = ["pix", "dinheiro", "debito"]
    is_paid = payment_method.lower() in paid_methods and payment_type == "avista"
    
    if payment_type == "parcelado" and installments > 1:
        # Criar múltiplas parcelas
        installment_value = round(total_amount / installments, 2)
        
        for i in range(installments):
            due_date = base_date + timedelta(days=30 * (i + 1))
            payable_data = {
                "company_id": company_id,
                "receipt_id": receipt_id,
                "project_id": receipt.get("project_id"),
                "description": f"{document_type} {document_number} - Parcela {i+1}/{installments} - {establishment_name}",
                "supplier_name": establishment_name,
                "supplier_cnpj": establishment_cnpj,
                "due_date": due_date.isoformat(),
                "amount": installment_value,
                "status": "pending"
            }
            
            result = supabase.table("payables").insert(payable_data).execute()
            if result.data:
                payables_created.append(result.data[0])
    else:
        # Pagamento à vista - única parcela
        payable_data = {
            "company_id": company_id,
            "receipt_id": receipt_id,
            "project_id": receipt.get("project_id"),
            "description": f"{document_type} {document_number} - {establishment_name}",
            "supplier_name": establishment_name,
            "supplier_cnpj": establishment_cnpj,
            "due_date": base_date.isoformat(),
            "amount": total_amount,
            "status": "paid" if is_paid else "pending",
            "payment_date": base_date.isoformat() if is_paid else None
        }
        
        result = supabase.table("payables").insert(payable_data).execute()
        if result.data:
            payables_created.append(result.data[0])
    
    return payables_created


@router.get("")
async def list_receipts(
    company_id: str = Query(...),
    status: Optional[str] = None,
    validated_only: bool = False,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
) -> List[dict]:
    """Lista cupons fiscais de uma empresa."""
    # Blindagem Multi-tenant
    if not current_user.get("is_developer") and current_user.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Acesso negado aos dados desta empresa.")

    query = supabase.table("receipts").select("*").eq("company_id", company_id)
    
    if status:
        query = query.eq("ocr_status", status)
    
    if validated_only:
        query = query.eq("is_validated", True)
    
    result = query.order("created_at", desc=True).limit(limit).execute()
    return result.data


@router.get("/{receipt_id}")
async def get_receipt(receipt_id: str) -> dict:
    """Retorna um cupom fiscal específico."""
    result = supabase.table("receipts").select("*").eq("id", receipt_id).single().execute()
    return result.data


@router.post("/upload")
async def upload_receipt(
    file: UploadFile = File(...),
    company_id: str = Query(...),
    project_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
) -> dict:
    """
    Faz upload de uma imagem/PDF de cupom fiscal, processa via OCR e cria conta a pagar automaticamente.
    """
    # Blindagem Multi-tenant
    if not current_user.get("is_developer") and current_user.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Acesso negado para realizar upload nesta empresa.")
    
    # Verificar tipo do arquivo
    allowed_types = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Tipo de arquivo não suportado. Use JPEG, PNG, WebP ou PDF.")
    
    try:
        # Ler arquivo
        file_bytes = await file.read()
        
        # Se for PDF, converter para imagem
        if file.content_type == 'application/pdf':
            try:
                from pdf2image import convert_from_bytes
                images = convert_from_bytes(file_bytes, first_page=1, last_page=1)
                if images:
                    import io
                    img_buffer = io.BytesIO()
                    images[0].save(img_buffer, format='JPEG', quality=90)
                    file_bytes = img_buffer.getvalue()
            except ImportError:
                raise HTTPException(status_code=500, detail="Suporte a PDF não disponível. Por favor, envie uma imagem.")
            except Exception as pdf_error:
                raise HTTPException(status_code=400, detail=f"Erro ao processar PDF: {str(pdf_error)}")
        
        # Gerar nome único
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_ext = 'jpg'  # Sempre salvar como JPG após processamento
        unique_filename = f"{timestamp}_{uuid.uuid4().hex[:8]}.{file_ext}"
        
        # Upload para Supabase Storage
        file_path = f"{company_id}/{unique_filename}"
        storage_result = supabase.storage.from_("receipts").upload(
            file_path,
            file_bytes,
            {"content-type": "image/jpeg", "upsert": "true"}
        )
        
        # Obter URL pública
        image_url = supabase.storage.from_("receipts").get_public_url(file_path)
        
        # Criar registro inicial (pendente de OCR)
        receipt_data = {
            "company_id": company_id,
            "project_id": project_id,
            "image_url": image_url,
            "ocr_status": "pending",
            "is_validated": False
        }
        
        receipt_result = supabase.table("receipts").insert(receipt_data).execute()
        receipt = receipt_result.data[0]
        
        # Processar OCR
        try:
            ocr_result = await process_receipt_image(file_bytes)
            
            # Gerar número do documento se não tiver
            document_type = ocr_result.get("document_type", "outro")
            document_number = ocr_result.get("document_number")
            
            if not document_number and document_type in ["recibo", "comprovante", "outro"]:
                document_number = generate_document_number(company_id, document_type)
                ocr_result["document_number"] = document_number
            
            # Atualizar receipt com dados do OCR
            update_data = {
                "establishment_name": ocr_result.get("establishment_name"),
                "establishment_cnpj": ocr_result.get("establishment_cnpj"),
                "receipt_date": ocr_result.get("receipt_date"),
                "total_amount": ocr_result.get("total_amount"),
                "items": ocr_result.get("items"),
                "ocr_confidence": ocr_result.get("confidence", 0),
                "ocr_raw_response": ocr_result,
                "ocr_status": "processed" if not ocr_result.get("error") else "error",
                # Novos campos
                "document_type": document_type,
                "document_number": document_number,
                "access_key": ocr_result.get("access_key"),
                "payment_method": ocr_result.get("payment_method"),
                "payment_type": ocr_result.get("payment_type", "avista"),
                "installments": ocr_result.get("installments", 1) or 1
            }
            
            supabase.table("receipts").update(update_data).eq("id", receipt['id']).execute()
            
            # Criar payables automaticamente
            payables_created = []
            if not ocr_result.get("error") and ocr_result.get("total_amount"):
                payables_created = create_payables_from_receipt(receipt, ocr_result)
            
            return {
                "success": True,
                "receipt_id": receipt['id'],
                "image_url": image_url,
                "ocr_result": ocr_result,
                "payables_created": len(payables_created),
                "payables": payables_created
            }
            
        except Exception as ocr_error:
            # Atualizar status para erro
            supabase.table("receipts").update({
                "ocr_status": "error",
                "ocr_raw_response": {"error": str(ocr_error)}
            }).eq("id", receipt['id']).execute()
            
            return {
                "success": True,
                "receipt_id": receipt['id'],
                "image_url": image_url,
                "ocr_error": str(ocr_error),
                "payables_created": 0
            }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao processar cupom: {str(e)}")


@router.post("/{receipt_id}/validate")
async def validate_receipt(
    receipt_id: str,
    establishment_name: Optional[str] = None,
    total_amount: Optional[float] = None
) -> dict:
    """Valida/edita um cupom fiscal após revisão do usuário."""
    update_data = {
        "is_validated": True
    }
    
    if establishment_name:
        update_data["establishment_name"] = establishment_name
    if total_amount is not None:
        update_data["total_amount"] = total_amount
    
    supabase.table("receipts").update(update_data).eq("id", receipt_id).execute()
    
    return {"success": True}


@router.post("/{receipt_id}/convert-to-payable")
async def convert_to_payable(
    receipt_id: str,
    due_date: str = Query(...),
    account_category: Optional[str] = None
) -> dict:
    """Converte manualmente um cupom em conta a pagar (caso automático não tenha funcionado)."""
    # Buscar cupom
    receipt_result = supabase.table("receipts").select("*").eq("id", receipt_id).single().execute()
    receipt = receipt_result.data
    
    if not receipt:
        raise HTTPException(status_code=404, detail="Cupom não encontrado")
    
    # Verificar se já tem payable vinculado
    existing = supabase.table("payables").select("id").eq("receipt_id", receipt_id).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Cupom já possui conta a pagar vinculada")
    
    # Criar payable
    payable_data = {
        "company_id": receipt["company_id"],
        "receipt_id": receipt_id,
        "project_id": receipt.get("project_id"),
        "description": f"{receipt.get('document_type', 'CUPOM').upper()} {receipt.get('document_number', '')} - {receipt.get('establishment_name', 'Não identificado')}",
        "supplier_name": receipt.get("establishment_name", "Não identificado"),
        "supplier_cnpj": receipt.get("establishment_cnpj"),
        "due_date": due_date,
        "amount": receipt.get("total_amount", 0),
        "account_category": account_category,
        "status": "pending"
    }
    
    payable_result = supabase.table("payables").insert(payable_data).execute()
    payable = payable_result.data[0]
    
    return {
        "success": True,
        "payable": payable
    }


@router.delete("/{receipt_id}")
async def delete_receipt(receipt_id: str) -> dict:
    """Remove um cupom fiscal e suas contas a pagar vinculadas."""
    # Remover payables vinculados primeiro (opcional - pode querer manter)
    supabase.table("payables").update({"receipt_id": None}).eq("receipt_id", receipt_id).execute()
    
    # Remover cupom
    supabase.table("receipts").delete().eq("id", receipt_id).execute()
    return {"success": True}
