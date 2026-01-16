import { type ReactNode } from 'react'
import { usePermissions } from '../hooks/usePermissions'

interface PermissionGateProps {
    children: ReactNode
    module: string
    action: 'create' | 'read' | 'update' | 'delete' | 'export'
    fallback?: ReactNode
}

/**
 * Componente para esconder/mostrar elementos baseado em permissões.
 * 
 * Uso:
 * <PermissionGate module="invoices" action="delete">
 *   <button>Excluir</button>
 * </PermissionGate>
 */
export function PermissionGate({ children, module, action, fallback = null }: PermissionGateProps) {
    const { can, loading } = usePermissions()

    if (loading) return null

    if (!can(module, action)) {
        return <>{fallback}</>
    }

    return <>{children}</>
}

interface RequireRoleProps {
    children: ReactNode
    roles: string[]
    fallback?: ReactNode
}

/**
 * Componente para esconder/mostrar elementos baseado em role.
 * 
 * Uso:
 * <RequireRole roles={['owner', 'admin']}>
 *   <button>Gerenciar Usuários</button>
 * </RequireRole>
 */
export function RequireRole({ children, roles, fallback = null }: RequireRoleProps) {
    const { role, isDeveloper, loading } = usePermissions()

    if (loading) return null

    // Developers sempre têm acesso
    if (isDeveloper) return <>{children}</>

    // Verificar se role do usuário está na lista permitida
    if (!role || !roles.includes(role)) {
        return <>{fallback}</>
    }

    return <>{children}</>
}

interface CompanySelectorProps {
    onChange?: (companyId: string) => void
    className?: string
}

/**
 * Componente seletor de empresa para contadores/multi-empresa.
 */
export function CompanySelector({ onChange, className }: CompanySelectorProps) {
    const { companies, activeCompanyId, switchCompany, isDeveloper } = usePermissions()

    // Se usuário só tem uma empresa e não é developer, não mostra seletor
    if (companies.length <= 1 && !isDeveloper) return null

    async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
        const newCompanyId = e.target.value
        const success = await switchCompany(newCompanyId)
        if (success && onChange) {
            onChange(newCompanyId)
        }
    }

    return (
        <select
            value={activeCompanyId || ''}
            onChange={handleChange}
            className={`company-selector-select ${className || ''}`}
        >
            {companies.map(c => (
                <option key={c.company_id} value={c.company_id}>
                    {c.fantasy_name || c.name || c.company_id.slice(0, 8)}
                </option>
            ))}
        </select>
    )
}
