import { useState, useRef } from 'react'
import { X, Camera, Image, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { uploadReceiptImage } from '../../lib/api'
import { useOfflineSync } from '../../hooks/useOfflineSync'
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
    const [file, setFile] = useState<File | null>(null)
    const [preview, setPreview] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<{ success: boolean; message: string; data?: Record<string, unknown> } | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    if (!isOpen) return null

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile && selectedFile.type.startsWith('image/')) {
            setFile(selectedFile)
            setPreview(URL.createObjectURL(selectedFile))
            setResult(null)
        } else {
            setResult({ success: false, message: 'Por favor, selecione uma imagem' })
        }
    }

    const handleUpload = async () => {
        if (!file) return

        if (!isOnline) {
            // Modo Offline
            setLoading(true)
            try {
                // Converter arquivo para base64 para armazenar no Dexie
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

                setResult({
                    success: true,
                    message: 'Cupom salvo localmente! O OCR será processado quando o sinal voltar.'
                });

                setTimeout(() => {
                    onSuccess()
                    onClose()
                }, 3000)
            } catch (err) {
                setResult({ success: false, message: 'Erro ao salvar localmente' });
            } finally {
                setLoading(false)
            }
            return;
        }

        setLoading(true)
        setResult(null)

        const response = await uploadReceiptImage(file, companyId)

        if (response.error) {
            setResult({ success: false, message: response.error })
        } else if (response.data) {
            const ocr = response.data.ocr_result as Record<string, unknown> | undefined
            if (ocr && !response.data.ocr_error) {
                setResult({
                    success: true,
                    message: `OCR concluído! Estabelecimento: ${ocr.establishment_name || 'Não identificado'}, Valor: R$ ${ocr.total_amount || '0,00'}`,
                    data: ocr
                })
            } else {
                setResult({
                    success: false,
                    message: response.data.ocr_error as string || 'Erro no OCR'
                })
            }
            setTimeout(() => {
                onSuccess()
                onClose()
            }, 3000)
        }

        setLoading(false)
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Capturar Cupom Fiscal</h2>
                    <button className="modal-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div
                    className={`upload-dropzone ${file ? 'has-file' : ''}`}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                    />

                    {preview ? (
                        <img src={preview} alt="Preview" className="image-preview" />
                    ) : (
                        <>
                            <Camera size={48} />
                            <p>Tire uma foto ou selecione uma imagem</p>
                            <span>JPG, PNG ou WebP</span>
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
                                Processando OCR...
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
