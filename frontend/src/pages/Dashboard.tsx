import { DollarSign, CreditCard, Briefcase, ArrowRightLeft } from 'lucide-react'
import { MetricCard } from '../components/dashboard/MetricCard'
import { RevenueChart } from '../components/dashboard/RevenueChart'
import { ExpenseStats } from '../components/dashboard/ExpenseStats'
import { usePermissions } from '../hooks/usePermissions'
import './Dashboard.css'

const metrics = [
    {
        label: 'Total de Receitas',
        value: 'R$ 450.000',
        change: '+6% From last week',
        changeType: 'positive' as const,
        percentage: 78,
        icon: DollarSign,
        iconColor: 'blue' as const,
    },
    {
        label: 'Total de Pagamentos',
        value: 'R$ 14.400',
        change: '-8% From last week',
        changeType: 'negative' as const,
        percentage: 50,
        icon: CreditCard,
        iconColor: 'yellow' as const,
    },
    {
        label: 'NF-e Processadas',
        value: '785',
        change: '+4% From last week',
        changeType: 'positive' as const,
        percentage: 60,
        icon: Briefcase,
        iconColor: 'purple' as const,
    },
    {
        label: 'Total Transações',
        value: '750',
        change: '-8% From last week',
        changeType: 'negative' as const,
        percentage: 85,
        icon: ArrowRightLeft,
        iconColor: 'green' as const,
    },
]

export function Dashboard() {
    const { can } = usePermissions()
    const showMetrics = can('dashboard', 'read')

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
                        {metrics.map((metric) => (
                            <MetricCard key={metric.label} {...metric} />
                        ))}
                    </div>

                    {/* Charts Row */}
                    <div className="charts-row">
                        <div className="chart-card chart-card--large">
                            <RevenueChart />
                        </div>
                        <div className="chart-card chart-card--small">
                            <ExpenseStats />
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
