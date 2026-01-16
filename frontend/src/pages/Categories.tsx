import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import './Categories.css'

interface Category {
    id: string
    name: string
    description: string
    icon: string
    color: string
    is_system: boolean
    is_active: boolean
}

const COMPANY_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

const iconOptions = [
    { value: 'fuel', label: '⛽ Combustível' },
    { value: 'hammer', label: '🔨 Construção' },
    { value: 'utensils', label: '🍽️ Alimentação' },
    { value: 'truck', label: '🚚 Transporte' },
    { value: 'wrench', label: '🔧 Equipamentos' },
    { value: 'briefcase', label: '💼 Serviços' },
    { value: 'file-text', label: '📄 Escritório' },
    { value: 'settings', label: '⚙️ Manutenção' },
    { value: 'zap', label: '⚡ Energia' },
    { value: 'more-horizontal', label: '📦 Outros' },
]

export function Categories() {
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [showAddModal, setShowAddModal] = useState(false)
    const [editingCategory, setEditingCategory] = useState<Category | null>(null)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
    const [formData, setFormData] = useState({ name: '', description: '', icon: 'more-horizontal' })

    useEffect(() => {
        fetchCategories()
    }, [])

    async function fetchCategories() {
        try {
            const { data, error } = await supabase
                .from('expense_categories')
                .select('*')
                .eq('is_active', true)
                .order('is_system', { ascending: false })
                .order('name')
            if (error) throw error
            setCategories(data || [])
        } catch (error) {
            console.error('Erro ao buscar categorias:', error)
        } finally {
            setLoading(false)
        }
    }

    async function handleAdd() {
        try {
            await supabase.from('expense_categories').insert({
                name: formData.name,
                description: formData.description,
                icon: formData.icon,
                company_id: COMPANY_ID,
                is_system: false,
                is_active: true
            })
            fetchCategories()
            setShowAddModal(false)
            setFormData({ name: '', description: '', icon: 'more-horizontal' })
        } catch (error) {
            console.error('Erro ao adicionar:', error)
        }
    }

    async function handleUpdate() {
        if (!editingCategory) return
        try {
            await supabase.from('expense_categories').update({
                name: formData.name,
                description: formData.description,
                icon: formData.icon
            }).eq('id', editingCategory.id)
            fetchCategories()
            setEditingCategory(null)
            setFormData({ name: '', description: '', icon: 'more-horizontal' })
        } catch (error) {
            console.error('Erro ao atualizar:', error)
        }
    }

    async function handleDelete(id: string) {
        try {
            await supabase.from('expense_categories').update({ is_active: false }).eq('id', id)
            fetchCategories()
            setShowDeleteConfirm(null)
        } catch (error) {
            console.error('Erro ao excluir:', error)
        }
    }

    function openEditModal(category: Category) {
        setFormData({ name: category.name, description: category.description || '', icon: category.icon || 'more-horizontal' })
        setEditingCategory(category)
    }

    const getIconEmoji = (icon: string) => {
        const found = iconOptions.find(o => o.value === icon)
        return found ? found.label.split(' ')[0] : '📦'
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Categorias de Despesas</h1>
                    <p className="page-subtitle">Gerencie as categorias para classificar suas despesas</p>
                </div>
                <button className="btn-primary" onClick={() => setShowAddModal(true)}>
                    <Plus size={18} />
                    Nova Categoria
                </button>
            </div>

            {/* Categories Grid */}
            <div className="categories-grid">
                {loading ? (
                    <div className="loading">Carregando...</div>
                ) : (
                    categories.map((category) => (
                        <div key={category.id} className={`category-card ${category.is_system ? 'system' : ''}`}>
                            <div className="category-icon">{getIconEmoji(category.icon)}</div>
                            <div className="category-info">
                                <h3>{category.name}</h3>
                                <p>{category.description || 'Sem descrição'}</p>
                                {category.is_system && <span className="system-badge">Padrão</span>}
                            </div>
                            {!category.is_system && (
                                <div className="category-actions">
                                    <button className="btn-icon" onClick={() => openEditModal(category)} title="Editar"><Edit size={16} /></button>
                                    <button className="btn-icon btn-icon--danger" onClick={() => setShowDeleteConfirm(category.id)} title="Excluir"><Trash2 size={16} /></button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Add Modal */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Nova Categoria</h2>
                            <button className="modal-close" onClick={() => setShowAddModal(false)}><X size={20} /></button>
                        </div>
                        <div className="edit-form">
                            <div className="form-group">
                                <label>Nome</label>
                                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Material de Limpeza" />
                            </div>
                            <div className="form-group">
                                <label>Descrição</label>
                                <input type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Descrição opcional" />
                            </div>
                            <div className="form-group">
                                <label>Ícone</label>
                                <select value={formData.icon} onChange={(e) => setFormData({ ...formData, icon: e.target.value })}>
                                    {iconOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                                </select>
                            </div>
                            <div className="form-actions">
                                <button className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancelar</button>
                                <button className="btn-primary" onClick={handleAdd} disabled={!formData.name}>Adicionar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingCategory && (
                <div className="modal-overlay" onClick={() => setEditingCategory(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Editar Categoria</h2>
                            <button className="modal-close" onClick={() => setEditingCategory(null)}><X size={20} /></button>
                        </div>
                        <div className="edit-form">
                            <div className="form-group">
                                <label>Nome</label>
                                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Descrição</label>
                                <input type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Ícone</label>
                                <select value={formData.icon} onChange={(e) => setFormData({ ...formData, icon: e.target.value })}>
                                    {iconOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                                </select>
                            </div>
                            <div className="form-actions">
                                <button className="btn-secondary" onClick={() => setEditingCategory(null)}>Cancelar</button>
                                <button className="btn-primary" onClick={handleUpdate}>Salvar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirm */}
            {showDeleteConfirm && (
                <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
                    <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header"><h2>Confirmar Exclusão</h2></div>
                        <p className="confirm-message">Tem certeza que deseja excluir esta categoria?</p>
                        <div className="form-actions">
                            <button className="btn-secondary" onClick={() => setShowDeleteConfirm(null)}>Cancelar</button>
                            <button className="btn-danger" onClick={() => handleDelete(showDeleteConfirm)}>Excluir</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
