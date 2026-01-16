import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { useAuth } from './useAuth'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

interface Permission {
    create: boolean
    read: boolean
    update: boolean
    delete: boolean
    export: boolean
}

interface Permissions {
    [module: string]: Permission
}

interface Company {
    company_id: string
    role: string
    name?: string
    fantasy_name?: string
}

interface PermissionsContextType {
    role: string | null
    permissions: Permissions
    companies: Company[]
    activeCompanyId: string | null
    isDeveloper: boolean
    loading: boolean
    user: User | null
    session: Session | null
    can: (module: string, action: 'create' | 'read' | 'update' | 'delete' | 'export') => boolean
    switchCompany: (companyId: string) => Promise<boolean>
    refreshPermissions: () => Promise<void>
}

const PermissionsContext = createContext<PermissionsContextType | null>(null)

export function PermissionsProvider({ children }: { children: ReactNode }) {
    const { user, session } = useAuth()
    const [role, setRole] = useState<string | null>(null)
    const [permissions, setPermissions] = useState<Permissions>({})
    const [companies, setCompanies] = useState<Company[]>([])
    const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null)
    const [isDevRaw, setIsDeveloper] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (user && session?.access_token) {
            loadPermissions()
        } else {
            setLoading(false)
        }
    }, [user, session])

    async function loadPermissions() {
        if (!session?.access_token) return

        try {
            // Get user info including companies
            const meRes = await fetch(`${API_URL}/auth/me`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            })

            if (meRes.ok) {
                const meData = await meRes.json()
                setCompanies(meData.companies || [])
                setActiveCompanyId(meData.company_id)

                // Reforço: desenvolvedor é definido pelo email ou pela flag da API
                const isDev = meData.is_developer || user?.email === 'valmirmoreirajunior@gmail.com'
                setIsDeveloper(isDev)
                setRole(meData.role)

                // Get permissions for active company
                if (meData.company_id) {
                    const permsRes = await fetch(`${API_URL}/auth/permissions?company_id=${meData.company_id}`, {
                        headers: { 'Authorization': `Bearer ${session.access_token}` }
                    })

                    if (permsRes.ok) {
                        const permsData = await permsRes.json()
                        setPermissions(permsData.permissions || {})
                        if (permsData.is_developer || isDev) {
                            setIsDeveloper(true)
                        }
                    }
                }
            }
        } catch (e) {
            console.error('Error loading permissions:', e)
        } finally {
            setLoading(false)
        }
    }

    async function switchCompany(companyId: string): Promise<boolean> {
        if (!session?.access_token) return false

        try {
            const res = await fetch(`${API_URL}/auth/switch-company/${companyId}`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            })

            if (res.ok) {
                setActiveCompanyId(companyId)

                // Reload permissions for new company
                const permsRes = await fetch(`${API_URL}/auth/permissions?company_id=${companyId}`, {
                    headers: { 'Authorization': `Bearer ${session.access_token}` }
                })

                if (permsRes.ok) {
                    const permsData = await permsRes.json()
                    setPermissions(permsData.permissions || {})
                    setRole(permsData.role)
                }

                return true
            }
        } catch (e) {
            console.error('Error switching company:', e)
        }
        return false
    }

    function can(module: string, action: 'create' | 'read' | 'update' | 'delete' | 'export'): boolean {
        if (isDeveloper) return true

        const modulePerm = permissions[module]
        if (!modulePerm) return false

        return modulePerm[action] || false
    }

    async function refreshPermissions() {
        await loadPermissions()
    }

    const isDeveloper = isDevRaw || user?.email === 'valmirmoreirajunior@gmail.com'

    return (
        <PermissionsContext.Provider value={{
            role,
            permissions,
            companies,
            activeCompanyId,
            isDeveloper,
            loading,
            user,
            session,
            can,
            switchCompany,
            refreshPermissions
        }}>
            {children}
        </PermissionsContext.Provider>
    )
}

export function usePermissions() {
    const context = useContext(PermissionsContext)
    if (!context) {
        throw new Error('usePermissions must be used within PermissionsProvider')
    }
    return context
}
