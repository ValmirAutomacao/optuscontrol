import { useState, useRef } from 'react'
import { X, Upload, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { uploadInvoiceXML } from '../../lib/api'
import './UploadModal.css'

interface UploadInvoiceModalProps {
    isOpen: boolean
    onClose: () => void
    companyId: string
    onSuccess: () => void
}

export function UploadInvoiceModal({ isOpen, onClose, companyId, onSuccess }: UploadInvoiceModalProps) {
    const [file, setFile] = useState<File | null>(null)
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    if (!isOpen) return null

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile && selectedFile.name.endsWith('.xml')) {
            setFile(selectedFile)
            setResult(null)
        } else {
            setResult({ success: false, message: 'Por favor, selecione um arquivo XML' })
        }
    }

    const handleUpload = async () => {
        if (!file) return

        setLoading(true)
        setResult(null)

        const response = await uploadInvoiceXML(file, companyId)

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

        setLoading(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        const droppedFile = e.dataTransfer.files[0]
        if (droppedFile && droppedFile.name.endsWith('.xml')) {
            setFile(droppedFile)
            setResult(null)
        } else {
            setResult({ success: false, message: 'Por favor, arraste um arquivo XML' })
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Upload de NF-e (XML)</h2>
                    <button className="modal-close" onClick={onClose}>
                        <X size={20} />
                    </button>
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
                        accept=".xml"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                    />

                    {file ? (
                        <>
                            <FileText size={48} />
                            <p className="file-name">{file.name}</p>
                            <p className="file-size">{(file.size / 1024).toFixed(2)} KB</p>
                        </>
                    ) : (
                        <>
                            <Upload size={48} />
                            <p>Arraste o arquivo XML aqui ou clique para selecionar</p>
                            <span>Apenas arquivos .xml</span>
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
                        disabled={!file || loading}
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
