"""
Middleware e Dependencies de Autorização
Sistema de permissões baseado em roles e company_id
"""
from fastapi import Depends, HTTPException, Header
from typing import Optional, List
from ..db.supabase_client import supabase

# Cache simples de permissões (em produção usar Redis)
_permissions_cache: dict = {}


async def get_current_user(authorization: str = Header(...)) -> dict:
    """
    Valida o token JWT do Supabase e retorna dados do usuário.
    Extrai: user_id, email, nome, empresa principal, role e lista de empresas.
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Token de autorização não fornecido")

    # Extrair token do header "Bearer <token>"
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Formato de autorização inválido")
    except ValueError:
        raise HTTPException(status_code=401, detail="Formato de autorização inválido")

    try:
        # Validar token com Supabase
        user_response = supabase.auth.get_user(token)

        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Token inválido ou expirado")

        user = user_response.user
        user_id = user.id
        email = user.email

        # Extrair nome dos metadados do usuário
        user_metadata = getattr(user, "user_metadata", {}) or {}
        full_name = user_metadata.get("full_name") or user_metadata.get("name") or "Usuário"

        # Buscar roles do usuário com join em companies
        companies = []
        primary_company = None
        primary_role = None

        try:
            roles_result = supabase.table("user_roles").select(
                "company_id, role, is_active, companies(name, fantasy_name)"
            ).eq("user_id", user_id).eq("is_active", True).execute()

            for role_data in (roles_result.data or []):
                # PROTEÇÃO: comp_info pode vir None se o join falhar
                unprocessed_comp = role_data.get("companies")
                comp_info = unprocessed_comp if isinstance(unprocessed_comp, dict) else {}

                companies.append({
                    "company_id": role_data["company_id"],
                    "role": role_data["role"],
                    "name": comp_info.get("name") if comp_info else None,
                    "fantasy_name": comp_info.get("fantasy_name") if comp_info else None
                })

                if primary_company is None:
                    primary_company = role_data["company_id"]
                    primary_role = role_data["role"]
        except Exception as query_err:
            print(f"Erro ao buscar roles/empresas: {str(query_err)}")

        return {
            "user_id": user_id,
            "email": email,
            "name": full_name,
            "company_id": primary_company,
            "role": primary_role,
            "companies": companies,
            "is_developer": email.lower() in ["valmirmoreirajunior@gmail.com"]
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Erro ao validar token: {str(e)}")


async def get_user_permissions(user_id: str, company_id: str) -> dict:
    """
    Retorna as permissões do usuário para uma empresa específica.
    Usa cache para melhor performance.
    """
    cache_key = f"{user_id}:{company_id}"

    if cache_key in _permissions_cache:
        return _permissions_cache[cache_key]

    # Buscar role e módulos específicos do usuário na empresa
    role_result = supabase.table("user_roles").select("role, modules").eq(
        "user_id", user_id
    ).eq("company_id", company_id).eq("is_active", True).single().execute()

    if not role_result.data:
        return {"role": None, "permissions": {}}

    role = role_result.data["role"]
    custom_modules = role_result.data.get("modules") or []  # Tratar None como []

    # FALLBACK: Owners e Admins SEMPRE têm acesso total, independente de role_permissions
    if role in ["owner", "admin"]:
        full_permissions = {
            "dashboard": {"create": True, "read": True, "update": True, "delete": True, "export": True},
            "companies": {"create": True, "read": True, "update": True, "delete": True, "export": True},
            "users": {"create": True, "read": True, "update": True, "delete": True, "export": True},
            "invoices": {"create": True, "read": True, "update": True, "delete": True, "export": True},
            "receipts": {"create": True, "read": True, "update": True, "delete": True, "export": True},
            "payables": {"create": True, "read": True, "update": True, "delete": True, "export": True},
            "projects": {"create": True, "read": True, "update": True, "delete": True, "export": True},
            "export": {"create": True, "read": True, "update": True, "delete": True, "export": True},
        }
        result = {"role": role, "permissions": full_permissions}
        _permissions_cache[cache_key] = result
        return result

    # Para outros roles, buscar permissões da tabela role_permissions
    perms_result = supabase.table("role_permissions").select("*").eq("role", role).execute()

    permissions = {}
    for perm in (perms_result.data or []):
        module_name = perm["module"]

        # Se houver custom_modules definido E não estiver vazio, filtrar por eles
        if custom_modules and len(custom_modules) > 0 and module_name not in custom_modules:
            continue

        permissions[module_name] = {
            "create": perm.get("can_create", False),
            "read": perm.get("can_read", False),
            "update": perm.get("can_update", False),
            "delete": perm.get("can_delete", False),
            "export": perm.get("can_export", False)
        }

    result = {"role": role, "permissions": permissions}
    _permissions_cache[cache_key] = result

    return result


def require_permission(module: str, action: str):
    """
    Dependency factory para verificar permissões.
    Uso: @router.get("/", dependencies=[Depends(require_permission("invoices", "read"))])
    """
    async def check_permission(
        current_user: dict = Depends(get_current_user),
        company_id: Optional[str] = None
    ):
        # Developers têm acesso total
        if current_user.get("is_developer"):
            return current_user

        # Usar company_id do usuário se não especificado
        target_company = company_id or current_user.get("company_id")

        if not target_company:
            raise HTTPException(status_code=403, detail="Empresa não identificada")

        # Verificar se usuário pertence à empresa
        user_companies = [c["company_id"] for c in current_user.get("companies", [])]
        if target_company not in user_companies:
            raise HTTPException(status_code=403, detail="Você não tem acesso a esta empresa")

        # Buscar permissões
        perms = await get_user_permissions(current_user["user_id"], target_company)

        module_perms = perms.get("permissions", {}).get(module, {})

        if not module_perms.get(action, False):
            raise HTTPException(
                status_code=403,
                detail=f"Você não tem permissão para {action} em {module}"
            )

        current_user["active_company_id"] = target_company
        return current_user

    return check_permission


def require_company_access():
    """
    Dependency para garantir que usuário só acesse dados da própria empresa.
    IMPORTANTE para isolamento multi-tenant.
    """
    async def check_company_access(
        current_user: dict = Depends(get_current_user),
        company_id: Optional[str] = None
    ):
        # Developers podem acessar qualquer empresa
        if current_user.get("is_developer"):
            current_user["active_company_id"] = company_id or current_user.get("company_id")
            return current_user

        target_company = company_id or current_user.get("company_id")

        if not target_company:
            raise HTTPException(status_code=400, detail="company_id é obrigatório")

        # Verificar se usuário pertence à empresa
        user_companies = [c["company_id"] for c in current_user.get("companies", [])]
        if target_company not in user_companies:
            raise HTTPException(status_code=403, detail="Acesso negado a esta empresa")

        current_user["active_company_id"] = target_company
        return current_user

    return check_company_access


def clear_permissions_cache(user_id: str = None, company_id: str = None):
    """Limpa cache de permissões."""
    global _permissions_cache

    if user_id and company_id:
        cache_key = f"{user_id}:{company_id}"
        _permissions_cache.pop(cache_key, None)
    elif user_id:
        _permissions_cache = {k: v for k, v in _permissions_cache.items() if not k.startswith(user_id)}
    else:
        _permissions_cache = {}
