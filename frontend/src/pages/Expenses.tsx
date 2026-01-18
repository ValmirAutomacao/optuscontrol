import { useState, useEffect } from 'react'
import { Receipt, Camera, Search, Filter, Eye, Edit, Trash2, CheckCircle, XCircle, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { UploadReceiptModal } from '../components/modals/UploadReceiptModal'
import { usePermissions } from '../hooks/usePermissions'
import './Expenses.css'

interface ExpenseItem {
    id: string
    image_url: string
    establishment_name: string
    establishment_cnpj: string
    receipt_date: string
    total_amount: number
    ocr_status: string
    ocr_confidence: number
    is_validated: boolean
    category_id: string
    ocr_raw_response: {
        payment_method?: string
        items?: Array<{ description: string; quantity: number; total: number }>
    }
}

interface Category {
    id: string
    name: string
    icon: string
}

export function Expenses() {
    const { activeCompanyId } = usePermissions()
    const [expenses, setExpenses] = useState<ExpenseItem[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [showUploadModal, setShowUploadModal] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedExpense, setSelectedExpense] = useState<ExpenseItem | null>(null)
    const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

    useEffect(() => {
        if (activeCompanyId) {
            fetchExpenses()
            fetchCategories()
        }
    }, [activeCompanyId])

    async function fetchExpenses() {
        if (!activeCompanyId) return
        try {
            const { data, error } = await supabase
                .from('receipts')
                .select('*')
                .eq('company_id', activeCompanyId)
                .order('created_at', { ascending: false })
            if (error) throw error
            setExpenses(data || [])
        } catch (error) {
            console.error('Erro ao buscar despesas:', error)
        } finally {
            setLoading(false)
        }
    }

    async function fetchCategories() {
        try {
            const { data } = await supabase
                .from('expense_categories')
                .select('*')
                .eq('is_active', true)
                .order('name')
            setCategories(data || [])
        } catch (error) {
            console.error('Erro ao buscar categorias:', error)
        }
    }

    async function handleValidate(expense: ExpenseItem, categoryId?: string) {
        try {
            const updateData: Record<string, unknown> = { is_validated: true }
            if (categoryId) updateData.category_id = categoryId

            await supabase
                .from('receipts')
                .update(updateData)
                .eq('id', expense.id)

            fetchExpenses()
            setSelectedExpense(null)
        } catch (error) {
            console.error('Erro ao validar:', error)
        }
    }

    async function handleDelete(id: string) {
        try {
            await supabase.from('receipts').delete().eq('id', id)
            fetchExpenses()
            setShowDeleteConfirm(null)
            setSelectedExpense(null)
        } catch (error) {
            console.error('Erro ao excluir:', error)
        }
    }

    async function handleSaveEdit(expense: ExpenseItem) {
        try {
            await supabase
                .from('receipts')
                .update({
                    establishment_name: expense.establishment_name,
                    establishment_cnpj: expense.establishment_cnpj,
                    total_amount: expense.total_amount,
                    receipt_date: expense.receipt_date,
                    category_id: expense.category_id
                })
                .eq('id', expense.id)

            fetchExpenses()
            setEditingExpense(null)
        } catch (error) {
            console.error('Erro ao salvar:', error)
        }
    }

    const filteredExpenses = expenses.filter(e =>
        e.establishment_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.establishment_cnpj?.includes(searchTerm)
    )

    const stats = {
        total: expenses.length,
        processed: expenses.filter(e => e.ocr_status === 'processed').length,
        validated: expenses.filter(e => e.is_validated).length,
        totalValue: expenses.reduce((sum, e) => sum + (Number(e.total_amount) || 0), 0)
    }

    const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || '-'

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Despesas</h1>
                    <p className="page-subtitle">Capture e gerencie despesas via OCR</p>
                </div>
                <button className="btn-primary" onClick={() => setShowUploadModal(true)}>
                    <Camera size={18} />
                    Nova Despesa
                </button>
            </div>

            {/* Stats */}
            <div className="stats-grid">
                <div className="stat-card"><span className="stat-value">{stats.total}</span><span className="stat-label">Total</span></div>
                <div className="stat-card"><span className="stat-value">{stats.processed}</span><span className="stat-label">Processadas</span></div>
                <div className="stat-card"><span className="stat-value">{stats.validated}</span><span className="stat-label">Validadas</span></div>
                <div className="stat-card"><span className="stat-value">R$ {stats.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span><span className="stat-label">Valor Total</span></div>
            </div>

            {/* Filters */}
            <div className="filters-bar">
                <div className="search-input-wrapper">
                    <Search size={18} />
                    <input type="text" placeholder="Buscar por estabelecimento..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <button className="btn-filter"><Filter size={18} /> Filtros</button>
            </div>

            {/* Table */}
            <div className="table-container">
                {loading ? (
                    <div className="table-loading">Carregando...</div>
                ) : filteredExpenses.length === 0 ? (
                    <div className="table-empty">
                        <Receipt size={48} />
                        <h3>Nenhuma despesa encontrada</h3>
                        <p>Capture uma despesa para começar</p>
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Estabelecimento</th>
                                <th>CNPJ</th>
                                <th>Data</th>
                                <th>Categoria</th>
                                <th>Valor</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredExpenses.map((expense) => (
                                <tr key={expense.id} className="clickable-row" onClick={() => setSelectedExpense(expense)}>
                                    <td className="font-medium">{expense.establishment_name || 'Não identificado'}</td>
                                    <td className="text-muted">{expense.establishment_cnpj || '-'}</td>
                                    <td>{expense.receipt_date ? new Date(expense.receipt_date).toLocaleDateString('pt-BR') : '-'}</td>
                                    <td>{getCategoryName(expense.category_id)}</td>
                                    <td className="font-medium">R$ {Number(expense.total_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                    <td>
                                        {expense.is_validated ? (
                                            <span className="status-badge status-badge--validated"><CheckCircle size={14} /> Validada</span>
                                        ) : expense.ocr_status === 'processed' ? (
                                            <span className="status-badge status-badge--pending">Aguardando</span>
                                        ) : (
                                            <span className="status-badge status-badge--error"><XCircle size={14} /> Erro</span>
                                        )}
                                    </td>
                                    <td onClick={(e) => e.stopPropagation()}>
                                        <div className="action-buttons">
                                            <button className="btn-icon" onClick={() => setSelectedExpense(expense)} title="Visualizar"><Eye size={18} /></button>
                                            <button className="btn-icon" onClick={() => setEditingExpense(expense)} title="Editar"><Edit size={18} /></button>
                                            <button className="btn-icon btn-icon--danger" onClick={() => setShowDeleteConfirm(expense.id)} title="Excluir"><Trash2 size={18} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* View Modal */}
            {selectedExpense && !editingExpense && (
                <div className="modal-overlay" onClick={() => setSelectedExpense(null)}>
                    <div className="modal-content modal-wide" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Detalhes da Despesa</h2>
                            <button className="modal-close" onClick={() => setSelectedExpense(null)}><X size={20} /></button>
                        </div>
                        <div className="expense-detail">
                            <div className="expense-detail-grid">
                                <div className="detail-image">
                                    {selectedExpense.image_url && <img src={selectedExpense.image_url} alt="Despesa" />}
                                </div>
                                <div className="detail-info">
                                    <div className="detail-row"><span className="detail-label">Estabelecimento:</span><span className="detail-value">{selectedExpense.establishment_name || 'Não identificado'}</span></div>
                                    <div className="detail-row"><span className="detail-label">CNPJ:</span><span className="detail-value">{selectedExpense.establishment_cnpj || '-'}</span></div>
                                    <div className="detail-row"><span className="detail-label">Data:</span><span className="detail-value">{selectedExpense.receipt_date ? new Date(selectedExpense.receipt_date).toLocaleDateString('pt-BR') : '-'}</span></div>
                                    <div className="detail-row"><span className="detail-label">Forma Pagamento:</span><span className="detail-value">{selectedExpense.ocr_raw_response?.payment_method || '-'}</span></div>
                                    <div className="detail-row"><span className="detail-label">Categoria:</span><span className="detail-value">{getCategoryName(selectedExpense.category_id)}</span></div>
                                    <div className="detail-row"><span className="detail-label">Valor Total:</span><span className="detail-value font-bold">R$ {Number(selectedExpense.total_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                                    <div className="detail-row"><span className="detail-label">Confiança OCR:</span><span className="detail-value">{(Number(selectedExpense.ocr_confidence) * 100).toFixed(0)}%</span></div>

                                    {selectedExpense.ocr_raw_response?.items && selectedExpense.ocr_raw_response.items.length > 0 && (
                                        <div className="detail-items">
                                            <h4>Itens</h4>
                                            <table className="items-table">
                                                <thead><tr><th>Descrição</th><th>Qtd</th><th>Total</th></tr></thead>
                                                <tbody>
                                                    {selectedExpense.ocr_raw_response.items.map((item, idx) => (
                                                        <tr key={idx}><td>{item.description}</td><td>{item.quantity}</td><td>R$ {Number(item.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    <div className="detail-actions">
                                        {!selectedExpense.is_validated && (
                                            <>
                                                <select
                                                    className="category-select"
                                                    onChange={(e) => handleValidate(selectedExpense, e.target.value)}
                                                    defaultValue=""
                                                >
                                                    <option value="" disabled>Selecione categoria e valide</option>
                                                    {categories.map(cat => (
                                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                    ))}
                                                </select>
                                                <button className="btn-primary" onClick={() => handleValidate(selectedExpense)}>
                                                    <CheckCircle size={18} /> Validar Despesa
                                                </button>
                                            </>
                                        )}
                                        <button className="btn-secondary" onClick={() => { setEditingExpense(selectedExpense); setSelectedExpense(null); }}>
                                            <Edit size={18} /> Editar
                                        </button>
                                        <button className="btn-danger" onClick={() => setShowDeleteConfirm(selectedExpense.id)}>
                                            <Trash2 size={18} /> Excluir
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingExpense && (
                <div className="modal-overlay" onClick={() => setEditingExpense(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Editar Despesa</h2>
                            <button className="modal-close" onClick={() => setEditingExpense(null)}><X size={20} /></button>
                        </div>
                        <div className="edit-form">
                            <div className="form-group">
                                <label>Estabelecimento</label>
                                <input type="text" value={editingExpense.establishment_name || ''} onChange={(e) => setEditingExpense({ ...editingExpense, establishment_name: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>CNPJ</label>
                                <input type="text" value={editingExpense.establishment_cnpj || ''} onChange={(e) => setEditingExpense({ ...editingExpense, establishment_cnpj: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Data</label>
                                <input type="date" value={editingExpense.receipt_date || ''} onChange={(e) => setEditingExpense({ ...editingExpense, receipt_date: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Valor Total</label>
                                <input type="number" step="0.01" value={editingExpense.total_amount || 0} onChange={(e) => setEditingExpense({ ...editingExpense, total_amount: parseFloat(e.target.value) })} />
                            </div>
                            <div className="form-group">
                                <label>Categoria</label>
                                <select value={editingExpense.category_id || ''} onChange={(e) => setEditingExpense({ ...editingExpense, category_id: e.target.value })}>
                                    <option value="">Selecione...</option>
                                    {categories.map(cat => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
                                </select>
                            </div>
                            <div className="form-actions">
                                <button className="btn-secondary" onClick={() => setEditingExpense(null)}>Cancelar</button>
                                <button className="btn-primary" onClick={() => handleSaveEdit(editingExpense)}>Salvar</button>
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
                        <p className="confirm-message">Tem certeza que deseja excluir esta despesa? Esta ação não pode ser desfeita.</p>
                        <div className="form-actions">
                            <button className="btn-secondary" onClick={() => setShowDeleteConfirm(null)}>Cancelar</button>
                            <button className="btn-danger" onClick={() => handleDelete(showDeleteConfirm)}>Excluir</button>
                        </div>
                    </div>
                </div>
            )}

            <UploadReceiptModal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} companyId={activeCompanyId || ''} onSuccess={fetchExpenses} />
        </div>
    )
}
