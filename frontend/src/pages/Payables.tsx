import { useState, useEffect } from 'react'
import { Wallet, Plus, Calendar, AlertCircle, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePermissions } from '../hooks/usePermissions'
import './Payables.css'

interface Payable {
    id: string
    description: string
    supplier_name: string
    due_date: string
    amount: number
    status: string
    payment_date: string | null
}

export function Payables() {
    const { activeCompanyId } = usePermissions()
    const [payables, setPayables] = useState<Payable[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all')

    useEffect(() => {
        if (activeCompanyId) {
            fetchPayables()
        }
    }, [activeCompanyId])

    async function fetchPayables() {
        if (!activeCompanyId) return
        try {
            const { data, error } = await supabase
                .from('payables')
                .select('*')
                .eq('company_id', activeCompanyId)
                .order('due_date', { ascending: true })

            if (error) throw error
            setPayables(data || [])
        } catch (error) {
            console.error('Erro ao buscar contas:', error)
        } finally {
            setLoading(false)
        }
    }

    const getStatus = (payable: Payable) => {
        if (payable.status === 'paid') return 'paid'
        const dueDate = new Date(payable.due_date)
        const today = new Date()
        if (dueDate < today) return 'overdue'
        return 'pending'
    }

    const filteredPayables = payables.filter(p => {
        if (filter === 'all') return true
        return getStatus(p) === filter
    })

    const totalPending = payables
        .filter(p => getStatus(p) === 'pending')
        .reduce((sum, p) => sum + p.amount, 0)

    const totalOverdue = payables
        .filter(p => getStatus(p) === 'overdue')
        .reduce((sum, p) => sum + p.amount, 0)

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Contas a Pagar</h1>
                    <p className="page-subtitle">Gerencie as contas e pagamentos</p>
                </div>
                <button className="btn-primary">
                    <Plus size={18} />
                    Nova Conta
                </button>
            </div>

            {/* Summary Cards */}
            <div className="payables-summary">
                <div className="summary-card summary-card--warning">
                    <AlertCircle size={24} />
                    <div>
                        <span className="summary-value">
                            R$ {totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="summary-label">Vencidas</span>
                    </div>
                </div>
                <div className="summary-card summary-card--info">
                    <Calendar size={24} />
                    <div>
                        <span className="summary-value">
                            R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="summary-label">A Vencer</span>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="filter-tabs">
                <button
                    className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
                    onClick={() => setFilter('all')}
                >
                    Todas ({payables.length})
                </button>
                <button
                    className={`filter-tab ${filter === 'pending' ? 'active' : ''}`}
                    onClick={() => setFilter('pending')}
                >
                    Pendentes
                </button>
                <button
                    className={`filter-tab ${filter === 'overdue' ? 'active' : ''}`}
                    onClick={() => setFilter('overdue')}
                >
                    Vencidas
                </button>
                <button
                    className={`filter-tab ${filter === 'paid' ? 'active' : ''}`}
                    onClick={() => setFilter('paid')}
                >
                    Pagas
                </button>
            </div>

            {/* List */}
            <div className="payables-list">
                {loading ? (
                    <div className="list-loading">Carregando...</div>
                ) : filteredPayables.length === 0 ? (
                    <div className="list-empty">
                        <Wallet size={48} />
                        <h3>Nenhuma conta encontrada</h3>
                        <p>Adicione uma nova conta a pagar</p>
                    </div>
                ) : (
                    filteredPayables.map((payable) => {
                        const status = getStatus(payable)
                        return (
                            <div key={payable.id} className={`payable-item payable-item--${status}`}>
                                <div className="payable-main">
                                    <h4>{payable.description}</h4>
                                    <p>{payable.supplier_name}</p>
                                </div>
                                <div className="payable-date">
                                    <span className="date-label">Vencimento</span>
                                    <span className="date-value">
                                        {new Date(payable.due_date).toLocaleDateString('pt-BR')}
                                    </span>
                                </div>
                                <div className="payable-amount">
                                    R$ {payable.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </div>
                                <div className="payable-actions">
                                    {status === 'paid' ? (
                                        <span className="status-paid">
                                            <CheckCircle size={16} /> Pago
                                        </span>
                                    ) : (
                                        <button className="btn-pay">Pagar</button>
                                    )}
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
