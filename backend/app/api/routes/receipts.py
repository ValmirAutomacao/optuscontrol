"""
Rotas de Cupons Fiscais (OCR)
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from typing import List, Optional
from ...db.supabase_client import supabase
from ...core.ocr_service import process_receipt_image
from ...core.auth import get_current_user
from ...schemas.models import ReceiptCreate, ReceiptResponse
from fastapi import Depends

router = APIRouter(prefix="/receipts", tags=["Receipts"])


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
    Faz upload de uma imagem de cupom fiscal e processa via OCR.
    """
    # Blindagem Multi-tenant
    if not current_user.get("is_developer") and current_user.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Acesso negado para realizar upload nesta empresa.")
    # Verificar tipo do arquivo
    allowed_types = ['image/jpeg', 'image/png', 'image/webp']
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Tipo de arquivo não suportado. Use JPEG, PNG ou WebP.")
    
    try:
        # Ler imagem
        image_bytes = await file.read()
        
        # Gerar nome único para evitar duplicatas
        import uuid
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
        unique_filename = f"{timestamp}_{uuid.uuid4().hex[:8]}.{file_ext}"
        
        # Upload para Supabase Storage
        file_path = f"{company_id}/{unique_filename}"
        storage_result = supabase.storage.from_("receipts").upload(
            file_path,
            image_bytes,
            {"content-type": file.content_type, "upsert": "true"}
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
        
        # Processar OCR em background (simplificado - síncrono por enquanto)
        try:
            ocr_result = await process_receipt_image(image_bytes)
            
            # Atualizar com dados do OCR
            update_data = {
                "establishment_name": ocr_result.get("establishment_name"),
                "establishment_cnpj": ocr_result.get("establishment_cnpj"),
                "receipt_date": ocr_result.get("receipt_date"),
                "total_amount": ocr_result.get("total_amount"),
                "items": ocr_result.get("items"),
                "ocr_confidence": ocr_result.get("confidence", 0),
                "ocr_raw_response": ocr_result,
                "ocr_status": "processed" if not ocr_result.get("error") else "error"
            }
            
            supabase.table("receipts").update(update_data).eq("id", receipt['id']).execute()
            
            return {
                "success": True,
                "receipt_id": receipt['id'],
                "image_url": image_url,
                "ocr_result": ocr_result
            }
            
        except Exception as ocr_error:
            # Atualizar status para erro
            supabase.table("receipts").update({
                "ocr_status": "error"
            }).eq("id", receipt['id']).execute()
            
            return {
                "success": True,
                "receipt_id": receipt['id'],
                "image_url": image_url,
                "ocr_error": str(ocr_error)
            }
        
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
    """Converte um cupom validado em uma conta a pagar."""
    # Buscar cupom
    receipt = supabase.table("receipts").select("*").eq("id", receipt_id).single().execute().data
    
    if not receipt.get("is_validated"):
        raise HTTPException(status_code=400, detail="Cupom precisa ser validado antes de converter")
    
    if receipt.get("payable_id"):
        raise HTTPException(status_code=400, detail="Cupom já convertido em conta a pagar")
    
    # Criar payable
    payable_data = {
        "company_id": receipt["company_id"],
        "project_id": receipt.get("project_id"),
        "description": f"Cupom - {receipt.get('establishment_name', 'Não identificado')}",
        "supplier_name": receipt.get("establishment_name", "Não identificado"),
        "supplier_cnpj": receipt.get("establishment_cnpj"),
        "due_date": due_date,
        "amount": receipt.get("total_amount", 0),
        "account_category": account_category,
        "status": "pending"
    }
    
    payable_result = supabase.table("payables").insert(payable_data).execute()
    payable = payable_result.data[0]
    
    # Vincular ao cupom
    supabase.table("receipts").update({"payable_id": payable['id']}).eq("id", receipt_id).execute()
    
    return {
        "success": True,
        "payable": payable
    }


@router.delete("/{receipt_id}")
async def delete_receipt(receipt_id: str) -> dict:
    """Remove um cupom fiscal."""
    supabase.table("receipts").delete().eq("id", receipt_id).execute()
    return {"success": True}
