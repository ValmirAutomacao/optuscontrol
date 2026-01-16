import { useState, useEffect } from 'react'
import { Plus, Search, DollarSign, Calendar, Eye, Pencil, Trash2, X, FolderKanban } from 'lucide-react'
import { usePermissions } from '../hooks/usePermissions'
import './Projects.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

interface Project {
    id: string
    name: string
    description?: string
    status: string
    budget?: number
    start_date?: string
    expected_end_date?: string
    actual_end_date?: string
    zip_code?: string
    address?: string
    address_number?: string
    neighborhood?: string
    city?: string
    state?: string
    created_at: string
}

export function Projects() {
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [editingProject, setEditingProject] = useState<Project | null>(null)
    const [viewingProject, setViewingProject] = useState<Project | null>(null)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

    const { activeCompanyId, session } = usePermissions()

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        status: 'active',
        budget: '',
        start_date: '',
        expected_end_date: '',
        zip_code: '',
        address: '',
        address_number: '',
        neighborhood: '',
        city: '',
        state: ''
    })
    const [_cepLoading, _setCepLoading] = useState(false)

    useEffect(() => {
        if (activeCompanyId && session?.access_token) {
            loadProjects()
        }
    }, [activeCompanyId, session])

    async function loadProjects() {
        if (!activeCompanyId) return
        try {
            const res = await fetch(`${API_URL}/projects?company_id=${activeCompanyId}`, {
                headers: { 'Authorization': `Bearer ${session?.access_token}` }
            })
            if (res.ok) {
                const data = await res.json()
                setProjects(Array.isArray(data) ? data : [])
            } else if (res.status === 401) {
                console.error('Não autorizado - Projetos')
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!activeCompanyId) return

        const projectData = {
            company_id: activeCompanyId,
            name: formData.name,
            description: formData.description || null,
            status: formData.status,
            budget: formData.budget ? parseFloat(formData.budget) : null,
            start_date: formData.start_date || null,
            expected_end_date: formData.expected_end_date || null,
            zip_code: formData.zip_code || null,
            address: formData.address || null,
            address_number: formData.address_number || null,
            neighborhood: formData.neighborhood || null,
            city: formData.city || null,
            state: formData.state || null
        }

        try {
            const url = editingProject
                ? `${API_URL}/projects/${editingProject.id}`
                : `${API_URL}/projects`

            const res = await fetch(url, {
                method: editingProject ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify(projectData)
            })

            if (res.ok) {
                loadProjects()
                closeModal()
            }
        } catch (e) {
            console.error(e)
        }
    }

    async function handleDelete(id: string) {
        try {
            const res = await fetch(`${API_URL}/projects/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${session?.access_token}` }
            })
            if (res.ok) {
                loadProjects()
                setShowDeleteConfirm(null)
            }
        } catch (e) {
            console.error(e)
        }
    }
    async function handleCepLookup() {
        const cep = formData.zip_code.replace(/\D/g, '')
        if (cep.length !== 8) return

        setCepLoading(true)
        try {
            const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
            const data = await res.json()
            if (!data.erro) {
                setFormData(prev => ({
                    ...prev,
                    address: data.logradouro,
                    neighborhood: data.bairro,
                    city: data.localidade,
                    state: data.uf
                }))
            }
        } catch (e) {
            console.error('Erro ao buscar CEP:', e)
        } finally {
            setCepLoading(false)
        }
    }
    function openCreateModal() {
        setEditingProject(null)
        setFormData({
            name: '', description: '', status: 'active', budget: '', start_date: '', expected_end_date: '',
            zip_code: '', address: '', address_number: '', neighborhood: '', city: '', state: ''
        })
        setShowModal(true)
    }

    function openEditModal(project: Project) {
        setEditingProject(project)
        setFormData({
            name: project.name,
            description: project.description || '',
            status: project.status,
            budget: project.budget?.toString() || '',
            start_date: project.start_date || '',
            expected_end_date: project.expected_end_date || '',
            zip_code: project.zip_code || '',
            address: project.address || '',
            address_number: project.address_number || '',
            neighborhood: project.neighborhood || '',
            city: project.city || '',
            state: project.state || ''
        })
        setShowModal(true)
    }

    function closeModal() {
        setShowModal(false)
        setEditingProject(null)
    }

    const filteredProjects = projects.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase())
    )

    const statusLabels: Record<string, string> = {
        active: 'Ativo',
        paused: 'Pausado',
        completed: 'Concluído',
        cancelled: 'Cancelado'
    }

    const stats = {
        total: projects.length,
        active: projects.filter(p => p.status === 'active').length,
        completed: projects.filter(p => p.status === 'completed').length,
        totalBudget: projects.reduce((sum, p) => sum + (p.budget || 0), 0)
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Projetos / Obras</h1>
                    <p className="page-subtitle">Gerencie seus projetos e acompanhe orçamentos</p>
                </div>
                <button className="btn-primary" onClick={openCreateModal}>
                    <Plus size={18} /> Novo Projeto/Obra
                </button>
            </div>

            {/* Stats */}
            <div className="stats-grid">
                <div className="stat-card">
                    <span className="stat-value">{stats.total}</span>
                    <span className="stat-label">Total de Projetos</span>
                </div>
                <div className="stat-card">
                    <span className="stat-value">{stats.active}</span>
                    <span className="stat-label">Em Andamento</span>
                </div>
                <div className="stat-card">
                    <span className="stat-value">{stats.completed}</span>
                    <span className="stat-label">Concluídos</span>
                </div>
                <div className="stat-card">
                    <span className="stat-value">R$ {stats.totalBudget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    <span className="stat-label">Orçamento Total</span>
                </div>
            </div>

            {/* Search */}
            <div className="filters-bar">
                <div className="search-input-wrapper">
                    <Search size={18} />
                    <input
                        placeholder="Buscar projetos..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Projects Grid */}
            <div className="projects-grid">
                {loading ? (
                    <p className="loading">Carregando...</p>
                ) : filteredProjects.length === 0 ? (
                    <div className="empty-state">
                        <FolderKanban size={48} />
                        <h3>Nenhum projeto encontrado</h3>
                        <p>Crie seu primeiro projeto para começar</p>
                    </div>
                ) : (
                    filteredProjects.map(project => (
                        <div key={project.id} className="project-card">
                            <div className="project-header">
                                <h3>{project.name}</h3>
                                <span className={`status-badge status--${project.status}`}>
                                    {statusLabels[project.status] || project.status}
                                </span>
                            </div>

                            {project.description && (
                                <p className="project-description">{project.description}</p>
                            )}

                            <div className="project-meta">
                                {project.budget && (
                                    <div className="meta-item">
                                        <DollarSign size={14} />
                                        <span>R$ {project.budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                )}
                                {project.start_date && (
                                    <div className="meta-item">
                                        <Calendar size={14} />
                                        <span>{new Date(project.start_date).toLocaleDateString('pt-BR')}</span>
                                    </div>
                                )}
                            </div>

                            <div className="project-actions">
                                <button className="btn-icon" onClick={() => setViewingProject(project)} title="Ver detalhes">
                                    <Eye size={16} />
                                </button>
                                <button className="btn-icon" onClick={() => openEditModal(project)} title="Editar">
                                    <Pencil size={16} />
                                </button>
                                <button className="btn-icon btn-icon--danger" onClick={() => setShowDeleteConfirm(project.id)} title="Excluir">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingProject ? 'Editar Projeto' : 'Novo Projeto'}</h2>
                            <button className="modal-close" onClick={closeModal}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="modal-body">
                            <div className="form-group">
                                <label>Nome do Projeto/Obra *</label>
                                <input
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <h3>Endereço do Projeto</h3>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>CEP</label>
                                    <div className="input-with-button">
                                        <input
                                            value={formData.zip_code}
                                            onChange={e => setFormData({ ...formData, zip_code: e.target.value })}
                                            onBlur={handleCepLookup}
                                            placeholder="00000-000"
                                        />
                                    </div>
                                </div>
                                <div className="form-group flex-2">
                                    <label>Logradouro</label>
                                    <input
                                        value={formData.address}
                                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Número</label>
                                    <input
                                        value={formData.address_number}
                                        onChange={e => setFormData({ ...formData, address_number: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Bairro</label>
                                    <input
                                        value={formData.neighborhood}
                                        onChange={e => setFormData({ ...formData, neighborhood: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group flex-2">
                                    <label>Cidade</label>
                                    <input
                                        value={formData.city}
                                        onChange={e => setFormData({ ...formData, city: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>UF</label>
                                    <input
                                        maxLength={2}
                                        value={formData.state}
                                        onChange={e => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                                    />
                                </div>
                            </div>

                            <h3>Informações Adicionais</h3>
                            <div className="form-group">
                                <label>Descrição</label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    rows={3}
                                />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Status</label>
                                    <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                                        <option value="active">Ativo</option>
                                        <option value="paused">Pausado</option>
                                        <option value="completed">Concluído</option>
                                        <option value="cancelled">Cancelado</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Orçamento (R$)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.budget}
                                        onChange={e => setFormData({ ...formData, budget: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Data Início</label>
                                    <input
                                        type="date"
                                        value={formData.start_date}
                                        onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Previsão de Término</label>
                                    <input
                                        type="date"
                                        value={formData.expected_end_date}
                                        onChange={e => setFormData({ ...formData, expected_end_date: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="form-actions">
                                <button type="button" className="btn-secondary" onClick={closeModal}>Cancelar</button>
                                <button type="submit" className="btn-primary">
                                    {editingProject ? 'Salvar Alterações' : 'Criar Projeto'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirm Modal */}
            {showDeleteConfirm && (
                <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
                    <div className="modal-content modal-small" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Confirmar Exclusão</h2>
                            <button className="modal-close" onClick={() => setShowDeleteConfirm(null)}><X size={20} /></button>
                        </div>
                        <div className="confirm-message">
                            <p>Tem certeza que deseja excluir este projeto?</p>
                            <p className="warning">Esta ação não pode ser desfeita.</p>
                        </div>
                        <div className="form-actions">
                            <button className="btn-secondary" onClick={() => setShowDeleteConfirm(null)}>Cancelar</button>
                            <button className="btn-danger" onClick={() => handleDelete(showDeleteConfirm)}>
                                <Trash2 size={16} /> Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* View Modal */}
            {viewingProject && (
                <div className="modal-overlay" onClick={() => setViewingProject(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{viewingProject.name}</h2>
                            <button className="modal-close" onClick={() => setViewingProject(null)}><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="detail-row">
                                <span className="detail-label">Status</span>
                                <span className={`status-badge status--${viewingProject.status}`}>
                                    {statusLabels[viewingProject.status]}
                                </span>
                            </div>
                            {viewingProject.description && (
                                <div className="detail-row">
                                    <span className="detail-label">Descrição</span>
                                    <span className="detail-value">{viewingProject.description}</span>
                                </div>
                            )}
                            {viewingProject.budget && (
                                <div className="detail-row">
                                    <span className="detail-label">Orçamento</span>
                                    <span className="detail-value font-bold">
                                        R$ {viewingProject.budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            )}
                            {viewingProject.start_date && (
                                <div className="detail-row">
                                    <span className="detail-label">Data Início</span>
                                    <span className="detail-value">{new Date(viewingProject.start_date).toLocaleDateString('pt-BR')}</span>
                                </div>
                            )}
                            {viewingProject.expected_end_date && (
                                <div className="detail-row">
                                    <span className="detail-label">Previsão Término</span>
                                    <span className="detail-value">{new Date(viewingProject.expected_end_date).toLocaleDateString('pt-BR')}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
