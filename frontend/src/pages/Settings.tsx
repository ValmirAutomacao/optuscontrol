import { useState, useEffect } from 'react'
import { Building2, Save, Users, Shield, MapPin, Phone, FileText, User } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { usePermissions } from '../hooks/usePermissions'
import './Settings.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

interface Company {
    id: string
    name: string
    fantasy_name?: string
    cnpj?: string
    state_registration?: string
    municipal_registration?: string
    address?: string
    address_number?: string
    address_complement?: string
    neighborhood?: string
    city?: string
    city_code?: string
    state?: string
    zip_code?: string
    phone?: string
    email?: string
    logo_url?: string
    accountant_name?: string
    accountant_crc?: string
    accountant_cpf?: string
    accountant_email?: string
    subscription_status?: string
    subscription_plan?: string
}

interface UserRole {
    id: string
    user_id: string
    email: string
    name: string
    role: string
    is_active: boolean
}

export function Settings() {
    const { session } = useAuth()
    const { activeCompanyId } = usePermissions()
    const [activeTab, setActiveTab] = useState<'company' | 'users' | 'subscription'>('company')
    const [company, setCompany] = useState<Company | null>(null)
    const [users, setUsers] = useState<UserRole[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    useEffect(() => {
        if (activeCompanyId && session?.access_token) {
            loadCompany()
            loadUsers()
        }
    }, [activeCompanyId, session])

    async function loadCompany() {
        if (!activeCompanyId || !session?.access_token) return
        try {
            const res = await fetch(`${API_URL}/companies/${activeCompanyId}`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            })
            if (res.ok) {
                const data = await res.json()
                setCompany(data)
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    async function loadUsers() {
        if (!activeCompanyId || !session?.access_token) return
        try {
            const res = await fetch(`${API_URL}/users`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            })
            if (res.ok) {
                const data = await res.json()
                setUsers(data.active_users || [])
            }
        } catch (e) {
            console.error(e)
        }
    }

    async function handleSave() {
        if (!company || !activeCompanyId || !session?.access_token) return
        setSaving(true)
        setMessage(null)

        try {
            const res = await fetch(`${API_URL}/companies/${activeCompanyId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(company)
            })

            if (res.ok) {
                setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' })
            } else {
                setMessage({ type: 'error', text: 'Erro ao salvar. Tente novamente.' })
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Erro de conexão.' })
        } finally {
            setSaving(false)
        }
    }

    function updateField(field: keyof Company, value: string) {
        if (company) {
            setCompany({ ...company, [field]: value })
        }
    }

    const roleLabels: Record<string, string> = {
        owner: 'Proprietário',
        admin: 'Administrador',
        accountant: 'Contador',
        manager: 'Gestor',
        operator: 'Operador'
    }

    if (loading && !company) {
        return <div className="page-container"><p>Carregando...</p></div>
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Configurações</h1>
                    <p className="page-subtitle">Gerencie os dados da empresa, usuários e assinatura</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="settings-tabs">
                <button
                    className={`tab ${activeTab === 'company' ? 'active' : ''}`}
                    onClick={() => setActiveTab('company')}
                >
                    <Building2 size={18} /> Empresa
                </button>
                <button
                    className={`tab ${activeTab === 'users' ? 'active' : ''}`}
                    onClick={() => setActiveTab('users')}
                >
                    <Users size={18} /> Usuários
                </button>
                <button
                    className={`tab ${activeTab === 'subscription' ? 'active' : ''}`}
                    onClick={() => setActiveTab('subscription')}
                >
                    <Shield size={18} /> Assinatura
                </button>
            </div>

            {message && (
                <div className={`message message--${message.type}`}>
                    {message.text}
                </div>
            )}

            {/* Company Tab */}
            {activeTab === 'company' && company && (
                <div className="settings-content">
                    {/* Dados Básicos */}
                    <section className="settings-section">
                        <h2><Building2 size={20} /> Dados da Empresa</h2>
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Razão Social *</label>
                                <input value={company.name || ''} onChange={e => updateField('name', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Nome Fantasia</label>
                                <input value={company.fantasy_name || ''} onChange={e => updateField('fantasy_name', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>CNPJ *</label>
                                <input value={company.cnpj || ''} onChange={e => updateField('cnpj', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Inscrição Estadual</label>
                                <input value={company.state_registration || ''} onChange={e => updateField('state_registration', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Inscrição Municipal</label>
                                <input value={company.municipal_registration || ''} onChange={e => updateField('municipal_registration', e.target.value)} />
                            </div>
                        </div>
                    </section>

                    {/* Endereço */}
                    <section className="settings-section">
                        <h2><MapPin size={20} /> Endereço</h2>
                        <div className="form-grid">
                            <div className="form-group span-2">
                                <label>CEP</label>
                                <input value={company.zip_code || ''} onChange={e => updateField('zip_code', e.target.value)} />
                            </div>
                            <div className="form-group span-4">
                                <label>Logradouro</label>
                                <input value={company.address || ''} onChange={e => updateField('address', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Número</label>
                                <input value={company.address_number || ''} onChange={e => updateField('address_number', e.target.value)} />
                            </div>
                            <div className="form-group span-2">
                                <label>Complemento</label>
                                <input value={company.address_complement || ''} onChange={e => updateField('address_complement', e.target.value)} />
                            </div>
                            <div className="form-group span-2">
                                <label>Bairro</label>
                                <input value={company.neighborhood || ''} onChange={e => updateField('neighborhood', e.target.value)} />
                            </div>
                            <div className="form-group span-3">
                                <label>Cidade</label>
                                <input value={company.city || ''} onChange={e => updateField('city', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>UF</label>
                                <input value={company.state || ''} onChange={e => updateField('state', e.target.value)} maxLength={2} />
                            </div>
                        </div>
                    </section>

                    {/* Contato */}
                    <section className="settings-section">
                        <h2><Phone size={20} /> Contato</h2>
                        <div className="form-grid">
                            <div className="form-group span-3">
                                <label>Telefone</label>
                                <input value={company.phone || ''} onChange={e => updateField('phone', e.target.value)} />
                            </div>
                            <div className="form-group span-3">
                                <label>Email</label>
                                <input type="email" value={company.email || ''} onChange={e => updateField('email', e.target.value)} />
                            </div>
                        </div>
                    </section>

                    {/* Contador */}
                    <section className="settings-section">
                        <h2><FileText size={20} /> Dados do Contador</h2>
                        <p className="section-description">Informações usadas nos arquivos SPED e EFD</p>
                        <div className="form-grid">
                            <div className="form-group span-3">
                                <label>Nome do Contador</label>
                                <input value={company.accountant_name || ''} onChange={e => updateField('accountant_name', e.target.value)} />
                            </div>
                            <div className="form-group span-2">
                                <label>CRC</label>
                                <input value={company.accountant_crc || ''} onChange={e => updateField('accountant_crc', e.target.value)} />
                            </div>
                            <div className="form-group span-2">
                                <label>CPF do Contador</label>
                                <input value={company.accountant_cpf || ''} onChange={e => updateField('accountant_cpf', e.target.value)} />
                            </div>
                            <div className="form-group span-3">
                                <label>Email do Contador</label>
                                <input type="email" value={company.accountant_email || ''} onChange={e => updateField('accountant_email', e.target.value)} />
                            </div>
                        </div>
                    </section>

                    <div className="form-actions">
                        <button className="btn-primary" onClick={handleSave} disabled={saving}>
                            <Building2 size={18} /> {saving ? 'Salvando...' : 'Salvar Configurações'}
                        </button>
                    </div>
                </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
                <div className="settings-content">
                    <section className="settings-section">
                        <div className="section-header">
                            <h2><Users size={20} /> Usuários da Empresa</h2>
                            <button className="btn-primary btn-sm">
                                <User size={16} /> Convidar Usuário
                            </button>
                        </div>

                        <div className="users-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Nome</th>
                                        <th>Email</th>
                                        <th>Perfil</th>
                                        <th>Status</th>
                                        <th>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="empty">Nenhum usuário cadastrado</td>
                                        </tr>
                                    ) : (
                                        users.map(user => (
                                            <tr key={user.id}>
                                                <td className="font-medium">{user.name || 'Sem nome'}</td>
                                                <td>{user.email}</td>
                                                <td>
                                                    <span className={`role-badge role--${user.role}`}>
                                                        {roleLabels[user.role] || user.role}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`status-badge ${user.is_active ? 'status--active' : 'status--inactive'}`}>
                                                        {user.is_active ? 'Ativo' : 'Inativo'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <button className="btn-icon">Editar</button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="roles-info">
                            <h3>Perfis de Acesso</h3>
                            <ul>
                                <li><strong>Proprietário:</strong> Acesso total + configurações de plano</li>
                                <li><strong>Administrador:</strong> Acesso total exceto plano</li>
                                <li><strong>Contador:</strong> Visualizar + exportar relatórios</li>
                                <li><strong>Gestor:</strong> Gerenciar projetos e despesas</li>
                                <li><strong>Operador:</strong> Apenas upload de documentos</li>
                            </ul>
                        </div>
                    </section>
                </div>
            )}

            {/* Subscription Tab */}
            {activeTab === 'subscription' && company && (
                <div className="settings-content">
                    <section className="settings-section">
                        <h2><Shield size={20} /> Plano Atual</h2>

                        <div className="subscription-card">
                            <div className="plan-badge">{company.subscription_plan?.toUpperCase() || 'FREE'}</div>
                            <div className="plan-info">
                                <h3>Plano {company.subscription_plan === 'free' ? 'Gratuito' : company.subscription_plan}</h3>
                                <p>Status: <span className={company.subscription_status === 'active' ? 'text-success' : 'text-warning'}>
                                    {company.subscription_status === 'trial' ? 'Período de teste' : 'Ativo'}
                                </span></p>
                            </div>
                        </div>

                        <div className="plans-grid">
                            <div className="plan-option">
                                <h4>Free</h4>
                                <p className="price">R$ 0<span>/mês</span></p>
                                <ul>
                                    <li>3 usuários</li>
                                    <li>500 MB de armazenamento</li>
                                    <li>Exportação básica</li>
                                </ul>
                                <button className="btn-secondary" disabled>Plano Atual</button>
                            </div>
                            <div className="plan-option featured">
                                <h4>Pro</h4>
                                <p className="price">R$ 99<span>/mês</span></p>
                                <ul>
                                    <li>10 usuários</li>
                                    <li>5 GB de armazenamento</li>
                                    <li>Exportação SPED/EFD</li>
                                    <li>Dashboard do contador</li>
                                </ul>
                                <button className="btn-primary">Fazer Upgrade</button>
                            </div>
                            <div className="plan-option">
                                <h4>Enterprise</h4>
                                <p className="price">R$ 299<span>/mês</span></p>
                                <ul>
                                    <li>Usuários ilimitados</li>
                                    <li>50 GB de armazenamento</li>
                                    <li>API de integração</li>
                                    <li>Suporte prioritário</li>
                                </ul>
                                <button className="btn-secondary">Contatar Vendas</button>
                            </div>
                        </div>
                    </section>
                </div>
            )}
        </div>
    )
}
