import { useState, useRef, useEffect } from 'react'
import { X, Camera, Image, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { uploadReceiptImage } from '../../lib/api'
import { useOfflineSync } from '../../hooks/useOfflineSync'
import { useAuth } from '../../hooks/useAuth'
import { db } from '../../lib/offlineDb'
import './UploadModal.css'

interface UploadReceiptModalProps {
    isOpen: boolean
    onClose: () => void
    companyId: string
    onSuccess: () => void
}

export function UploadReceiptModal({ isOpen, onClose, companyId, onSuccess }: UploadReceiptModalProps) {
    const { isOnline } = useOfflineSync()
    const { session } = useAuth()
    const [file, setFile] = useState<File | null>(null)
    const [preview, setPreview] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<{ success: boolean; message: string; data?: Record<string, unknown> } | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Limpar estado quando modal abre/fecha
    useEffect(() => {
        if (isOpen) {
            // Limpar tudo ao abrir
            setFile(null)
            setPreview(null)
            setResult(null)
            setLoading(false)
            // Limpar input de arquivo
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }, [isOpen])

    // Limpar URL do preview quando mudar
    useEffect(() => {
        return () => {
            if (preview) {
                URL.revokeObjectURL(preview)
            }
        }
    }, [preview])

    if (!isOpen) return null

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile && (selectedFile.type.startsWith('image/') || selectedFile.type === 'application/pdf')) {
            // Limpar preview anterior
            if (preview) {
                URL.revokeObjectURL(preview)
            }
            setFile(selectedFile)
            // Só criar preview para imagens
            if (selectedFile.type.startsWith('image/')) {
                setPreview(URL.createObjectURL(selectedFile))
            } else {
                setPreview(null)
            }
            setResult(null)
        } else {
            setResult({ success: false, message: 'Por favor, selecione uma imagem ou PDF' })
        }
    }

    const handleUpload = async () => {
        if (!file) return

        if (!isOnline) {
            // Modo Offline
            setLoading(true)
            try {
                const reader = new FileReader();
                const base64Promise = new Promise<string>((resolve) => {
                    reader.onload = () => resolve(reader.result as string);
                    reader.readAsDataURL(file);
                });
                const base64 = await base64Promise;

                await db.receipts.add({
                    company_id: companyId,
                    image_base64: base64,
                    status: 'pending_sync',
                    created_at: new Date().toISOString()
                });

                // Fechar imediatamente e notificar sucesso
                onSuccess()
                onClose()
            } catch (err) {
                setResult({ success: false, message: 'Erro ao salvar localmente' });
                setLoading(false)
            }
            return;
        }

        setLoading(true)
        setResult(null)

        const response = await uploadReceiptImage(file, companyId, session?.access_token)

        setLoading(false)

        if (response.error) {
            setResult({ success: false, message: response.error })
        } else if (response.data) {
            const ocr = response.data.ocr_result as Record<string, unknown> | undefined

            // Fechar modal imediatamente e atualizar lista
            onSuccess()
            onClose()

            // Se houver erro de OCR, poderia mostrar um toast (futuramente)
            // Por enquanto, o registro foi criado mesmo com erro de OCR
        }
    }

    const handleClose = () => {
        if (!loading) {
            onClose()
        }
    }

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Capturar Cupom Fiscal</h2>
                    <button className="modal-close" onClick={handleClose} disabled={loading}>
                        <X size={20} />
                    </button>
                </div>

                <div
                    className={`upload-dropzone ${file ? 'has-file' : ''}`}
                    onClick={() => !loading && fileInputRef.current?.click()}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,application/pdf"
                        capture="environment"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                        disabled={loading}
                    />

                    {preview ? (
                        <img src={preview} alt="Preview" className="image-preview" />
                    ) : file?.type === 'application/pdf' ? (
                        <>
                            <Image size={48} />
                            <p>{file.name}</p>
                            <span>PDF selecionado</span>
                        </>
                    ) : (
                        <>
                            <Camera size={48} />
                            <p>Tire uma foto ou selecione um arquivo</p>
                            <span>JPG, PNG, WebP ou PDF</span>
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
                    <button className="btn-secondary" onClick={handleClose} disabled={loading}>
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
                                <Image size={18} />
                                Processar
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
