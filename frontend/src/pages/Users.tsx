import { useState, useEffect } from 'react'
import { UserPlus, Mail, Shield, X, Loader } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { usePermissions } from '../hooks/usePermissions'
import './Users.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

interface ActiveUser {
    user_id: string
    full_name?: string
    email?: string
    role: string
    is_active: boolean
    accepted_at: string
}

interface PendingInvite {
    id: string
    email: string
    name: string
    role: string
    created_at: string
    expires_at: string
}

export function Users() {
    const { session } = useAuth()
    const { activeCompanyId } = usePermissions()
    const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([])
    const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
    const [loading, setLoading] = useState(true)
    const [showInviteModal, setShowInviteModal] = useState(false)
    const [inviteData, setInviteData] = useState({
        email: '',
        name: '',
        role: 'operator',
        modules: [] as string[]
    })
    const [inviteLoading, setInviteLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    const availableModules = [
        { id: 'dashboard', label: 'Dashboard / Métricas' },
        { id: 'invoices', label: 'Notas Fiscais' },
        { id: 'receipts', label: 'Despesas e Recibos' },
        { id: 'projects', label: 'Projetos e Obras' },
        { id: 'payables', label: 'Contas a Pagar' },
        { id: 'users', label: 'Gestão de Acessos' }
    ]

    useEffect(() => {
        if (activeCompanyId) {
            loadUsers()
        }
    }, [activeCompanyId])

    async function loadUsers() {
        if (!session?.access_token || !activeCompanyId) return
        try {
            const res = await fetch(`${API_URL}/users`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            })
            if (res.ok) {
                const data = await res.json()
                setActiveUsers(data.active_users || [])
                setPendingInvites(data.pending_invites || [])
            }
        } catch (e) {
            console.error('Erro ao carregar usuários:', e)
        } finally {
            setLoading(false)
        }
    }

    async function handleInvite(e: React.FormEvent) {
        e.preventDefault()
        if (!session?.access_token || !activeCompanyId) return

        setInviteLoading(true)
        setMessage(null)

        try {
            const res = await fetch(`${API_URL}/users/invite`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(inviteData)
            })

            if (res.ok) {
                setMessage({ type: 'success', text: 'Convite enviado com sucesso!' })
                setInviteData({ email: '', name: '', role: 'operator', modules: [] })
                setShowInviteModal(false)
                loadUsers()
            } else {
                const err = await res.json()
                setMessage({ type: 'error', text: err.detail || 'Erro ao enviar convite' })
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Erro de conexão' })
        } finally {
            setInviteLoading(false)
        }
    }

    const roleLabels: Record<string, string> = {
        owner: 'Proprietário',
        admin: 'Administrador',
        manager: 'Gestor',
        accountant: 'Contador',
        operator: 'Operador'
    }

    if (loading) return <div className="page-container"><p>Carregando usuários...</p></div>

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Gestão de Acessos</h1>
                    <p className="page-subtitle">Controle quem tem acesso à sua empresa e quais suas permissões</p>
                </div>
                <button className="btn-primary" onClick={() => setShowInviteModal(true)}>
                    <UserPlus size={18} /> Convidar Colaborador
                </button>
            </div>

            {message && (
                <div className={`message message--${message.type}`}>
                    {message.text}
                    <button onClick={() => setMessage(null)}><X size={16} /></button>
                </div>
            )}

            {/* Active Users Section */}
            <div className="members-section">
                <h2 className="section-title">Usuários Ativos</h2>
                <div className="users-list">
                    {activeUsers.length === 0 ? (
                        <p className="empty-list">Nenhum usuário ativo além de você.</p>
                    ) : (
                        activeUsers.map(user => (
                            <div key={user.user_id} className="user-card">
                                <div className="user-info">
                                    <div className="user-avatar">
                                        {user.full_name?.[0] || user.email?.[0] || '?'}
                                    </div>
                                    <div>
                                        <h3>{user.full_name || 'Usuário'}</h3>
                                        <span>{user.email || 'Email não disponível'}</span>
                                    </div>
                                </div>
                                <div className="user-role-badge">
                                    <Shield size={14} />
                                    <span>{roleLabels[user.role] || user.role}</span>
                                </div>
                                <div className="user-status">
                                    <span className="status-dot active"></span>
                                    Ativo
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Pending Invites Section */}
            {pendingInvites.length > 0 && (
                <div className="members-section" style={{ marginTop: '2rem' }}>
                    <h2 className="section-title">Convites Pendentes</h2>
                    <div className="users-list">
                        {pendingInvites.map(invite => (
                            <div key={invite.id} className="user-card pending">
                                <div className="user-info">
                                    <div className="user-avatar pending">
                                        <Mail size={20} />
                                    </div>
                                    <div>
                                        <h3>{invite.name}</h3>
                                        <span>{invite.email}</span>
                                    </div>
                                </div>
                                <div className="user-role-badge">
                                    <span>{roleLabels[invite.role] || invite.role}</span>
                                </div>
                                <div className="user-status pending">
                                    Aguardando ativação
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="modal-overlay" onClick={() => setShowInviteModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Convidar Colaborador</h2>
                            <button className="modal-close" onClick={() => setShowInviteModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleInvite} className="modal-body">
                            <div className="form-group">
                                <label>Nome Completo *</label>
                                <input
                                    required
                                    value={inviteData.name}
                                    onChange={e => setInviteData({ ...inviteData, name: e.target.value })}
                                    placeholder="Ex: João Silva"
                                />
                            </div>
                            <div className="form-group">
                                <label>Email de Acesso *</label>
                                <input
                                    required
                                    type="email"
                                    value={inviteData.email}
                                    onChange={e => setInviteData({ ...inviteData, email: e.target.value })}
                                    placeholder="joao@empresa.com"
                                />
                            </div>
                            <div className="form-group">
                                <label>Função / Nível de Acesso</label>
                                <select
                                    value={inviteData.role}
                                    onChange={e => setInviteData({ ...inviteData, role: e.target.value })}
                                >
                                    <option value="manager">Gestor (Acesso Total)</option>
                                    <option value="accountant">Contador (Fiscal/Financeiro)</option>
                                    <option value="operator">Comprador (Despesas/Projetos)</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Funcionalidades Permitidas (Menus)</label>
                                <div className="modules-selection">
                                    {availableModules.map(module => (
                                        <label key={module.id} className="checkbox-item">
                                            <input
                                                type="checkbox"
                                                checked={inviteData.modules.includes(module.id)}
                                                onChange={e => {
                                                    const newModules = e.target.checked
                                                        ? [...inviteData.modules, module.id]
                                                        : inviteData.modules.filter(m => m !== module.id)
                                                    setInviteData({ ...inviteData, modules: newModules })
                                                }}
                                            />
                                            <span>{module.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="invite-notice">
                                <p>Um email será enviado para o colaborador com um link para criar sua senha de acesso.</p>
                            </div>
                            <div className="form-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowInviteModal(false)}>Cancelar</button>
                                <button type="submit" className="btn-primary" disabled={inviteLoading}>
                                    {inviteLoading ? <Loader className="spin" size={18} /> : 'Enviar Convite'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
