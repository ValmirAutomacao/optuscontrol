import { useState, useEffect } from 'react'
import {
    TrendingUp, Plus, Search, X, Edit, Trash2,
    FileText, CheckCircle, Clock, DollarSign
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useOfflineSync } from '../hooks/useOfflineSync'
import { db } from '../lib/offlineDb'
import './Measurements.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

interface Project {
    id: string
    name: string
    status: string
}

interface Measurement {
    id: string
    project_id: string
    measurement_number: number
    period_start: string
    period_end: string
    description?: string
    total_measured: number
    cumulative_percentage: number
    status: 'draft' | 'approved' | 'invoiced'
    created_at: string
    project?: Project
}

export function Measurements() {
    const { user } = useAuth()
    const { isOnline } = useOfflineSync()
    const [measurements, setMeasurements] = useState<Measurement[]>([])
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [filterProject, setFilterProject] = useState<string>('')
    const [showModal, setShowModal] = useState(false)
    const [editingMeasurement, setEditingMeasurement] = useState<Measurement | null>(null)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    const [formData, setFormData] = useState({
        project_id: '',
        period_start: '',
        period_end: '',
        description: '',
        total_measured: 0,
        cumulative_percentage: 0
    })

    const companyId = user?.user_metadata?.company_id || ''

    useEffect(() => {
        loadData()
    }, [companyId])

    async function loadData() {
        if (!companyId) return
        setLoading(true)

        try {
            // Load projects
            const projRes = await fetch(`${API_URL}/projects?company_id=${companyId}`)
            if (projRes.ok) {
                const data = await projRes.json()
                setProjects(data)
            }

            // Load measurements
            const measRes = await fetch(`${API_URL}/projects/measurements?company_id=${companyId}`)
            if (measRes.ok) {
                const data = await measRes.json()
                setMeasurements(data)
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setMessage(null)

        if (!isOnline && !editingMeasurement) {
            // Salvar Offline
            try {
                await db.measurements.add({
                    project_id: formData.project_id,
                    description: formData.description,
                    supplier_name: 'Manual (Offline)', // Simplificado para o exemplo
                    measurement_date: new Date().toISOString().split('T')[0],
                    status: 'pending_sync',
                    created_at: new Date().toISOString()
                })
                setMessage({ type: 'success', text: 'Salvo localmente! Será sincronizado quando o sinal voltar.' })
                setShowModal(false)
                resetForm()
                return
            } catch (err) {
                setMessage({ type: 'error', text: 'Erro ao salvar localmente' })
                return
            }
        }

        const url = editingMeasurement
            ? `${API_URL}/projects/measurements/${editingMeasurement.id}`
            : `${API_URL}/projects/measurements`

        try {
            const res = await fetch(url, {
                method: editingMeasurement ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    company_id: companyId
                })
            })

            if (res.ok) {
                setMessage({ type: 'success', text: editingMeasurement ? 'Medição atualizada!' : 'Medição criada!' })
                setShowModal(false)
                resetForm()
                loadData()
            } else {
                const err = await res.json()
                setMessage({ type: 'error', text: err.detail || 'Erro ao salvar' })
            }
        } catch (e) {
            if (!isOnline) {
                setMessage({ type: 'error', text: 'Você está offline. Tente novamente ou use o modo offline.' })
            } else {
                setMessage({ type: 'error', text: 'Erro de conexão' })
            }
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Excluir esta medição?')) return

        try {
            const res = await fetch(`${API_URL}/projects/measurements/${id}`, { method: 'DELETE' })
            if (res.ok) {
                setMessage({ type: 'success', text: 'Medição excluída!' })
                loadData()
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Erro ao excluir' })
        }
    }

    function resetForm() {
        setFormData({
            project_id: '',
            period_start: '',
            period_end: '',
            description: '',
            total_measured: 0,
            cumulative_percentage: 0
        })
        setEditingMeasurement(null)
    }

    function openEdit(m: Measurement) {
        setFormData({
            project_id: m.project_id,
            period_start: m.period_start,
            period_end: m.period_end,
            description: m.description || '',
            total_measured: m.total_measured,
            cumulative_percentage: m.cumulative_percentage
        })
        setEditingMeasurement(m)
        setShowModal(true)
    }

    function getStatusBadge(status: string) {
        const config: Record<string, { icon: React.ReactNode, label: string, class: string }> = {
            draft: { icon: <Clock size={14} />, label: 'Rascunho', class: 'status--draft' },
            approved: { icon: <CheckCircle size={14} />, label: 'Aprovada', class: 'status--approved' },
            invoiced: { icon: <FileText size={14} />, label: 'Faturada', class: 'status--invoiced' }
        }
        const c = config[status] || config.draft
        return <span className={`status-badge ${c.class}`}>{c.icon} {c.label}</span>
    }

    const filteredMeasurements = measurements.filter(m => {
        const matchSearch = m.description?.toLowerCase().includes(search.toLowerCase()) ||
            m.measurement_number.toString().includes(search)
        const matchProject = !filterProject || m.project_id === filterProject
        return matchSearch && matchProject
    })

    // Stats
    const totalMeasured = measurements.reduce((sum, m) => sum + m.total_measured, 0)
    const approvedCount = measurements.filter(m => m.status === 'approved').length
    const draftCount = measurements.filter(m => m.status === 'draft').length

    if (loading) {
        return <div className="page-container"><p>Carregando...</p></div>
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Medições</h1>
                    <p className="page-subtitle">Acompanhamento de medições por projeto/obra</p>
                </div>
                <button className="btn-primary" onClick={() => { resetForm(); setShowModal(true) }}>
                    <Plus size={18} /> Nova Medição
                </button>
            </div>

            {message && (
                <div className={`message message--${message.type}`}>
                    {message.text}
                    <button onClick={() => setMessage(null)}><X size={16} /></button>
                </div>
            )}

            {/* Stats */}
            <div className="stats-grid">
                <div className="stat-card">
                    <TrendingUp size={24} className="stat-icon" />
                    <div>
                        <span className="stat-value">{measurements.length}</span>
                        <span className="stat-label">Total de Medições</span>
                    </div>
                </div>
                <div className="stat-card">
                    <DollarSign size={24} className="stat-icon" />
                    <div>
                        <span className="stat-value">R$ {totalMeasured.toLocaleString('pt-BR')}</span>
                        <span className="stat-label">Total Medido</span>
                    </div>
                </div>
                <div className="stat-card">
                    <CheckCircle size={24} className="stat-icon stat-icon--success" />
                    <div>
                        <span className="stat-value">{approvedCount}</span>
                        <span className="stat-label">Aprovadas</span>
                    </div>
                </div>
                <div className="stat-card">
                    <Clock size={24} className="stat-icon stat-icon--warning" />
                    <div>
                        <span className="stat-value">{draftCount}</span>
                        <span className="stat-label">Rascunhos</span>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="filters-bar">
                <div className="search-input-wrapper">
                    <Search size={18} />
                    <input
                        placeholder="Buscar medições..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <select
                    className="filter-select"
                    value={filterProject}
                    onChange={e => setFilterProject(e.target.value)}
                >
                    <option value="">Todos os Projetos</option>
                    {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
            </div>

            {/* Table */}
            <div className="data-table">
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Projeto</th>
                            <th>Período</th>
                            <th>Descrição</th>
                            <th>Valor Medido</th>
                            <th>% Acumulado</th>
                            <th>Status</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredMeasurements.length === 0 ? (
                            <tr><td colSpan={8} className="empty">Nenhuma medição encontrada</td></tr>
                        ) : (
                            filteredMeasurements.map(m => {
                                const project = projects.find(p => p.id === m.project_id)
                                return (
                                    <tr key={m.id}>
                                        <td><strong>{m.measurement_number}</strong></td>
                                        <td>{project?.name || '-'}</td>
                                        <td>{new Date(m.period_start).toLocaleDateString('pt-BR')} - {new Date(m.period_end).toLocaleDateString('pt-BR')}</td>
                                        <td>{m.description || '-'}</td>
                                        <td className="value-cell">R$ {m.total_measured.toLocaleString('pt-BR')}</td>
                                        <td>
                                            <div className="progress-bar">
                                                <div className="progress-fill" style={{ width: `${Math.min(m.cumulative_percentage, 100)}%` }} />
                                                <span>{m.cumulative_percentage.toFixed(1)}%</span>
                                            </div>
                                        </td>
                                        <td>{getStatusBadge(m.status)}</td>
                                        <td className="actions">
                                            <button className="btn-icon" title="Editar" onClick={() => openEdit(m)}>
                                                <Edit size={16} />
                                            </button>
                                            <button className="btn-icon btn-icon--danger" title="Excluir" onClick={() => handleDelete(m.id)}>
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingMeasurement ? 'Editar Medição' : 'Nova Medição'}</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="modal-body">
                            <div className="form-group">
                                <label>Projeto *</label>
                                <select
                                    required
                                    value={formData.project_id}
                                    onChange={e => setFormData({ ...formData, project_id: e.target.value })}
                                >
                                    <option value="">Selecione...</option>
                                    {projects.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Período Início *</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.period_start}
                                        onChange={e => setFormData({ ...formData, period_start: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Período Fim *</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.period_end}
                                        onChange={e => setFormData({ ...formData, period_end: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Descrição</label>
                                <input
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Descrição da medição..."
                                />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Valor Medido (R$) *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={formData.total_measured}
                                        onChange={e => setFormData({ ...formData, total_measured: parseFloat(e.target.value) })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>% Acumulado</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        max="100"
                                        value={formData.cumulative_percentage}
                                        onChange={e => setFormData({ ...formData, cumulative_percentage: parseFloat(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <div className="form-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn-primary">{editingMeasurement ? 'Salvar' : 'Criar Medição'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
