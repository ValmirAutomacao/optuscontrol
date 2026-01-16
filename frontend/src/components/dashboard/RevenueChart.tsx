import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'
import './RevenueChart.css'

const data = [
    { year: '2020', target: 100000, achieved: 50000, percentTarget: 50, percentAchieved: 50 },
    { year: '2021', target: 120000, achieved: 48000, percentTarget: 40, percentAchieved: 40 },
    { year: '2022', target: 150000, achieved: 82500, percentTarget: 55, percentAchieved: 55 },
    { year: '2023', target: 100000, achieved: 100000, percentTarget: 70, percentAchieved: 100, highlight: true },
    { year: '2024', target: 180000, achieved: 126000, percentTarget: 70, percentAchieved: 70 },
    { year: '2025', target: 200000, achieved: 130000, percentTarget: 66, percentAchieved: 65 },
]

export function RevenueChart() {
    return (
        <div className="revenue-chart">
            <div className="chart-header">
                <h3 className="chart-title">Revenue Evaluation</h3>
                <div className="chart-legend">
                    <span className="legend-item">
                        <span className="legend-dot legend-dot--blue"></span>
                        Target
                    </span>
                    <span className="legend-item">
                        <span className="legend-dot legend-dot--yellow"></span>
                        Achieved
                    </span>
                    <span className="legend-item">
                        <span className="legend-dot legend-dot--outline"></span>
                        Yearly
                    </span>
                </div>
            </div>

            <div className="chart-container">
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data} barGap={8}>
                        <XAxis
                            dataKey="year"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#6B7280', fontSize: 12 }}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#6B7280', fontSize: 12 }}
                            tickFormatter={(value) => `$${value / 1000}k`}
                        />
                        <Tooltip
                            contentStyle={{
                                background: '#1A1D21',
                                border: 'none',
                                borderRadius: '8px',
                                color: 'white'
                            }}
                        />
                        <Bar dataKey="target" radius={[8, 8, 0, 0]} maxBarSize={40}>
                            {data.map((_entry, index) => (
                                <Cell key={`target-${index}`} fill="#4361EE" />
                            ))}
                            <LabelList
                                dataKey="percentTarget"
                                position="center"
                                fill="white"
                                fontSize={11}
                                fontWeight={600}
                                formatter={(value: any) => `${value}%`}
                            />
                        </Bar>
                        <Bar dataKey="achieved" radius={[8, 8, 0, 0]} maxBarSize={40}>
                            {data.map((entry, index) => (
                                <Cell
                                    key={`achieved-${index}`}
                                    fill={entry.highlight ? '#FBBF24' : '#4361EE'}
                                />
                            ))}
                            <LabelList
                                dataKey="percentAchieved"
                                position="center"
                                fill="white"
                                fontSize={11}
                                fontWeight={600}
                                formatter={(value: any) => `${value}%`}
                            />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
