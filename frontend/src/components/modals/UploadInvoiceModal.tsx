import { useState, useRef, useEffect } from 'react'
import { X, Upload, FileText, Camera, Loader2, CheckCircle, AlertCircle, Building2 } from 'lucide-react'
import { uploadInvoiceXML, uploadInvoiceImage } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import './UploadModal.css'

interface Project {
    id: string
    name: string
}

interface UploadInvoiceModalProps {
    isOpen: boolean
    onClose: () => void
    companyId: string
    onSuccess: () => void
}

export function UploadInvoiceModal({ isOpen, onClose, companyId, onSuccess }: UploadInvoiceModalProps) {
    const { session } = useAuth()
    const [file, setFile] = useState<File | null>(null)
    const [fileType, setFileType] = useState<'xml' | 'image' | null>(null)
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Estado para projetos/obras
    const [projects, setProjects] = useState<Project[]>([])
    const [selectedProjectId, setSelectedProjectId] = useState<string>('')
    const [loadingProjects, setLoadingProjects] = useState(false)

    // Buscar projetos quando modal abre
    useEffect(() => {
        if (isOpen && companyId) {
            fetchProjects()
            // Limpar estado
            setFile(null)
            setFileType(null)
            setResult(null)
            setSelectedProjectId('')
        }
    }, [isOpen, companyId])

    async function fetchProjects() {
        setLoadingProjects(true)
        try {
            const { data } = await supabase
                .from('projects')
                .select('id, name')
                .eq('company_id', companyId)
                .eq('status', 'active')
                .order('name')
            setProjects(data || [])
        } catch (error) {
            console.error('Erro ao buscar projetos:', error)
        } finally {
            setLoadingProjects(false)
        }
    }

    if (!isOpen) return null

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (!selectedFile) return

        const isXml = selectedFile.name.endsWith('.xml')
        const isImage = selectedFile.type.startsWith('image/')
        const isPdf = selectedFile.type === 'application/pdf'

        if (isXml) {
            setFile(selectedFile)
            setFileType('xml')
            setResult(null)
        } else if (isImage || isPdf) {
            setFile(selectedFile)
            setFileType('image')
            setResult(null)
        } else {
            setResult({ success: false, message: 'Selecione um arquivo XML, imagem ou PDF' })
        }
    }

    const handleUpload = async () => {
        if (!file) return

        // Validar projeto selecionado
        if (!selectedProjectId) {
            setResult({ success: false, message: 'Selecione uma obra/projeto' })
            return
        }

        setLoading(true)
        setResult(null)

        try {
            if (fileType === 'xml') {
                const response = await uploadInvoiceXML(file, companyId, selectedProjectId)
                if (response.error) {
                    setResult({ success: false, message: response.error })
                } else if (response.data) {
                    setResult({
                        success: true,
                        message: `NF-e processada! ${response.data.items_count} itens, ${response.data.payables_created} parcelas criadas.`
                    })
                    setTimeout(() => {
                        onSuccess()
                        onClose()
                    }, 2000)
                }
            } else {
                // Upload de imagem/PDF com OCR
                const response = await uploadInvoiceImage(file, companyId, session?.access_token, selectedProjectId)
                if (response.error) {
                    setResult({ success: false, message: response.error })
                } else if (response.data) {
                    setResult({
                        success: true,
                        message: `NF-e processada via OCR! Confiança: ${Math.round((response.data.ocr_confidence || 0) * 100)}%`
                    })
                    setTimeout(() => {
                        onSuccess()
                        onClose()
                    }, 2000)
                }
            }
        } catch (err) {
            setResult({ success: false, message: 'Erro ao processar. Tente novamente.' })
        } finally {
            setLoading(false)
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        const droppedFile = e.dataTransfer.files[0]
        if (!droppedFile) return

        const isXml = droppedFile.name.endsWith('.xml')
        const isImage = droppedFile.type.startsWith('image/')
        const isPdf = droppedFile.type === 'application/pdf'

        if (isXml) {
            setFile(droppedFile)
            setFileType('xml')
            setResult(null)
        } else if (isImage || isPdf) {
            setFile(droppedFile)
            setFileType('image')
            setResult(null)
        } else {
            setResult({ success: false, message: 'Arraste um arquivo XML, imagem ou PDF' })
        }
    }

    const canUpload = file && selectedProjectId && !loading

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Upload de NF-e</h2>
                    <button className="modal-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* Seletor de Projeto/Obra - OBRIGATÓRIO */}
                <div className="upload-project-select">
                    <label>
                        <Building2 size={16} />
                        Obra/Projeto <span className="required">*</span>
                    </label>
                    <select
                        value={selectedProjectId}
                        onChange={(e) => setSelectedProjectId(e.target.value)}
                        disabled={loading || loadingProjects}
                        className={!selectedProjectId && file ? 'error' : ''}
                    >
                        <option value="">
                            {loadingProjects ? 'Carregando...' : 'Selecione a obra/projeto'}
                        </option>
                        {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>

                <div
                    className={`upload-dropzone ${file ? 'has-file' : ''}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xml,image/*,application/pdf"
                        capture="environment"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                    />

                    {file ? (
                        <>
                            {fileType === 'xml' ? <FileText size={48} /> : <Camera size={48} />}
                            <p className="file-name">{file.name}</p>
                            <p className="file-size">
                                {(file.size / 1024).toFixed(2)} KB
                                {fileType === 'image' && ' • Será processado via OCR'}
                            </p>
                        </>
                    ) : (
                        <>
                            <Upload size={48} />
                            <p>Arraste o arquivo aqui ou clique para selecionar</p>
                            <span>XML, Imagem ou PDF</span>
                        </>
                    )}
                </div>

                {result && (
                    <div className={`upload-result ${result.success ? 'success' : 'error'}`}>
                        {result.success ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                        <span>{result.message}</span>
                    </div>
                )}

                <div className="modal-footer">
                    <button className="btn-secondary" onClick={onClose}>
                        Cancelar
                    </button>
                    <button
                        className="btn-primary"
                        onClick={handleUpload}
                        disabled={!canUpload}
                    >
                        {loading ? (
                            <>
                                <Loader2 size={18} className="spin" />
                                Processando...
                            </>
                        ) : (
                            <>
                                <Upload size={18} />
                                Enviar
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
