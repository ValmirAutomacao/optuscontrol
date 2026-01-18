import { useState, useEffect } from 'react'
import { Receipt, Camera, Search, Filter, Eye, CheckCircle, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { UploadReceiptModal } from '../components/modals/UploadReceiptModal'
import { usePermissions } from '../hooks/usePermissions'
import './Receipts.css'

interface ReceiptItem {
    id: string
    image_url: string
    establishment_name: string
    establishment_cnpj: string
    receipt_date: string
    total_amount: number
    ocr_status: string
    ocr_confidence: number
    is_validated: boolean
    ocr_raw_response: {
        payment_method?: string
        items?: Array<{ description: string; quantity: number; total: number }>
    }
}

export function Receipts() {
    const { activeCompanyId } = usePermissions()
    const [receipts, setReceipts] = useState<ReceiptItem[]>([])
    const [loading, setLoading] = useState(true)
    const [showUploadModal, setShowUploadModal] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedReceipt, setSelectedReceipt] = useState<ReceiptItem | null>(null)

    useEffect(() => {
        if (activeCompanyId) {
            fetchReceipts()
        }
    }, [activeCompanyId])

    async function fetchReceipts() {
        if (!activeCompanyId) return
        try {
            const { data, error } = await supabase
                .from('receipts')
                .select('*')
                .eq('company_id', activeCompanyId)
                .order('created_at', { ascending: false })

            if (error) throw error
            setReceipts(data || [])
        } catch (error) {
            console.error('Erro ao buscar cupons:', error)
        } finally {
            setLoading(false)
        }
    }

    const filteredReceipts = receipts.filter(r =>
        r.establishment_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.establishment_cnpj?.includes(searchTerm)
    )

    const stats = {
        total: receipts.length,
        processed: receipts.filter(r => r.ocr_status === 'processed').length,
        validated: receipts.filter(r => r.is_validated).length,
        totalValue: receipts.reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0)
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Cupons Fiscais</h1>
                    <p className="page-subtitle">Capture e gerencie cupons fiscais via OCR</p>
                </div>
                <button className="btn-primary" onClick={() => setShowUploadModal(true)}>
                    <Camera size={18} />
                    Capturar Cupom
                </button>
            </div>

            {/* Stats Cards */}
            <div className="stats-grid">
                <div className="stat-card">
                    <span className="stat-value">{stats.total}</span>
                    <span className="stat-label">Total de Cupons</span>
                </div>
                <div className="stat-card">
                    <span className="stat-value">{stats.processed}</span>
                    <span className="stat-label">Processados</span>
                </div>
                <div className="stat-card">
                    <span className="stat-value">{stats.validated}</span>
                    <span className="stat-label">Validados</span>
                </div>
                <div className="stat-card">
                    <span className="stat-value">
                        R$ {stats.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="stat-label">Valor Total</span>
                </div>
            </div>

            {/* Filters */}
            <div className="filters-bar">
                <div className="search-input-wrapper">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por estabelecimento ou CNPJ..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button className="btn-filter">
                    <Filter size={18} />
                    Filtros
                </button>
            </div>

            {/* Table */}
            <div className="table-container">
                {loading ? (
                    <div className="table-loading">Carregando...</div>
                ) : filteredReceipts.length === 0 ? (
                    <div className="table-empty">
                        <Receipt size={48} />
                        <h3>Nenhum cupom encontrado</h3>
                        <p>Capture um cupom fiscal para ver os dados aqui</p>
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Estabelecimento</th>
                                <th>CNPJ</th>
                                <th>Data</th>
                                <th>Forma Pgto</th>
                                <th>Valor Total</th>
                                <th>Confiança</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredReceipts.map((receipt) => (
                                <tr key={receipt.id}>
                                    <td className="font-medium">
                                        {receipt.establishment_name || 'Não identificado'}
                                    </td>
                                    <td className="text-muted">
                                        {receipt.establishment_cnpj || '-'}
                                    </td>
                                    <td>
                                        {receipt.receipt_date
                                            ? new Date(receipt.receipt_date).toLocaleDateString('pt-BR')
                                            : '-'}
                                    </td>
                                    <td>
                                        {receipt.ocr_raw_response?.payment_method || '-'}
                                    </td>
                                    <td className="font-medium">
                                        R$ {Number(receipt.total_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td>
                                        <span className={`confidence-badge ${Number(receipt.ocr_confidence) >= 0.8 ? 'high' : Number(receipt.ocr_confidence) >= 0.5 ? 'medium' : 'low'}`}>
                                            {(Number(receipt.ocr_confidence) * 100).toFixed(0)}%
                                        </span>
                                    </td>
                                    <td>
                                        {receipt.is_validated ? (
                                            <span className="status-badge status-badge--validated">
                                                <CheckCircle size={14} /> Validado
                                            </span>
                                        ) : receipt.ocr_status === 'processed' ? (
                                            <span className="status-badge status-badge--pending">
                                                Aguardando
                                            </span>
                                        ) : (
                                            <span className="status-badge status-badge--error">
                                                <XCircle size={14} /> Erro
                                            </span>
                                        )}
                                    </td>
                                    <td>
                                        <button
                                            className="btn-icon"
                                            onClick={() => setSelectedReceipt(receipt)}
                                            title="Ver detalhes"
                                        >
                                            <Eye size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Detail Modal */}
            {selectedReceipt && (
                <div className="modal-overlay" onClick={() => setSelectedReceipt(null)}>
                    <div className="modal-content modal-wide" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Detalhes do Cupom</h2>
                            <button className="modal-close" onClick={() => setSelectedReceipt(null)}>×</button>
                        </div>
                        <div className="receipt-detail">
                            <div className="receipt-detail-grid">
                                <div className="detail-image">
                                    {selectedReceipt.image_url && (
                                        <img src={selectedReceipt.image_url} alt="Cupom" />
                                    )}
                                </div>
                                <div className="detail-info">
                                    <div className="detail-row">
                                        <span className="detail-label">Estabelecimento:</span>
                                        <span className="detail-value">{selectedReceipt.establishment_name || 'Não identificado'}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">CNPJ:</span>
                                        <span className="detail-value">{selectedReceipt.establishment_cnpj || '-'}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">Data:</span>
                                        <span className="detail-value">
                                            {selectedReceipt.receipt_date
                                                ? new Date(selectedReceipt.receipt_date).toLocaleDateString('pt-BR')
                                                : '-'}
                                        </span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">Forma de Pagamento:</span>
                                        <span className="detail-value">{selectedReceipt.ocr_raw_response?.payment_method || '-'}</span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">Valor Total:</span>
                                        <span className="detail-value font-bold">
                                            R$ {Number(selectedReceipt.total_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className="detail-row">
                                        <span className="detail-label">Confiança OCR:</span>
                                        <span className="detail-value">{(Number(selectedReceipt.ocr_confidence) * 100).toFixed(0)}%</span>
                                    </div>

                                    {selectedReceipt.ocr_raw_response?.items && selectedReceipt.ocr_raw_response.items.length > 0 && (
                                        <div className="detail-items">
                                            <h4>Itens</h4>
                                            <table className="items-table">
                                                <thead>
                                                    <tr>
                                                        <th>Descrição</th>
                                                        <th>Qtd</th>
                                                        <th>Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {selectedReceipt.ocr_raw_response.items.map((item, idx) => (
                                                        <tr key={idx}>
                                                            <td>{item.description}</td>
                                                            <td>{item.quantity}</td>
                                                            <td>R$ {Number(item.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    <div className="detail-actions">
                                        {!selectedReceipt.is_validated && (
                                            <button className="btn-primary">
                                                <CheckCircle size={18} /> Validar Cupom
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Upload Modal */}
            <UploadReceiptModal
                isOpen={showUploadModal}
                onClose={() => setShowUploadModal(false)}
                companyId={activeCompanyId || ''}
                onSuccess={fetchReceipts}
            />
        </div>
    )
}
