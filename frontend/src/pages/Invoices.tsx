import { useState, useEffect } from 'react'
import { FileText, Upload, Search, Filter, Eye, Edit, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { UploadInvoiceModal } from '../components/modals/UploadInvoiceModal'
import { usePermissions } from '../hooks/usePermissions'
import './Invoices.css'

interface Invoice {
    id: string
    number: string
    supplier_name: string
    supplier_cnpj: string
    issue_date: string
    due_date: string
    total_value: number
    status: string
    xml_url: string
    parsed_data: {
        items?: Array<{ description: string; quantity: number; unit_price: number; total: number }>
        payment_method?: string
    }
}

export function Invoices() {
    const { activeCompanyId } = usePermissions()
    const [invoices, setInvoices] = useState<Invoice[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [showUploadModal, setShowUploadModal] = useState(false)
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
    const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

    useEffect(() => {
        fetchInvoices()
    }, [])

    async function fetchInvoices() {
        try {
            const { data, error } = await supabase
                .from('invoices')
                .select('*')
                .order('created_at', { ascending: false })
            if (error) throw error
            setInvoices(data || [])
        } catch (error) {
            console.error('Erro ao buscar notas:', error)
        } finally {
            setLoading(false)
        }
    }

    async function handleDelete(id: string) {
        try {
            await supabase.from('invoices').delete().eq('id', id)
            fetchInvoices()
            setShowDeleteConfirm(null)
            setSelectedInvoice(null)
        } catch (error) {
            console.error('Erro ao excluir:', error)
        }
    }

    async function handleSaveEdit(invoice: Invoice) {
        try {
            await supabase
                .from('invoices')
                .update({
                    number: invoice.number,
                    supplier_name: invoice.supplier_name,
                    supplier_cnpj: invoice.supplier_cnpj,
                    issue_date: invoice.issue_date,
                    total_value: invoice.total_value,
                    status: invoice.status
                })
                .eq('id', invoice.id)
            fetchInvoices()
            setEditingInvoice(null)
        } catch (error) {
            console.error('Erro ao salvar:', error)
        }
    }

    const filteredInvoices = invoices.filter(inv =>
        inv.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.number?.includes(searchTerm)
    )

    const stats = {
        total: invoices.length,
        processed: invoices.filter(i => i.status === 'processed').length,
        totalValue: invoices.reduce((sum, i) => sum + (Number(i.total_value) || 0), 0)
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Notas Fiscais (NF-e)</h1>
                    <p className="page-subtitle">Gerencie as notas fiscais da empresa</p>
                </div>
                <button className="btn-primary" onClick={() => setShowUploadModal(true)}>
                    <Upload size={18} />
                    Upload XML
                </button>
            </div>

            {/* Stats */}
            <div className="stats-grid stats-3">
                <div className="stat-card"><span className="stat-value">{stats.total}</span><span className="stat-label">Total de NF-e</span></div>
                <div className="stat-card"><span className="stat-value">{stats.processed}</span><span className="stat-label">Processadas</span></div>
                <div className="stat-card"><span className="stat-value">R$ {stats.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span><span className="stat-label">Valor Total</span></div>
            </div>

            {/* Filters */}
            <div className="filters-bar">
                <div className="search-input-wrapper">
                    <Search size={18} />
                    <input type="text" placeholder="Buscar por fornecedor ou número..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <button className="btn-filter"><Filter size={18} /> Filtros</button>
            </div>

            {/* Table */}
            <div className="table-container">
                {loading ? (
                    <div className="table-loading">Carregando...</div>
                ) : filteredInvoices.length === 0 ? (
                    <div className="table-empty">
                        <FileText size={48} />
                        <h3>Nenhuma nota fiscal encontrada</h3>
                        <p>Faça upload de um arquivo XML para começar</p>
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Número</th>
                                <th>Fornecedor</th>
                                <th>CNPJ</th>
                                <th>Data Emissão</th>
                                <th>Valor Total</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredInvoices.map((invoice) => (
                                <tr key={invoice.id} className="clickable-row" onClick={() => setSelectedInvoice(invoice)}>
                                    <td className="font-medium">{invoice.number}</td>
                                    <td>{invoice.supplier_name}</td>
                                    <td className="text-muted">{invoice.supplier_cnpj}</td>
                                    <td>{invoice.issue_date ? new Date(invoice.issue_date).toLocaleDateString('pt-BR') : '-'}</td>
                                    <td className="font-medium">R$ {Number(invoice.total_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                    <td>
                                        <span className={`status-badge status-badge--${invoice.status}`}>
                                            {invoice.status === 'processed' ? 'Processada' : invoice.status === 'pending' ? 'Pendente' : invoice.status}
                                        </span>
                                    </td>
                                    <td onClick={(e) => e.stopPropagation()}>
                                        <div className="action-buttons">
                                            <button className="btn-icon" onClick={() => setSelectedInvoice(invoice)} title="Visualizar"><Eye size={18} /></button>
                                            <button className="btn-icon" onClick={() => setEditingInvoice(invoice)} title="Editar"><Edit size={18} /></button>
                                            <button className="btn-icon btn-icon--danger" onClick={() => setShowDeleteConfirm(invoice.id)} title="Excluir"><Trash2 size={18} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* View Modal */}
            {selectedInvoice && !editingInvoice && (
                <div className="modal-overlay" onClick={() => setSelectedInvoice(null)}>
                    <div className="modal-content modal-wide" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Detalhes da NF-e #{selectedInvoice.number}</h2>
                            <button className="modal-close" onClick={() => setSelectedInvoice(null)}><X size={20} /></button>
                        </div>
                        <div className="invoice-detail">
                            <div className="detail-grid-2col">
                                <div className="detail-section">
                                    <h3>Dados da Nota</h3>
                                    <div className="detail-row"><span className="detail-label">Número:</span><span className="detail-value">{selectedInvoice.number}</span></div>
                                    <div className="detail-row"><span className="detail-label">Data Emissão:</span><span className="detail-value">{selectedInvoice.issue_date ? new Date(selectedInvoice.issue_date).toLocaleDateString('pt-BR') : '-'}</span></div>
                                    <div className="detail-row"><span className="detail-label">Valor Total:</span><span className="detail-value font-bold">R$ {Number(selectedInvoice.total_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                                    <div className="detail-row"><span className="detail-label">Status:</span><span className="detail-value">{selectedInvoice.status === 'processed' ? 'Processada' : 'Pendente'}</span></div>
                                </div>
                                <div className="detail-section">
                                    <h3>Fornecedor</h3>
                                    <div className="detail-row"><span className="detail-label">Nome:</span><span className="detail-value">{selectedInvoice.supplier_name}</span></div>
                                    <div className="detail-row"><span className="detail-label">CNPJ:</span><span className="detail-value">{selectedInvoice.supplier_cnpj}</span></div>
                                </div>
                            </div>

                            {selectedInvoice.parsed_data?.items && selectedInvoice.parsed_data.items.length > 0 && (
                                <div className="detail-items">
                                    <h3>Itens da Nota</h3>
                                    <table className="items-table">
                                        <thead><tr><th>Descrição</th><th>Qtd</th><th>Valor Unit.</th><th>Total</th></tr></thead>
                                        <tbody>
                                            {selectedInvoice.parsed_data.items.map((item, idx) => (
                                                <tr key={idx}>
                                                    <td>{item.description}</td>
                                                    <td>{item.quantity}</td>
                                                    <td>R$ {Number(item.unit_price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                                    <td>R$ {Number(item.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <div className="detail-actions">
                                <button className="btn-secondary" onClick={() => { setEditingInvoice(selectedInvoice); setSelectedInvoice(null); }}>
                                    <Edit size={18} /> Editar
                                </button>
                                <button className="btn-danger" onClick={() => setShowDeleteConfirm(selectedInvoice.id)}>
                                    <Trash2 size={18} /> Excluir
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingInvoice && (
                <div className="modal-overlay" onClick={() => setEditingInvoice(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Editar NF-e</h2>
                            <button className="modal-close" onClick={() => setEditingInvoice(null)}><X size={20} /></button>
                        </div>
                        <div className="edit-form">
                            <div className="form-group">
                                <label>Número</label>
                                <input type="text" value={editingInvoice.number || ''} onChange={(e) => setEditingInvoice({ ...editingInvoice, number: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Fornecedor</label>
                                <input type="text" value={editingInvoice.supplier_name || ''} onChange={(e) => setEditingInvoice({ ...editingInvoice, supplier_name: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>CNPJ</label>
                                <input type="text" value={editingInvoice.supplier_cnpj || ''} onChange={(e) => setEditingInvoice({ ...editingInvoice, supplier_cnpj: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Data Emissão</label>
                                <input type="date" value={editingInvoice.issue_date || ''} onChange={(e) => setEditingInvoice({ ...editingInvoice, issue_date: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Valor Total</label>
                                <input type="number" step="0.01" value={editingInvoice.total_value || 0} onChange={(e) => setEditingInvoice({ ...editingInvoice, total_value: parseFloat(e.target.value) })} />
                            </div>
                            <div className="form-group">
                                <label>Status</label>
                                <select value={editingInvoice.status || ''} onChange={(e) => setEditingInvoice({ ...editingInvoice, status: e.target.value })}>
                                    <option value="pending">Pendente</option>
                                    <option value="processed">Processada</option>
                                </select>
                            </div>
                            <div className="form-actions">
                                <button className="btn-secondary" onClick={() => setEditingInvoice(null)}>Cancelar</button>
                                <button className="btn-primary" onClick={() => handleSaveEdit(editingInvoice)}>Salvar</button>
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
                        <p className="confirm-message">Tem certeza que deseja excluir esta nota fiscal? Esta ação não pode ser desfeita.</p>
                        <div className="form-actions">
                            <button className="btn-secondary" onClick={() => setShowDeleteConfirm(null)}>Cancelar</button>
                            <button className="btn-danger" onClick={() => handleDelete(showDeleteConfirm)}>Excluir</button>
                        </div>
                    </div>
                </div>
            )}

            <UploadInvoiceModal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} companyId={activeCompanyId || ''} onSuccess={fetchInvoices} />
        </div>
    )
}
