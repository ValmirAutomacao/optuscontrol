import { useState } from 'react'
import { Download, FileSpreadsheet, FileText, Calendar } from 'lucide-react'
import { usePermissions } from '../hooks/usePermissions'
import './Export.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

export function Export() {
    const { activeCompanyId } = usePermissions()
    const [startDate, setStartDate] = useState(() => {
        const d = new Date()
        d.setMonth(d.getMonth() - 1)
        return d.toISOString().split('T')[0]
    })
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
    const [loadingExcel, setLoadingExcel] = useState(false)
    const [loadingSped, setLoadingSped] = useState(false)
    const [loadingEfd, setLoadingEfd] = useState(false)
    const [includeInvoices, setIncludeInvoices] = useState(true)
    const [includeExpenses, setIncludeExpenses] = useState(true)

    async function downloadFile(endpoint: string, filename: string, setLoading: (v: boolean) => void) {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                company_id: activeCompanyId || '',
                start_date: startDate,
                end_date: endDate,
                include_invoices: includeInvoices.toString(),
                include_expenses: includeExpenses.toString()
            })

            const response = await fetch(`${API_URL}/export/${endpoint}?${params}`)
            if (!response.ok) throw new Error('Erro ao exportar')

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            window.URL.revokeObjectURL(url)
        } catch (error) {
            console.error('Erro:', error)
            alert('Erro ao exportar. Tente novamente.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Exportar para Contabilidade</h1>
                    <p className="page-subtitle">Gere planilhas e arquivos fiscais para enviar à contabilidade</p>
                </div>
            </div>

            {/* Period Selection */}
            <div className="export-card">
                <div className="card-header">
                    <Calendar size={20} />
                    <h2>Período</h2>
                </div>
                <div className="period-selector">
                    <div className="form-group">
                        <label>Data Início</label>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label>Data Fim</label>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </div>
                </div>
                <div className="filter-options">
                    <label className="checkbox-label">
                        <input type="checkbox" checked={includeInvoices} onChange={(e) => setIncludeInvoices(e.target.checked)} />
                        Incluir Notas Fiscais (Entradas)
                    </label>
                    <label className="checkbox-label">
                        <input type="checkbox" checked={includeExpenses} onChange={(e) => setIncludeExpenses(e.target.checked)} />
                        Incluir Despesas (Saídas)
                    </label>
                </div>
            </div>

            {/* Export Options */}
            <div className="export-grid">
                {/* Excel Export */}
                <div className="export-option">
                    <div className="export-icon excel">
                        <FileSpreadsheet size={32} />
                    </div>
                    <div className="export-info">
                        <h3>Planilha de Lançamentos</h3>
                        <p>Exporta todos os lançamentos no formato Excel para enviar à contabilidade</p>
                        <ul className="export-fields">
                            <li>DATA</li>
                            <li>ENTRADA/SAIDA</li>
                            <li>EMPRESA</li>
                            <li>NF</li>
                            <li>DATA EMISSÃO NF</li>
                            <li>DISCRIMINAÇÃO</li>
                            <li>VALOR R$</li>
                        </ul>
                    </div>
                    <button
                        className="btn-export btn-excel"
                        onClick={() => downloadFile('lancamentos', `lancamentos_${startDate}_${endDate}.xlsx`, setLoadingExcel)}
                        disabled={loadingExcel}
                    >
                        {loadingExcel ? 'Gerando...' : <><Download size={18} /> Exportar Excel</>}
                    </button>
                </div>

                {/* SPED Fiscal */}
                <div className="export-option">
                    <div className="export-icon sped">
                        <FileText size={32} />
                    </div>
                    <div className="export-info">
                        <h3>SPED Fiscal (EFD ICMS/IPI)</h3>
                        <p>Arquivo digital do Sistema Público de Escrituração Digital para obrigações de ICMS e IPI</p>
                        <ul className="export-fields">
                            <li>Bloco 0: Identificação</li>
                            <li>Bloco C: NF-e</li>
                            <li>Bloco E: Apuração ICMS</li>
                            <li>Bloco 9: Encerramento</li>
                        </ul>
                    </div>
                    <button
                        className="btn-export btn-sped"
                        onClick={() => downloadFile('sped-fiscal', `sped_fiscal_${startDate}_${endDate}.txt`, setLoadingSped)}
                        disabled={loadingSped}
                    >
                        {loadingSped ? 'Gerando...' : <><Download size={18} /> Exportar SPED</>}
                    </button>
                </div>

                {/* EFD Contribuições */}
                <div className="export-option">
                    <div className="export-icon efd">
                        <FileText size={32} />
                    </div>
                    <div className="export-info">
                        <h3>EFD Contribuições (PIS/COFINS)</h3>
                        <p>Escrituração Fiscal Digital das Contribuições - PIS/PASEP e COFINS</p>
                        <ul className="export-fields">
                            <li>Bloco 0: Identificação</li>
                            <li>Bloco C: NF-e</li>
                            <li>Bloco F: Outras Operações</li>
                            <li>Bloco M: Apuração PIS/COFINS</li>
                        </ul>
                    </div>
                    <button
                        className="btn-export btn-efd"
                        onClick={() => downloadFile('efd-contribuicoes', `efd_contribuicoes_${startDate}_${endDate}.txt`, setLoadingEfd)}
                        disabled={loadingEfd}
                    >
                        {loadingEfd ? 'Gerando...' : <><Download size={18} /> Exportar EFD</>}
                    </button>
                </div>
            </div>

            {/* Info Box */}
            <div className="info-box">
                <h4>ℹ️ Sobre os Arquivos Fiscais</h4>
                <p>
                    <strong>SPED Fiscal:</strong> Obrigação acessória mensal para empresas contribuintes de ICMS/IPI.
                    Contém informações sobre documentos fiscais, apuração de impostos e inventário.
                </p>
                <p>
                    <strong>EFD Contribuições:</strong> Escrituração mensal das contribuições PIS/PASEP e COFINS
                    para empresas do Lucro Real e Presumido.
                </p>
                <p className="warning">
                    ⚠️ Os arquivos gerados são modelos base. Consulte seu contador para validar
                    e complementar as informações antes de transmitir à Receita Federal.
                </p>
            </div>
        </div>
    )
}
