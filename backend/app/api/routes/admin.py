"""
Rotas de Admin/SaaS - Gestão de Empresas + Onboarding
"""
from fastapi import APIRouter, HTTPException, Query, Body
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
import secrets
import httpx
from ...db.supabase_client import supabase
from ...core.config import settings

router = APIRouter(prefix="/admin", tags=["Admin"])

# ====== Config ======
RESEND_API_KEY = settings.RESEND_API_KEY
EMAIL_FROM = "Optus Control <noreply@optusagentiasaas.shop>"
FRONTEND_URL = settings.FRONTEND_URL  # Usar configuração global

DEVELOPER_EMAILS = ["valmirmoreirajunior@gmail.com"]


# ====== Schemas ======

class CompanyWithAdmin(BaseModel):
    """Cria empresa com primeiro admin."""
    name: str
    cnpj: str
    fantasy_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    address_number: Optional[str] = None
    neighborhood: Optional[str] = None
    city: Optional[str] = None
    city_code: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    subscription_plan: str = "free"
    admin_email: str
    admin_name: str


class CompanyStatusUpdate(BaseModel):
    is_active: bool


class OnboardingComplete(BaseModel):
    password: str
    password_confirm: str


# ====== Helpers ======

def verify_developer(email: str) -> bool:
    return email.lower() in [e.lower() for e in DEVELOPER_EMAILS]


def generate_token() -> str:
    return secrets.token_urlsafe(32)


async def send_onboarding_email(to_email: str, to_name: str, company_name: str, setup_link: str):
    """Envia email de onboarding via Resend."""
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; padding: 20px; }}
            .container {{ max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; }}
            .header {{ background: linear-gradient(135deg, #4361EE, #7C3AED); padding: 30px; text-align: center; }}
            .header h1 {{ color: white; margin: 0; font-size: 28px; }}
            .content {{ padding: 30px; }}
            .content h2 {{ color: #1a1a2e; margin-top: 0; }}
            .content p {{ color: #4a4a4a; line-height: 1.6; }}
            .btn {{ display: inline-block; background: #4361EE; color: white; padding: 14px 28px; 
                   text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }}
            .footer {{ padding: 20px 30px; background: #f9f9f9; text-align: center; color: #888; font-size: 12px; }}
            .company-box {{ background: #f0f4ff; padding: 15px; border-radius: 8px; margin: 15px 0; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🏢 Optus Control</h1>
            </div>
            <div class="content">
                <h2>Olá, {to_name}!</h2>
                <p>Sua empresa foi cadastrada no <strong>Optus Control</strong> - Sistema de Gestão Financeira e Conformidade.</p>
                
                <div class="company-box">
                    <strong>Empresa:</strong> {company_name}
                </div>
                
                <p>Para acessar o sistema, você precisa completar seu cadastro criando sua senha de acesso.</p>
                
                <p style="text-align: center;">
                    <a href="{setup_link}" class="btn">Completar Cadastro</a>
                </p>
                
                <p style="font-size: 13px; color: #888;">
                    Este link expira em <strong>48 horas</strong>. Se você não solicitou este acesso, ignore este email.
                </p>
            </div>
            <div class="footer">
                Optus Control - Gestão Financeira Inteligente<br>
                Este é um email automático, não responda.
            </div>
        </div>
    </body>
    </html>
    """
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "from": EMAIL_FROM,
                "to": [to_email],
                "subject": f"Complete seu cadastro - {company_name}",
                "html": html_content
            }
        )
        # Log de depuração do Resend
        if response.status_code != 200:
            print(f"DEBUG: Falha no envio de email via Resend: {response.status_code} - {response.text}")
        else:
            print(f"DEBUG: Email de onboarding enviado com sucesso para {to_email}. Response: {response.text}")
            
        return response.status_code == 200, response.json() if response.status_code != 200 else None


# ====== Consulta CNPJ ======

@router.get("/cnpj/{cnpj}")
async def lookup_cnpj(cnpj: str) -> dict:
    """Consulta dados de CNPJ na ReceitaWS (API gratuita)."""
    # Limpar CNPJ
    cnpj_clean = ''.join(filter(str.isdigit, cnpj))
    
    if len(cnpj_clean) != 14:
        raise HTTPException(status_code=400, detail="CNPJ inválido")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(f"https://receitaws.com.br/v1/cnpj/{cnpj_clean}")
            
            if response.status_code == 429:
                raise HTTPException(status_code=429, detail="Limite de consultas atingido. Tente novamente em 1 minuto.")
            
            if response.status_code != 200:
                raise HTTPException(status_code=404, detail="CNPJ não encontrado")
            
            data = response.json()
            
            if data.get("status") == "ERROR":
                raise HTTPException(status_code=404, detail=data.get("message", "CNPJ não encontrado"))
            
            # Formatar resposta
            return {
                "cnpj": data.get("cnpj", ""),
                "name": data.get("nome", ""),
                "fantasy_name": data.get("fantasia", ""),
                "email": data.get("email", ""),
                "phone": data.get("telefone", ""),
                "address": data.get("logradouro", ""),
                "address_number": data.get("numero", ""),
                "neighborhood": data.get("bairro", ""),
                "city": data.get("municipio", ""),
                "city_code": data.get("codigo_municipio", ""),
                "state": data.get("uf", ""),
                "zip_code": data.get("cep", ""),
                "status": data.get("situacao", ""),
                "opening_date": data.get("abertura", ""),
                "legal_nature": data.get("natureza_juridica", ""),
                "capital": data.get("capital_social", ""),
                "main_activity": data.get("atividade_principal", [{}])[0].get("text", "") if data.get("atividade_principal") else ""
            }
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="Timeout na consulta. Tente novamente.")


# ====== Endpoints de Admin ======

@router.get("/verify")
async def verify_admin_access(email: str = Query(...)) -> dict:
    is_dev = verify_developer(email)
    return {"is_developer": is_dev, "email": email, "access_level": "developer" if is_dev else "user"}


@router.get("/companies")
async def list_all_companies(
    developer_email: str = Query(...),
    include_inactive: bool = False
) -> List[dict]:
    if not verify_developer(developer_email):
        raise HTTPException(status_code=403, detail="Acesso negado. Apenas developers.")
    
    query = supabase.table("companies").select("*")
    if not include_inactive:
        query = query.eq("is_active", True)
    
    result = query.order("created_at", desc=True).execute()
    
    # Contar usuários e tokens
    companies = []
    for c in (result.data or []):
        users = supabase.table("user_roles").select("id").eq("company_id", c["id"]).execute()
        tokens = supabase.table("company_onboarding_tokens").select("id, used_at").eq("company_id", c["id"]).execute()
        
        pending_token = next((t for t in (tokens.data or []) if not t.get("used_at")), None)
        
        companies.append({
            **c,
            "users_count": len(users.data or []),
            "has_pending_invite": pending_token is not None
        })
    
    return companies


@router.get("/companies/{company_id}")
async def get_company_details(company_id: str, developer_email: str = Query(...)) -> dict:
    if not verify_developer(developer_email):
        raise HTTPException(status_code=403, detail="Acesso negado. Apenas developers.")
    
    company = supabase.table("companies").select("*").eq("id", company_id).single().execute()
    if not company.data:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    
    users = supabase.table("user_roles").select("*").eq("company_id", company_id).execute()
    tokens = supabase.table("company_onboarding_tokens").select("*").eq("company_id", company_id).order("created_at", desc=True).execute()
    
    return {**company.data, "users": users.data or [], "onboarding_tokens": tokens.data or []}


@router.post("/companies")
async def create_company_with_admin(
    data: CompanyWithAdmin,
    developer_email: str = Query(...),
    send_email: bool = Query(default=True)
) -> dict:
    """Cria empresa, gera token de onboarding e envia email."""
    if not verify_developer(developer_email):
        raise HTTPException(status_code=403, detail="Acesso negado. Apenas developers.")
    
    # 1. Criar empresa
    company_data = {
        "name": data.name,
        "cnpj": data.cnpj,
        "fantasy_name": data.fantasy_name,
        "email": data.email,
        "phone": data.phone,
        "address": data.address,
        "address_number": data.address_number,
        "neighborhood": data.neighborhood,
        "city": data.city,
        "city_code": data.city_code,
        "state": data.state,
        "zip_code": data.zip_code,
        "subscription_plan": data.subscription_plan,
        "subscription_status": "pending",
        "is_active": True
    }
    
    try:
        company_result = supabase.table("companies").insert(company_data).execute()
        company = company_result.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao criar empresa: {str(e)}")
    
    # 2. Gerar token de onboarding
    token = generate_token()
    expires_at = datetime.now() + timedelta(hours=48)
    
    token_data = {
        "company_id": company["id"],
        "token": token,
        "admin_email": data.admin_email,
        "admin_name": data.admin_name,
        "expires_at": expires_at.isoformat()
    }
    
    try:
        supabase.table("company_onboarding_tokens").insert(token_data).execute()
    except Exception as e:
        # Rollback: deletar empresa
        supabase.table("companies").delete().eq("id", company["id"]).execute()
        raise HTTPException(status_code=400, detail=f"Erro ao gerar token: {str(e)}")
    
    # 3. Enviar email
    setup_link = f"{FRONTEND_URL}/setup/{token}"
    email_sent = False
    email_error = None
    
    if send_email:
        success, error = await send_onboarding_email(
            to_email=data.admin_email,
            to_name=data.admin_name,
            company_name=data.name,
            setup_link=setup_link
        )
        email_sent = success
        email_error = error
    
    return {
        "success": True,
        "company": company,
        "token": token,
        "setup_link": setup_link,
        "admin_email": data.admin_email,
        "email_sent": email_sent,
        "email_error": email_error,
        "expires_at": expires_at.isoformat()
    }


@router.post("/companies/{company_id}/resend-invite")
async def resend_onboarding_invite(company_id: str, developer_email: str = Query(...)) -> dict:
    """Reenvia convite de onboarding."""
    if not verify_developer(developer_email):
        raise HTTPException(status_code=403, detail="Acesso negado.")
    
    # Buscar token existente
    token_result = supabase.table("company_onboarding_tokens").select("*").eq(
        "company_id", company_id
    ).is_("used_at", "null").order("created_at", desc=True).limit(1).execute()
    
    if not token_result.data:
        raise HTTPException(status_code=404, detail="Nenhum convite pendente encontrado")
    
    token_data = token_result.data[0]
    company = supabase.table("companies").select("name").eq("id", company_id).single().execute()
    
    setup_link = f"{FRONTEND_URL}/setup/{token_data['token']}"
    success, error = await send_onboarding_email(
        to_email=token_data["admin_email"],
        to_name=token_data["admin_name"],
        company_name=company.data["name"],
        setup_link=setup_link
    )
    
    return {"success": success, "email_error": error}


# ====== Onboarding (público) ======

@router.get("/onboarding/{token}")
async def validate_onboarding_token(token: str) -> dict:
    """Valida token de onboarding e retorna dados da empresa (público)."""
    result = supabase.table("company_onboarding_tokens").select(
        "*, company:companies(*)"
    ).eq("token", token).single().execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Convite não encontrado ou inválido")
    
    token_data = result.data
    
    # Verificar se já foi usado
    if token_data.get("used_at"):
        raise HTTPException(status_code=400, detail="Este convite já foi utilizado")
    
    # Verificar expiração
    expires_at = datetime.fromisoformat(token_data["expires_at"].replace("Z", "+00:00"))
    if datetime.now(expires_at.tzinfo) > expires_at:
        raise HTTPException(status_code=400, detail="Este convite expirou")
    
    company = token_data.get("company", {})
    
    return {
        "valid": True,
        "admin_email": token_data["admin_email"],
        "admin_name": token_data["admin_name"],
        "company": {
            "id": company.get("id"),
            "name": company.get("name"),
            "fantasy_name": company.get("fantasy_name"),
            "cnpj": company.get("cnpj"),
            "city": company.get("city"),
            "state": company.get("state")
        },
        "expires_at": token_data["expires_at"]
    }


@router.post("/onboarding/{token}/complete")
async def complete_onboarding(token: str, data: OnboardingComplete) -> dict:
    """Completa o onboarding criando usuário no Supabase Auth."""
    # Validar token
    result = supabase.table("company_onboarding_tokens").select(
        "*, company:companies(*)"
    ).eq("token", token).single().execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Convite não encontrado")
    
    token_data = result.data
    
    if token_data.get("used_at"):
        raise HTTPException(status_code=400, detail="Este convite já foi utilizado")
    
    expires_at = datetime.fromisoformat(token_data["expires_at"].replace("Z", "+00:00"))
    if datetime.now(expires_at.tzinfo) > expires_at:
        raise HTTPException(status_code=400, detail="Este convite expirou")
    
    # Validar senhas
    if data.password != data.password_confirm:
        raise HTTPException(status_code=400, detail="As senhas não conferem")
    
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="A senha deve ter no mínimo 6 caracteres")
    
    company = token_data.get("company", {})
    admin_email = token_data["admin_email"]
    admin_name = token_data["admin_name"]
    company_id = token_data["company_id"]
    
    # Criar usuário no Supabase Auth (já confirmado)
    try:
        auth_result = supabase.auth.admin.create_user({
            "email": admin_email,
            "password": data.password,
            "email_confirm": True,  # IMPORTANTE: Usuário já vem confirmado!
            "user_metadata": {
                "full_name": admin_name,
                "company_id": company_id,
                "role": "owner"
            }
        })
        
        user_id = auth_result.user.id
    except Exception as e:
        error_msg = str(e)
        if "already registered" in error_msg.lower():
            raise HTTPException(status_code=400, detail="Este email já está cadastrado. Faça login.")
        raise HTTPException(status_code=400, detail=f"Erro ao criar usuário: {error_msg}")
    
    # Criar user_role
    try:
        supabase.table("user_roles").insert({
            "user_id": user_id,
            "company_id": company_id,
            "role": "owner",
            "is_active": True,
            "accepted_at": datetime.now().isoformat()
        }).execute()
    except Exception as e:
        pass  # Ignorar se falhar (pode já existir)
    
    # Marcar token como usado
    supabase.table("company_onboarding_tokens").update({
        "used_at": datetime.now().isoformat()
    }).eq("id", token_data["id"]).execute()
    
    # Atualizar status da empresa
    supabase.table("companies").update({
        "subscription_status": "trial",
        "trial_ends_at": (datetime.now() + timedelta(days=30)).isoformat()
    }).eq("id", company_id).execute()
    
    return {
        "success": True,
        "message": "Cadastro concluído com sucesso! Você já pode fazer login.",
        "email": admin_email,
        "company_name": company.get("name")
    }


# ====== Status/Stats ======

@router.put("/companies/{company_id}/status")
async def update_company_status(company_id: str, status: CompanyStatusUpdate, developer_email: str = Query(...)) -> dict:
    if not verify_developer(developer_email):
        raise HTTPException(status_code=403, detail="Acesso negado.")
    
    supabase.table("companies").update({
        "is_active": status.is_active,
        "updated_at": datetime.now().isoformat()
    }).eq("id", company_id).execute()
    
    return {"success": True, "is_active": status.is_active}


@router.put("/companies/{company_id}")
async def update_company_admin(
    company_id: str, 
    data: dict = Body(...), 
    developer_email: str = Query(...)
) -> dict:
    """Edição completa de dados da empresa via Admin."""
    if not verify_developer(developer_email):
        raise HTTPException(status_code=403, detail="Acesso negado.")
    
    # Remover campos protegidos/automáticos/virtuais
    protected = ["id", "created_at", "updated_at", "subscription_status", "subscription_plan", "has_pending_invite", "users_count", "onboarding_tokens", "users"]
    update_data = {k: v for k, v in data.items() if k not in protected and v is not None}
    update_data["updated_at"] = datetime.now().isoformat()
    
    result = supabase.table("companies").update(update_data).eq("id", company_id).execute()
    return result.data[0] if result.data else {"success": True}


@router.delete("/companies/{company_id}")
async def hard_delete_company(company_id: str, developer_email: str = Query(...)) -> dict:
    """Exclusão real e definitiva da empresa e dependências."""
    if not verify_developer(developer_email):
        raise HTTPException(status_code=403, detail="Acesso negado.")
    
    # Deletar em ordem para respeitar FKs (dependendo das roles as FKs podem estar configuradas com CASCADE, mas por segurança fazemos manual ou garantimos)
    # 1. Tokens de onboarding
    supabase.table("company_onboarding_tokens").delete().eq("company_id", company_id).execute()
    # 2. Roles de usuários
    supabase.table("user_roles").delete().eq("company_id", company_id).execute()
    # 3. Empresa
    supabase.table("companies").delete().eq("id", company_id).execute()
    
    return {"success": True, "message": "Empresa e todos os dados relacionados foram excluídos definitivamente."}


@router.get("/stats")
async def get_platform_stats(developer_email: str = Query(...)) -> dict:
    if not verify_developer(developer_email):
        raise HTTPException(status_code=403, detail="Acesso negado.")
    
    companies = supabase.table("companies").select("id, is_active, subscription_plan, subscription_status").execute()
    users = supabase.table("user_roles").select("id, is_active").execute()
    invoices = supabase.table("invoices").select("id").execute()
    receipts = supabase.table("receipts").select("id").execute()
    pending_tokens = supabase.table("company_onboarding_tokens").select("id").is_("used_at", "null").execute()
    
    active_companies = [c for c in (companies.data or []) if c.get("is_active")]
    
    plans = {}
    for c in (companies.data or []):
        plan = c.get("subscription_plan", "free")
        plans[plan] = plans.get(plan, 0) + 1
    
    return {
        "companies": {
            "total": len(companies.data or []),
            "active": len(active_companies),
            "pending_onboarding": len(pending_tokens.data or []),
            "by_plan": plans
        },
        "users": {
            "total": len(users.data or []),
            "active": len([u for u in (users.data or []) if u.get("is_active")])
        },
        "documents": {
            "invoices": len(invoices.data or []),
            "receipts": len(receipts.data or [])
        }
    }
