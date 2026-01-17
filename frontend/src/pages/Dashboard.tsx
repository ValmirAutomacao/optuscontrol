import { useEffect, useState } from 'react'
import { DollarSign, CreditCard, Briefcase, ArrowRightLeft } from 'lucide-react'
import { MetricCard } from '../components/dashboard/MetricCard'
import { RevenueChart } from '../components/dashboard/RevenueChart'
import { ExpenseStats } from '../components/dashboard/ExpenseStats'
import { usePermissions } from '../hooks/usePermissions'
import { useAuth } from '../hooks/useAuth'
import './Dashboard.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

interface DashboardMetrics {
    totalReceitas: number
    totalPagamentos: number
    nfeProcessadas: number
    totalTransacoes: number
}

export function Dashboard() {
    const { can, activeCompanyId } = usePermissions()
    const { session } = useAuth()
    const showMetrics = can('dashboard', 'read')

    const [metrics, setMetrics] = useState<DashboardMetrics>({
        totalReceitas: 0,
        totalPagamentos: 0,
        nfeProcessadas: 0,
        totalTransacoes: 0
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (activeCompanyId && session?.access_token) {
            loadMetrics()
        } else {
            setLoading(false)
        }
    }, [activeCompanyId, session])

    async function loadMetrics() {
        try {
            // Buscar totais de notas fiscais
            const invoicesRes = await fetch(`${API_URL}/invoices?company_id=${activeCompanyId}`, {
                headers: { 'Authorization': `Bearer ${session?.access_token}` }
            })

            // Buscar totais de pagamentos
            const payablesRes = await fetch(`${API_URL}/payables?company_id=${activeCompanyId}`, {
                headers: { 'Authorization': `Bearer ${session?.access_token}` }
            })

            let totalReceitas = 0
            let nfeProcessadas = 0
            let totalPagamentos = 0
            let totalTransacoes = 0

            if (invoicesRes.ok) {
                const invoices = await invoicesRes.json()
                nfeProcessadas = invoices.length || 0
                totalReceitas = invoices.reduce((sum: number, inv: any) => sum + (inv.total_value || 0), 0)
            }

            if (payablesRes.ok) {
                const payables = await payablesRes.json()
                totalPagamentos = payables.reduce((sum: number, p: any) => sum + (p.amount || 0), 0)
                totalTransacoes = payables.length || 0
            }

            setMetrics({
                totalReceitas,
                totalPagamentos,
                nfeProcessadas,
                totalTransacoes
            })
        } catch (error) {
            console.error('Erro ao carregar métricas:', error)
        } finally {
            setLoading(false)
        }
    }

    const formatCurrency = (value: number) => {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    }

    const metricCards = [
        {
            label: 'Total de Receitas',
            value: formatCurrency(metrics.totalReceitas),
            change: metrics.totalReceitas > 0 ? 'Dados reais' : 'Sem dados',
            changeType: metrics.totalReceitas > 0 ? 'positive' as const : 'neutral' as const,
            percentage: metrics.totalReceitas > 0 ? 100 : 0,
            icon: DollarSign,
            iconColor: 'blue' as const,
        },
        {
            label: 'Total de Pagamentos',
            value: formatCurrency(metrics.totalPagamentos),
            change: metrics.totalPagamentos > 0 ? 'Dados reais' : 'Sem dados',
            changeType: metrics.totalPagamentos > 0 ? 'negative' as const : 'neutral' as const,
            percentage: metrics.totalPagamentos > 0 ? 100 : 0,
            icon: CreditCard,
            iconColor: 'yellow' as const,
        },
        {
            label: 'NF-e Processadas',
            value: metrics.nfeProcessadas.toString(),
            change: metrics.nfeProcessadas > 0 ? 'Dados reais' : 'Sem dados',
            changeType: metrics.nfeProcessadas > 0 ? 'positive' as const : 'neutral' as const,
            percentage: metrics.nfeProcessadas > 0 ? 100 : 0,
            icon: Briefcase,
            iconColor: 'purple' as const,
        },
        {
            label: 'Total Transações',
            value: metrics.totalTransacoes.toString(),
            change: metrics.totalTransacoes > 0 ? 'Dados reais' : 'Sem dados',
            changeType: metrics.totalTransacoes > 0 ? 'positive' as const : 'neutral' as const,
            percentage: metrics.totalTransacoes > 0 ? 100 : 0,
            icon: ArrowRightLeft,
            iconColor: 'green' as const,
        },
    ]

    return (
        <div className="dashboard">
            {!showMetrics ? (
                <div className="restricted-dashboard">
                    <div className="restricted-card">
                        <h3>Bem-vindo ao Optus Control</h3>
                        <p>Você tem acesso aos módulos permitidos no menu lateral.</p>
                        <p className="hint">As métricas financeiras globais estão restritas ao seu nível de acesso.</p>
                    </div>
                </div>
            ) : (
                <>
                    {/* Metric Cards */}
                    <div className="metrics-grid">
                        {loading ? (
                            <div className="loading-metrics">Carregando métricas...</div>
                        ) : (
                            metricCards.map((metric) => (
                                <MetricCard key={metric.label} {...metric} />
                            ))
                        )}
                    </div>

                    {/* Charts Row */}
                    <div className="charts-row">
                        <div className="chart-card chart-card--large">
                            <RevenueChart companyId={activeCompanyId} />
                        </div>
                        <div className="chart-card chart-card--small">
                            <ExpenseStats companyId={activeCompanyId} />
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
