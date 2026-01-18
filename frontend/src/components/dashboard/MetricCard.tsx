import type { ElementType } from 'react'
import './MetricCard.css'

interface MetricCardProps {
    label: string
    value: string
    change: string
    changeType: 'positive' | 'negative' | 'neutral'
    percentage: number
    icon: ElementType
    iconColor: 'blue' | 'yellow' | 'purple' | 'green'
}

export type { MetricCardProps }

export function MetricCard({
    label,
    value,
    change,
    changeType,
    percentage,
    icon: Icon,
    iconColor
}: MetricCardProps) {
    return (
        <div className="metric-card">
            <div className="metric-header">
                <span className="metric-label">{label}</span>
                <div className={`metric-icon metric-icon--${iconColor}`}>
                    <Icon size={20} color="white" />
                </div>
            </div>

            <div className="metric-value">{value}</div>

            <div className="metric-footer">
                <span className={`metric-change metric-change--${changeType}`}>
                    {changeType === 'positive' ? '↑' : changeType === 'negative' ? '↓' : '•'} {change}
                </span>
                <div className="metric-progress">
                    <div
                        className="metric-progress-fill"
                        style={{ width: `${percentage}%` }}
                    />
                    <span className="metric-percentage">{percentage}%</span>
                </div>
            </div>
        </div>
    )
}
