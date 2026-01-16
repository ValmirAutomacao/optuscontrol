import { useState, useEffect } from 'react'
import { Building2, Plus, Users, Power, Search, X, UserPlus, Eye, Shield, Loader, Mail, Clock, Edit2, Trash2, Save } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { usePermissions } from '../hooks/usePermissions'
import './Admin.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

interface Company {
    id: string
    name: string
    fantasy_name?: string
    cnpj?: string
    email?: string
    phone?: string
    state?: string
    city?: string
    subscription_plan?: string
    subscription_status?: string
    is_active: boolean
    created_at: string
    users_count?: number
    has_pending_invite?: boolean
}

interface PlatformStats {
    companies: { total: number; active: number; pending_onboarding?: number; by_plan: Record<string, number> }
    users: { total: number; active: number }
    documents: { invoices: number; receipts: number }
}

export function Admin() {
    const { user } = useAuth()
    const { isDeveloper: isGlobalDev } = usePermissions()
    const [companies, setCompanies] = useState<Company[]>([])
    const [stats, setStats] = useState<PlatformStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [isDeveloper, setIsDeveloper] = useState(false)
    const [search, setSearch] = useState('')
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showAddUserModal, setShowAddUserModal] = useState<string | null>(null)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    const [cnpjLoading, setCnpjLoading] = useState(false)
    const [creatingCompany, setCreatingCompany] = useState(false)
    const [lastCreatedLink, setLastCreatedLink] = useState<string | null>(null)
    const [showEditModal, setShowEditModal] = useState<Company | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    // Form states
    const [newCompany, setNewCompany] = useState({
        name: '', cnpj: '', fantasy_name: '', email: '', phone: '',
        address: '', address_number: '', neighborhood: '',
        city: '', city_code: '', state: '', zip_code: '',
        subscription_plan: 'free', admin_email: '', admin_name: ''
    })
    const [newUser, setNewUser] = useState({ email: '', name: '', role: 'operator' })

    const developerEmail = user?.email || ''

    useEffect(() => {
        if (isGlobalDev) {
            setIsDeveloper(true)
            loadCompanies()
            loadStats()
            setLoading(false)
        } else if (user?.email === 'valmirmoreirajunior@gmail.com') {
            // Fallback imediato para o email principal caso o contexto demore
            setIsDeveloper(true)
            loadCompanies()
            loadStats()
            setLoading(false)
        } else if (user) {
            // Se já tem user e não é dev (nem pelo contexto nem pelo email), para o loading
            setLoading(false)
        }
    }, [isGlobalDev, user])

    async function loadCompanies() {
        try {
            const res = await fetch(`${API_URL}/admin/companies?developer_email=${encodeURIComponent(developerEmail)}&include_inactive=true`)
            if (res.ok) setCompanies(await res.json())
        } catch (e) { console.error(e) }
    }

    async function loadStats() {
        try {
            const res = await fetch(`${API_URL}/admin/stats?developer_email=${encodeURIComponent(developerEmail)}`)
            if (res.ok) setStats(await res.json())
        } catch (e) { console.error(e) }
    }

    // CNPJ Lookup
    async function handleCnpjLookup() {
        const cnpj = newCompany.cnpj.replace(/\D/g, '')
        if (cnpj.length !== 14) {
            setMessage({ type: 'error', text: 'CNPJ deve ter 14 dígitos' })
            return
        }

        setCnpjLoading(true)
        setMessage(null)

        try {
            const res = await fetch(`${API_URL}/admin/cnpj/${cnpj}`)
            if (res.ok) {
                const data = await res.json()
                setNewCompany(prev => ({
                    ...prev,
                    name: data.name || prev.name,
                    fantasy_name: data.fantasy_name || prev.fantasy_name,
                    email: data.email || prev.email,
                    phone: data.phone || prev.phone,
                    address: data.address || prev.address,
                    address_number: data.address_number || prev.address_number,
                    neighborhood: data.neighborhood || prev.neighborhood,
                    city: data.city || prev.city,
                    city_code: data.city_code || prev.city_code,
                    state: data.state || prev.state,
                    zip_code: data.zip_code || prev.zip_code
                }))
                setMessage({ type: 'success', text: 'Dados carregados da Receita Federal!' })
            } else {
                const err = await res.json()
                setMessage({ type: 'error', text: err.detail || 'Erro ao consultar CNPJ' })
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Erro de conexão' })
        } finally {
            setCnpjLoading(false)
        }
    }

    async function handleCreateCompany(e: React.FormEvent) {
        e.preventDefault()
        setMessage(null)
        setCreatingCompany(true)
        setLastCreatedLink(null)

        try {
            const res = await fetch(`${API_URL}/admin/companies?developer_email=${encodeURIComponent(developerEmail)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newCompany)
            })

            if (res.ok) {
                const result = await res.json()
                const emailStatus = result.email_sent ? '✅ Email enviado!' : '⚠️ Email não enviado'
                setMessage({ type: 'success', text: `Empresa criada! ${emailStatus}` })
                setLastCreatedLink(result.setup_link)
                setNewCompany({ name: '', cnpj: '', fantasy_name: '', email: '', phone: '', address: '', address_number: '', neighborhood: '', city: '', city_code: '', state: '', zip_code: '', subscription_plan: 'free', admin_email: '', admin_name: '' })
                setShowCreateModal(false) // FECHAR MODAL
                loadCompanies()
                loadStats()
            } else {
                const error = await res.json()
                setMessage({ type: 'error', text: error.detail || 'Erro ao criar empresa' })
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Erro de conexão' })
        } finally {
            setCreatingCompany(false)
        }
    }

    async function handleResendInvite(companyId: string) {
        try {
            const res = await fetch(`${API_URL}/admin/companies/${companyId}/resend-invite?developer_email=${encodeURIComponent(developerEmail)}`, { method: 'POST' })
            if (res.ok) {
                setMessage({ type: 'success', text: 'Convite reenviado!' })
            } else {
                const err = await res.json()
                setMessage({ type: 'error', text: err.detail || 'Erro ao reenviar' })
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Erro de conexão' })
        }
    }

    async function handleAddUser(e: React.FormEvent) {
        e.preventDefault()
        if (!showAddUserModal) return
        try {
            const params = new URLSearchParams({ user_email: newUser.email, user_name: newUser.name, role: newUser.role, developer_email: developerEmail })
            const res = await fetch(`${API_URL}/admin/companies/${showAddUserModal}/add-user?${params}`, { method: 'POST' })
            if (res.ok) {
                setMessage({ type: 'success', text: 'Usuário adicionado!' })
                setShowAddUserModal(null)
                setNewUser({ email: '', name: '', role: 'operator' })
                loadCompanies()
            } else {
                const error = await res.json()
                setMessage({ type: 'error', text: error.detail || 'Erro ao adicionar usuário' })
            }
        } catch (e) { setMessage({ type: 'error', text: 'Erro de conexão' }) }
    }

    async function toggleCompanyStatus(companyId: string, currentActive: boolean) {
        try {
            const res = await fetch(`${API_URL}/admin/companies/${companyId}/status?developer_email=${encodeURIComponent(developerEmail)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: !currentActive })
            })
            if (res.ok) loadCompanies()
        } catch (e) { console.error(e) }
    }

    async function handleEditCompany(e: React.FormEvent) {
        e.preventDefault()
        if (!showEditModal) return
        setCreatingCompany(true)
        try {
            const res = await fetch(`${API_URL}/admin/companies/${showEditModal.id}?developer_email=${encodeURIComponent(developerEmail)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(showEditModal)
            })
            if (res.ok) {
                setMessage({ type: 'success', text: 'Empresa atualizada!' })
                setShowEditModal(null)
                loadCompanies()
            } else {
                const err = await res.json()
                setMessage({ type: 'error', text: err.detail || 'Erro ao editar' })
            }
        } catch (e) { setMessage({ type: 'error', text: 'Erro de conexão' }) }
        finally { setCreatingCompany(false) }
    }

    async function handleDeleteCompany(id: string) {
        if (!window.confirm('TEM CERTEZA? Isso excluirá permanentemente a empresa e todos os seus dados!')) return
        setDeletingId(id)
        try {
            const res = await fetch(`${API_URL}/admin/companies/${id}?developer_email=${encodeURIComponent(developerEmail)}`, {
                method: 'DELETE'
            })
            if (res.ok) {
                setMessage({ type: 'success', text: 'Empresa excluída permanentemente!' })
                loadCompanies()
                loadStats()
            } else {
                const err = await res.json()
                setMessage({ type: 'error', text: err.detail || 'Erro ao excluir' })
            }
        } catch (e) { setMessage({ type: 'error', text: 'Erro de conexão' }) }
        finally { setDeletingId(null) }
    }

    const filteredCompanies = companies.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.cnpj?.includes(search))

    if (loading) return <div className="page-container"><p>Verificando acesso...</p></div>

    if (!isDeveloper) {
        return (
            <div className="page-container">
                <div className="access-denied">
                    <Shield size={64} />
                    <h2>Acesso Restrito</h2>
                    <p>Esta área é exclusiva para desenvolvedores da plataforma.</p>
                    <p className="email">Seu email: {developerEmail}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Painel Admin SaaS</h1>
                    <p className="page-subtitle">Gestão de empresas e usuários da plataforma</p>
                </div>
                <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
                    <Plus size={18} /> Nova Empresa
                </button>
            </div>

            {message && (
                <div className={`message message--${message.type}`}>
                    {message.text}
                    <button onClick={() => setMessage(null)}><X size={16} /></button>
                </div>
            )}

            {lastCreatedLink && (
                <div className="message message--info">
                    <span>Link de setup: </span>
                    <a href={lastCreatedLink} target="_blank" rel="noopener noreferrer">{lastCreatedLink}</a>
                    <button onClick={() => { navigator.clipboard.writeText(lastCreatedLink); setMessage({ type: 'success', text: 'Link copiado!' }) }}>Copiar</button>
                </div>
            )}

            {/* Stats */}
            {stats && (
                <div className="stats-grid">
                    <div className="stat-card">
                        <Building2 size={24} className="stat-icon" />
                        <div>
                            <span className="stat-value">{stats.companies.active}</span>
                            <span className="stat-label">Empresas Ativas</span>
                        </div>
                    </div>
                    <div className="stat-card">
                        <Clock size={24} className="stat-icon stat-icon--warning" />
                        <div>
                            <span className="stat-value">{stats.companies.pending_onboarding || 0}</span>
                            <span className="stat-label">Aguardando Setup</span>
                        </div>
                    </div>
                    <div className="stat-card">
                        <Users size={24} className="stat-icon" />
                        <div>
                            <span className="stat-value">{stats.users.active}</span>
                            <span className="stat-label">Usuários Ativos</span>
                        </div>
                    </div>
                    <div className="stat-card plans">
                        <div className="plan-badges">
                            {Object.entries(stats.companies.by_plan).map(([plan, count]) => (
                                <span key={plan} className={`plan-badge plan--${plan}`}>{plan}: {count}</span>
                            ))}
                        </div>
                        <span className="stat-label">Por Plano</span>
                    </div>
                </div>
            )}

            {/* Search */}
            <div className="filters-bar">
                <div className="search-input-wrapper">
                    <Search size={18} />
                    <input placeholder="Buscar por nome ou CNPJ..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
            </div>

            {/* Companies Table */}
            <div className="companies-table">
                <table>
                    <thead>
                        <tr>
                            <th>Empresa</th>
                            <th>CNPJ</th>
                            <th>Plano</th>
                            <th>Usuários</th>
                            <th>Status</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredCompanies.length === 0 ? (
                            <tr><td colSpan={6} className="empty">Nenhuma empresa encontrada</td></tr>
                        ) : (
                            filteredCompanies.map(company => (
                                <tr key={company.id} className={!company.is_active ? 'inactive' : ''}>
                                    <td>
                                        <div className="company-name">
                                            <strong>{company.name}</strong>
                                            {company.fantasy_name && <span>{company.fantasy_name}</span>}
                                        </div>
                                    </td>
                                    <td>{company.cnpj || '-'}</td>
                                    <td>
                                        <span className={`plan-badge plan--${company.subscription_plan}`}>
                                            {company.subscription_plan?.toUpperCase()}
                                        </span>
                                    </td>
                                    <td>{company.users_count || 0}</td>
                                    <td>
                                        {company.has_pending_invite ? (
                                            <span className="status-badge status--pending">Aguardando</span>
                                        ) : (
                                            <span className={`status-badge ${company.is_active ? 'status--active' : 'status--inactive'}`}>
                                                {company.is_active ? 'Ativo' : 'Inativo'}
                                            </span>
                                        )}
                                    </td>
                                    <td className="actions">
                                        <button className="btn-icon" title="Editar" onClick={() => setShowEditModal(company)}>
                                            <Edit2 size={16} />
                                        </button>
                                        <button className="btn-icon" title="Ver detalhes"><Eye size={16} /></button>
                                        {company.has_pending_invite && (
                                            <button className="btn-icon" title="Reenviar convite" onClick={() => handleResendInvite(company.id)}>
                                                <Mail size={16} />
                                            </button>
                                        )}
                                        <button className="btn-icon" title="Adicionar usuário" onClick={() => setShowAddUserModal(company.id)}>
                                            <UserPlus size={16} />
                                        </button>
                                        <button
                                            className={`btn-icon ${company.is_active ? 'btn-icon--danger' : 'btn-icon--success'}`}
                                            title={company.is_active ? 'Desativar' : 'Ativar'}
                                            onClick={() => toggleCompanyStatus(company.id, company.is_active)}
                                        >
                                            <Power size={16} />
                                        </button>
                                        <button
                                            className="btn-icon btn-icon--danger"
                                            title="EXCLUIR DEFINITIVAMENTE"
                                            onClick={() => handleDeleteCompany(company.id)}
                                            disabled={deletingId === company.id}
                                        >
                                            {deletingId === company.id ? <Loader className="spin" size={16} /> : <Trash2 size={16} />}
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Create Company Modal */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal-content modal-large" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Nova Empresa</h2>
                            <button className="modal-close" onClick={() => setShowCreateModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleCreateCompany} className="modal-body">
                            <h3>Consultar CNPJ</h3>
                            <div className="form-row cnpj-lookup">
                                <div className="form-group">
                                    <label>CNPJ *</label>
                                    <input
                                        required
                                        value={newCompany.cnpj}
                                        onChange={e => setNewCompany({ ...newCompany, cnpj: e.target.value })}
                                        placeholder="00.000.000/0000-00"
                                    />
                                </div>
                                <button type="button" className="btn-secondary btn-lookup" onClick={handleCnpjLookup} disabled={cnpjLoading}>
                                    {cnpjLoading ? <Loader className="spin" size={16} /> : <Search size={16} />}
                                    {cnpjLoading ? 'Buscando...' : 'Buscar'}
                                </button>
                            </div>

                            <h3>Dados da Empresa</h3>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Razão Social *</label>
                                    <input required value={newCompany.name} onChange={e => setNewCompany({ ...newCompany, name: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Nome Fantasia</label>
                                    <input value={newCompany.fantasy_name} onChange={e => setNewCompany({ ...newCompany, fantasy_name: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Email</label>
                                    <input type="email" value={newCompany.email} onChange={e => setNewCompany({ ...newCompany, email: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Telefone</label>
                                    <input value={newCompany.phone} onChange={e => setNewCompany({ ...newCompany, phone: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group flex-2">
                                    <label>Endereço</label>
                                    <input value={newCompany.address} onChange={e => setNewCompany({ ...newCompany, address: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Nº</label>
                                    <input value={newCompany.address_number} onChange={e => setNewCompany({ ...newCompany, address_number: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Bairro</label>
                                    <input value={newCompany.neighborhood} onChange={e => setNewCompany({ ...newCompany, neighborhood: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Cidade</label>
                                    <input value={newCompany.city} onChange={e => setNewCompany({ ...newCompany, city: e.target.value })} />
                                </div>
                                <div className="form-group" style={{ maxWidth: '80px' }}>
                                    <label>UF</label>
                                    <input maxLength={2} value={newCompany.state} onChange={e => setNewCompany({ ...newCompany, state: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>CEP</label>
                                    <input value={newCompany.zip_code} onChange={e => setNewCompany({ ...newCompany, zip_code: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Plano</label>
                                    <select value={newCompany.subscription_plan} onChange={e => setNewCompany({ ...newCompany, subscription_plan: e.target.value })}>
                                        <option value="free">Free</option>
                                        <option value="pro">Pro</option>
                                        <option value="enterprise">Enterprise</option>
                                    </select>
                                </div>
                            </div>

                            <h3>Administrador Inicial</h3>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Nome do Admin *</label>
                                    <input required value={newCompany.admin_name} onChange={e => setNewCompany({ ...newCompany, admin_name: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Email do Admin *</label>
                                    <input required type="email" value={newCompany.admin_email} onChange={e => setNewCompany({ ...newCompany, admin_email: e.target.value })} />
                                </div>
                            </div>
                            <p className="form-hint">Um email será enviado para o admin com link para criar sua senha.</p>

                            <div className="form-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>Cancelar</button>
                                <button type="submit" className="btn-primary" disabled={creatingCompany}>
                                    {creatingCompany ? 'Criando...' : 'Criar e Enviar Convite'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add User Modal */}
            {showAddUserModal && (
                <div className="modal-overlay" onClick={() => setShowAddUserModal(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Adicionar Usuário</h2>
                            <button className="modal-close" onClick={() => setShowAddUserModal(null)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleAddUser} className="modal-body">
                            <div className="form-group">
                                <label>Nome *</label>
                                <input required value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Email *</label>
                                <input required type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Perfil de Acesso</label>
                                <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                                    <option value="owner">Proprietário</option>
                                    <option value="admin">Administrador</option>
                                    <option value="accountant">Contador</option>
                                    <option value="manager">Gestor</option>
                                    <option value="operator">Operador</option>
                                </select>
                            </div>
                            <div className="form-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowAddUserModal(null)}>Cancelar</button>
                                <button type="submit" className="btn-primary">Adicionar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Edit Company Modal */}
            {showEditModal && (
                <div className="modal-overlay" onClick={() => setShowEditModal(null)}>
                    <div className="modal-content modal-large" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Editar Empresa</h2>
                            <button className="modal-close" onClick={() => setShowEditModal(null)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleEditCompany} className="modal-body">
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Razão Social *</label>
                                    <input required value={showEditModal.name} onChange={e => setShowEditModal({ ...showEditModal, name: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Nome Fantasia</label>
                                    <input value={showEditModal.fantasy_name || ''} onChange={e => setShowEditModal({ ...showEditModal, fantasy_name: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>CNPJ *</label>
                                    <input required value={showEditModal.cnpj || ''} onChange={e => setShowEditModal({ ...showEditModal, cnpj: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Email</label>
                                    <input type="email" value={showEditModal.email || ''} onChange={e => setShowEditModal({ ...showEditModal, email: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Telefone</label>
                                    <input value={showEditModal.phone || ''} onChange={e => setShowEditModal({ ...showEditModal, phone: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Plano</label>
                                    <select value={showEditModal.subscription_plan} onChange={e => setShowEditModal({ ...showEditModal, subscription_plan: e.target.value })}>
                                        <option value="free">Free</option>
                                        <option value="pro">Pro</option>
                                        <option value="enterprise">Enterprise</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Cidade</label>
                                    <input value={showEditModal.city || ''} onChange={e => setShowEditModal({ ...showEditModal, city: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>UF</label>
                                    <input maxLength={2} value={showEditModal.state || ''} onChange={e => setShowEditModal({ ...showEditModal, state: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowEditModal(null)}>Cancelar</button>
                                <button type="submit" className="btn-primary" disabled={creatingCompany}>
                                    <Save size={18} /> {creatingCompany ? 'Salvando...' : 'Salvar Alterações'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
