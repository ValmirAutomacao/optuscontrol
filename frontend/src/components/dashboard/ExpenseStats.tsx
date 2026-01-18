import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { FileText, CreditCard, TrendingUp } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import './ExpenseStats.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

interface CategoryData {
    name: string
    value: number
    color: string
    [key: string]: string | number
}

interface RecentTransaction {
    icon: React.ComponentType<any>
    label: string
    category: string
    time: string
    amount: string
    color: string
}

interface Props {
    companyId?: string | null
}

export function ExpenseStats({ companyId }: Props) {
    const { session } = useAuth()
    const [donutData, setDonutData] = useState<CategoryData[]>([
        { name: 'Notas Fiscais', value: 0, color: '#4361EE' },
        { name: 'Pagamentos', value: 0, color: '#F97316' },
    ])
    const [transactions, setTransactions] = useState<RecentTransaction[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (companyId && session?.access_token) {
            loadData()
        } else {
            setLoading(false)
        }
    }, [companyId, session])

    async function loadData() {
        try {
            const invoicesRes = await fetch(`${API_URL}/invoices?company_id=${companyId}`, {
                headers: { 'Authorization': `Bearer ${session?.access_token}` }
            })

            const payablesRes = await fetch(`${API_URL}/payables?company_id=${companyId}`, {
                headers: { 'Authorization': `Bearer ${session?.access_token}` }
            })

            let totalInvoices = 0
            let totalPayables = 0
            const recentTx: RecentTransaction[] = []

            if (invoicesRes.ok) {
                const invoices = await invoicesRes.json()
                totalInvoices = invoices.reduce((sum: number, inv: any) => sum + (inv.total_value || 0), 0)

                // Pegar últimas 2 notas
                invoices.slice(0, 2).forEach((inv: any) => {
                    recentTx.push({
                        icon: FileText,
                        label: inv.supplier_name || 'Nota Fiscal',
                        category: 'NF-e',
                        time: inv.issue_date ? formatTimeAgo(inv.issue_date) : 'Recente',
                        amount: `R$ ${(inv.total_value || 0).toLocaleString('pt-BR')}`,
                        color: '#4361EE'
                    })
                })
            }

            if (payablesRes.ok) {
                const payables = await payablesRes.json()
                totalPayables = payables.reduce((sum: number, p: any) => sum + (p.amount || 0), 0)

                // Pegar últimos 2 pagamentos
                payables.slice(0, 2).forEach((p: any) => {
                    recentTx.push({
                        icon: CreditCard,
                        label: p.description || 'Pagamento',
                        category: p.category || 'Despesa',
                        time: p.due_date ? formatTimeAgo(p.due_date) : 'Recente',
                        amount: `R$ ${(p.amount || 0).toLocaleString('pt-BR')}`,
                        color: '#F97316'
                    })
                })
            }

            setDonutData([
                { name: 'Notas Fiscais', value: totalInvoices, color: '#4361EE' },
                { name: 'Pagamentos', value: totalPayables, color: '#F97316' },
            ])

            setTransactions(recentTx.slice(0, 4))
        } catch (error) {
            console.error('Erro ao carregar estatísticas:', error)
        } finally {
            setLoading(false)
        }
    }

    function formatTimeAgo(dateStr: string): string {
        const date = new Date(dateStr)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

        if (diffDays === 0) return 'Hoje'
        if (diffDays === 1) return 'Ontem'
        if (diffDays < 7) return `${diffDays} dias atrás`
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} semanas atrás`
        return `${Math.floor(diffDays / 30)} meses atrás`
    }

    const total = donutData.reduce((sum, item) => sum + item.value, 0)
    const hasData = total > 0

    return (
        <div className="expense-stats">
            <div className="stats-header">
                <h3 className="stats-title">Estatísticas</h3>
            </div>

            {loading ? (
                <div className="stats-loading">Carregando...</div>
            ) : !hasData ? (
                <div className="stats-empty">
                    <TrendingUp size={48} color="#6B7280" />
                    <p>Nenhum dado ainda</p>
                    <small>Processe notas fiscais para ver as estatísticas.</small>
                </div>
            ) : (
                <>
                    {/* Donut Chart */}
                    <div className="donut-container">
                        <ResponsiveContainer width="100%" height={180}>
                            <PieChart>
                                <Pie
                                    data={donutData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={55}
                                    outerRadius={80}
                                    paddingAngle={2}
                                    dataKey="value"
                                >
                                    {donutData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="donut-center">
                            <span className="donut-label">Total</span>
                            <span className="donut-value">R$ {total.toLocaleString('pt-BR')}</span>
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="donut-legend">
                        {donutData.map((item) => (
                            <div key={item.name} className="legend-item">
                                <span className="legend-dot" style={{ background: item.color }}></span>
                                <span>{item.name}: R$ {item.value.toLocaleString('pt-BR')}</span>
                            </div>
                        ))}
                    </div>

                    {/* Transactions List */}
                    {transactions.length > 0 && (
                        <div className="transactions-list">
                            <h4 className="transactions-title">Últimas Movimentações</h4>
                            {transactions.map((tx, index) => (
                                <div key={index} className="transaction-item">
                                    <div className="transaction-icon" style={{ background: `${tx.color}15` }}>
                                        <tx.icon size={18} color={tx.color} />
                                    </div>
                                    <div className="transaction-info">
                                        <span className="transaction-label">{tx.label}</span>
                                        <span className="transaction-meta">
                                            <span className="transaction-category">{tx.category}</span>
                                            <span className="transaction-time">{tx.time}</span>
                                        </span>
                                    </div>
                                    <span className="transaction-amount">{tx.amount}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
