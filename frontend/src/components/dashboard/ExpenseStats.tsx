import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { ShoppingCart, Apple, CreditCard, Wrench } from 'lucide-react'
import './ExpenseStats.css'

const donutData = [
    { name: 'Activities', value: 5432, color: '#4361EE' },
    { name: 'Equipments', value: 8620, color: '#F97316' },
]

const transactions = [
    { icon: ShoppingCart, label: 'Shopping', category: 'Archivos', time: '11 Minute Ago', amount: '$440', color: '#4361EE' },
    { icon: Apple, label: 'Apple', category: 'Equipment', time: '20 Minute Ago', amount: '$150', color: '#10B981' },
    { icon: CreditCard, label: 'Payment', category: 'Archivos', time: '30 Minute Ago', amount: '$253', color: '#8B5CF6' },
    { icon: Wrench, label: 'Tools', category: 'Equipment', time: '55 Minute Ago', amount: '$564', color: '#FBBF24' },
]

export function ExpenseStats() {
    const total = donutData.reduce((sum, item) => sum + item.value, 0)

    return (
        <div className="expense-stats">
            <div className="stats-header">
                <h3 className="stats-title">Expense Statistics</h3>
                <select className="stats-filter">
                    <option>This week</option>
                    <option>This month</option>
                    <option>This year</option>
                </select>
            </div>

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
                    <span className="donut-value">${total.toLocaleString()}</span>
                </div>
            </div>

            {/* Legend */}
            <div className="donut-legend">
                {donutData.map((item) => (
                    <div key={item.name} className="legend-item">
                        <span className="legend-dot" style={{ background: item.color }}></span>
                        <span>Expense for {item.name}</span>
                    </div>
                ))}
            </div>

            {/* Transactions List */}
            <div className="transactions-list">
                {transactions.map((tx) => (
                    <div key={tx.label} className="transaction-item">
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
        </div>
    )
}
