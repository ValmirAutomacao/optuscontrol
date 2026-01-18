import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useAuth } from '../../hooks/useAuth'
import './RevenueChart.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

interface RevenueData {
    month: string
    receitas: number
    despesas: number
}

interface Props {
    companyId?: string | null
}

export function RevenueChart({ companyId }: Props) {
    const { session } = useAuth()
    const [data, setData] = useState<RevenueData[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (companyId && session?.access_token) {
            loadData()
        } else {
            // Dados zerados para quando não há empresa selecionada
            setData(getEmptyData())
            setLoading(false)
        }
    }, [companyId, session])

    function getEmptyData(): RevenueData[] {
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun']
        return months.map(month => ({
            month,
            receitas: 0,
            despesas: 0
        }))
    }

    async function loadData() {
        try {
            // Buscar invoices para receitas
            const invoicesRes = await fetch(`${API_URL}/invoices?company_id=${companyId}`, {
                headers: { 'Authorization': `Bearer ${session?.access_token}` }
            })

            // Buscar payables para despesas
            const payablesRes = await fetch(`${API_URL}/payables?company_id=${companyId}`, {
                headers: { 'Authorization': `Bearer ${session?.access_token}` }
            })

            const monthlyData: { [key: string]: RevenueData } = {}
            const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

            // Inicializar últimos 6 meses
            const currentMonth = new Date().getMonth()
            for (let i = 5; i >= 0; i--) {
                const monthIndex = (currentMonth - i + 12) % 12
                const monthName = months[monthIndex]
                monthlyData[monthName] = { month: monthName, receitas: 0, despesas: 0 }
            }

            if (invoicesRes.ok) {
                const invoices = await invoicesRes.json()
                invoices.forEach((inv: any) => {
                    if (inv.issue_date) {
                        const date = new Date(inv.issue_date)
                        const monthName = months[date.getMonth()]
                        if (monthlyData[monthName]) {
                            monthlyData[monthName].receitas += inv.total_value || 0
                        }
                    }
                })
            }

            if (payablesRes.ok) {
                const payables = await payablesRes.json()
                payables.forEach((p: any) => {
                    if (p.due_date) {
                        const date = new Date(p.due_date)
                        const monthName = months[date.getMonth()]
                        if (monthlyData[monthName]) {
                            monthlyData[monthName].despesas += p.amount || 0
                        }
                    }
                })
            }

            setData(Object.values(monthlyData))
        } catch (error) {
            console.error('Erro ao carregar dados do gráfico:', error)
            setData(getEmptyData())
        } finally {
            setLoading(false)
        }
    }

    const hasData = data.some(d => d.receitas > 0 || d.despesas > 0)

    return (
        <div className="revenue-chart">
            <div className="chart-header">
                <h3 className="chart-title">Evolução Financeira</h3>
                <div className="chart-legend">
                    <span className="legend-item">
                        <span className="legend-dot legend-dot--blue"></span>
                        Receitas
                    </span>
                    <span className="legend-item">
                        <span className="legend-dot legend-dot--yellow"></span>
                        Despesas
                    </span>
                </div>
            </div>

            <div className="chart-container">
                {loading ? (
                    <div className="chart-loading">Carregando...</div>
                ) : !hasData ? (
                    <div className="chart-empty">
                        <p>Nenhum dado financeiro registrado.</p>
                        <small>Os dados aparecerão aqui quando você processar notas fiscais.</small>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={data} barGap={8}>
                            <XAxis
                                dataKey="month"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#6B7280', fontSize: 12 }}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#6B7280', fontSize: 12 }}
                                tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
                            />
                            <Tooltip
                                contentStyle={{
                                    background: '#1A1D21',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: 'white'
                                }}
                                formatter={(value) => [`R$ ${(value as number).toLocaleString('pt-BR')}`, '']}
                            />
                            <Bar dataKey="receitas" name="Receitas" radius={[8, 8, 0, 0]} maxBarSize={40}>
                                {data.map((_entry, index) => (
                                    <Cell key={`receitas-${index}`} fill="#4361EE" />
                                ))}
                            </Bar>
                            <Bar dataKey="despesas" name="Despesas" radius={[8, 8, 0, 0]} maxBarSize={40}>
                                {data.map((_entry, index) => (
                                    <Cell key={`despesas-${index}`} fill="#FBBF24" />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    )
}
