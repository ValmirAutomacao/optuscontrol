import { useState, useEffect } from 'react'
import {
    Building2, FileText, AlertCircle,
    ChevronRight, TrendingUp, Search
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { usePermissions } from '../hooks/usePermissions'
import './CounterDashboard.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

interface CompanyStats {
    company: {
        id: string
        name: string
        fantasy_name: string
        is_active: boolean
    }
    indicators?: {
        current_liquidity: number
        is_bidding_ready: boolean
        reference_date: string
    }
    stats: {
        invoices_count: number
        receipts_count: number
        payables_pending: number
    }
}

interface Summary {
    total_companies: number
    total_invoices: number
    total_receipts: number
    total_payables_pending: number
}

export function CounterDashboard() {
    const { user } = useAuth()
    const { switchCompany } = usePermissions()
    const [data, setData] = useState<{ companies: CompanyStats[], summary: Summary } | null>(null)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    useEffect(() => {
        if (user?.id) {
            loadCounterData()
        }
    }, [user])

    async function loadCounterData() {
        setLoading(true)
        try {
            const res = await fetch(`${API_URL}/indicators/multi-company?user_id=${user?.id}`)
            if (res.ok) {
                const result = await res.json()
                setData(result)
            }
        } catch (e) {
            console.error('Error loading counter dashboard:', e)
        } finally {
            setLoading(false)
        }
    }

    async function handleSelectCompany(companyId: string) {
        const success = await switchCompany(companyId)
        if (success) {
            // Redirecionar para o dashboard da empresa ou apenas fechar visão do contador
            window.location.href = '/'
        }
    }

    const filteredCompanies = data?.companies.filter(c =>
        c.company.name.toLowerCase().includes(search.toLowerCase()) ||
        c.company.fantasy_name?.toLowerCase().includes(search.toLowerCase())
    ) || []

    if (loading) return <div className="page-container">Carregando painel do contador...</div>

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Painel do Contador</h1>
                    <p className="page-subtitle">Visão consolidada de todas as empresas sob sua gestão</p>
                </div>
            </div>

            {/* Summary cards */}
            <div className="stats-grid">
                <div className="stat-card">
                    <Building2 className="stat-icon" />
                    <div>
                        <span className="stat-value">{data?.summary.total_companies || 0}</span>
                        <span className="stat-label">Empresas Gerenciadas</span>
                    </div>
                </div>
                <div className="stat-card">
                    <FileText className="stat-icon" />
                    <div>
                        <span className="stat-value">{data?.summary.total_invoices || 0}</span>
                        <span className="stat-label">Total de NF-e</span>
                    </div>
                </div>
                <div className="stat-card">
                    <AlertCircle className="stat-icon stat-icon--warning" />
                    <div>
                        <span className="stat-value">R$ {(data?.summary.total_payables_pending || 0).toLocaleString('pt-BR')}</span>
                        <span className="stat-label">Contas a Pagar (Total)</span>
                    </div>
                </div>
                <div className="stat-card">
                    <TrendingUp className="stat-icon stat-icon--success" />
                    <div>
                        <span className="stat-value">{data?.companies.filter(c => c.indicators?.is_bidding_ready).length || 0}</span>
                        <span className="stat-label">Empresas Aptas (Licitação)</span>
                    </div>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="filters-bar">
                <div className="search-input-wrapper">
                    <Search size={18} />
                    <input
                        placeholder="Buscar empresa por nome ou CNPJ..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Companies List */}
            <div className="companies-grid">
                {filteredCompanies.length === 0 ? (
                    <div className="empty-state">Nenhuma empresa encontrada</div>
                ) : (
                    filteredCompanies.map(item => (
                        <div key={item.company.id} className="company-card" onClick={() => handleSelectCompany(item.company.id)}>
                            <div className="company-card-header">
                                <div className="company-info">
                                    <h3>{item.company.fantasy_name || item.company.name}</h3>
                                    <span>{item.company.name}</span>
                                </div>
                                <div className={`status-pill ${item.company.is_active ? 'active' : 'inactive'}`}>
                                    {item.company.is_active ? 'Ativa' : 'Inativa'}
                                </div>
                            </div>

                            <div className="company-card-stats">
                                <div className="mini-stat">
                                    <label>NF-e</label>
                                    <strong>{item.stats.invoices_count}</strong>
                                </div>
                                <div className="mini-stat">
                                    <label>Recibos</label>
                                    <strong>{item.stats.receipts_count}</strong>
                                </div>
                                <div className="mini-stat">
                                    <label>A Pagar</label>
                                    <strong className="warning">R$ {item.stats.payables_pending.toLocaleString('pt-BR')}</strong>
                                </div>
                            </div>

                            <div className="company-card-footer">
                                <div className="liquidity-info">
                                    <label>Liquidez Corrente:</label>
                                    <span className={item.indicators?.is_bidding_ready ? 'ok' : 'alert'}>
                                        {item.indicators?.current_liquidity?.toFixed(2) || 'N/A'}
                                    </span>
                                </div>
                                <ChevronRight className="arrow-icon" size={20} />
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
