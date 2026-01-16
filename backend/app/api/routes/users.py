"""
Rotas de Gestão de Usuários da Empresa
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
import secrets
import httpx
from ...db.supabase_client import supabase
from ...core.auth import get_current_user, require_permission
from ...core.config import settings

router = APIRouter(prefix="/users", tags=["Users"])

# ====== Config ======
RESEND_API_KEY = settings.RESEND_API_KEY
EMAIL_FROM = "Optus Control <noreply@optusagentiasaas.shop>"
FRONTEND_URL = settings.FRONTEND_URL # Usar configuração global

# ====== Schemas ======

class UserInviteCreate(BaseModel):
    email: str
    name: str
    role: str = "operator"
    modules: List[str] = []

class UserUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None

class UserOnboardingComplete(BaseModel):
    password: str
    password_confirm: str

# ====== Helpers ======

async def send_user_invite_email(to_email: str, to_name: str, company_name: str, setup_link: str):
    """Envia email de convite para colaborador via Resend."""
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
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🏢 Optus Control</h1>
            </div>
            <div class="content">
                <h2>Olá, {to_name}!</h2>
                <p>Você foi convidado para colaborar na empresa <strong>{company_name}</strong> no Optus Control.</p>
                
                <p>Para ativar sua conta e definir sua senha de acesso, clique no botão abaixo:</p>
                
                <p style="text-align: center;">
                    <a href="{setup_link}" class="btn">Ativar Minha Conta</a>
                </p>
                
                <p style="font-size: 13px; color: #888;">
                    Este convite expira em 48 horas.
                </p>
            </div>
            <div class="footer">
                Optus Control - Gestão Financeira Inteligente
            </div>
        </div>
    </body>
    </html>
    """
    
    async with httpx.AsyncClient() as client:
        await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
            json={
                "from": EMAIL_FROM,
                "to": [to_email],
                "subject": f"Convite para colaborar em {company_name}",
                "html": html_content
            }
        )

# ====== Endpoints ======

@router.get("")
async def list_company_users(
    current_user: dict = Depends(require_permission("users", "read"))
) -> List[dict]:
    """Lista usuários e convites pendentes da empresa."""
    company_id = current_user["company_id"]
    
    # Buscar usuários ativos (da tabela user_roles join user_profiles)
    users_result = supabase.rpc(
        "get_company_users", 
        {"p_company_id": company_id}
    ).execute()
    
    # Se a RPC não estiver pronta, fazemos manual via query
    if not users_result.data:
        users_result = supabase.table("user_roles").select(
            "user_id, role, is_active, accepted_at"
        ).eq("company_id", company_id).execute()
        
        # Enriquecer com dados de perfil (numa aplicação real faria join)
        # Simplificando para o MVP
    
    # Buscar convites pendentes
    invites_result = supabase.table("user_invites").select("*").eq(
        "company_id", company_id
    ).is_("used_at", "null").execute()
    
    return {
        "active_users": users_result.data or [],
        "pending_invites": invites_result.data or []
    }

@router.post("/invite")
async def invite_user(
    invite: UserInviteCreate,
    current_user: dict = Depends(require_permission("users", "create"))
) -> dict:
    """Envia convite para novo colaborador."""
    company_id = current_user["company_id"]
    
    # Gerar token
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(hours=48)
    
    # Salvar convite
    invite_data = {
        "company_id": company_id,
        "email": invite.email.lower(),
        "name": invite.name,
        "role": invite.role,
        "modules": invite.modules,
        "token": token,
        "expires_at": expires_at.isoformat(),
        "created_by": current_user["user_id"]
    }
    
    try:
        supabase.table("user_invites").insert(invite_data).execute()
        
        # Buscar nome da empresa
        company = supabase.table("companies").select("name").eq("id", company_id).single().execute()
        
        # Enviar email
        setup_link = f"{FRONTEND_URL}/setup-user/{token}"
        await send_user_invite_email(invite.email, invite.name, company.data["name"], setup_link)
        
        return {"success": True, "message": "Convite enviado com sucesso"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao convidar: {str(e)}")

@router.get("/invite/{token}")
async def validate_user_invite(token: str) -> dict:
    """Valida token de convite de colaborador."""
    result = supabase.table("user_invites").select(
        "*, company:companies(name)"
    ).eq("token", token).single().execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Convite inválido ou expirado")
    
    invite = result.data
    if invite.get("used_at"):
        raise HTTPException(status_code=400, detail="Este convite já foi utilizado")
    
    # Verificar expiração
    expires_at = datetime.fromisoformat(invite["expires_at"].replace("Z", "+00:00"))
    if datetime.utcnow().replace(tzinfo=expires_at.tzinfo) > expires_at:
        raise HTTPException(status_code=400, detail="Este convite expirou")
    
    return {
        "valid": True,
        "email": invite["email"],
        "name": invite["name"],
        "company_name": invite.get("company", {}).get("name"),
        "role": invite["role"]
    }

@router.post("/invite/{token}/complete")
async def complete_user_onboarding(token: str, data: UserOnboardingComplete) -> dict:
    """Completa o convite do colaborador criando usuário no Supabase Auth."""
    # Validar token
    result = supabase.table("user_invites").eq("token", token).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Convite inválido")
    
    invite = result.data
    if invite.get("used_at"):
        raise HTTPException(status_code=400, detail="Este convite já foi utilizado")
    
    if data.password != data.password_confirm:
        raise HTTPException(status_code=400, detail="Senhas não conferem")
    
    # Criar usuário no Supabase Auth
    try:
        auth_result = supabase.auth.admin.create_user({
            "email": invite["email"],
            "password": data.password,
            "email_confirm": True,
            "user_metadata": {
                "full_name": invite["name"],
                "company_id": invite["company_id"],
                "role": invite["role"]
            }
        })
        user_id = auth_result.user.id
    except Exception as e:
        if "already registered" in str(e).lower():
            # Tentar apenas vincular se o usuário já existe no Auth
            # Para o MVP vamos assumir que o fluxo é simples
            raise HTTPException(status_code=400, detail="Este email já está cadastrado.")
        raise HTTPException(status_code=400, detail=f"Erro ao criar conta: {str(e)}")
    
    # Criar user_role
    try:
        supabase.table("user_roles").insert({
            "user_id": user_id,
            "company_id": invite["company_id"],
            "role": invite["role"],
            "modules": invite.get("modules", []),
            "is_active": True,
            "accepted_at": datetime.now().isoformat()
        }).execute()
        
        # Marcar convite como usado
        supabase.table("user_invites").update({
            "used_at": datetime.now().isoformat()
        }).eq("id", invite["id"]).execute()
        
        return {"success": True, "message": "Conta ativada com sucesso!"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao finalizar: {str(e)}")

