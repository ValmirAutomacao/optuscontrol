/**
 * Cliente para comunicação com o Backend FastAPI
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

interface ApiResponse<T> {
    data?: T
    error?: string
}

async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<ApiResponse<T>> {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers: {
                ...options.headers,
            },
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            return { error: errorData.detail || `Erro ${response.status}` }
        }

        const data = await response.json()
        return { data }
    } catch (error) {
        return { error: error instanceof Error ? error.message : 'Erro de conexão' }
    }
}

// ========== INVOICES ==========

export async function uploadInvoiceXML(file: File, companyId: string, projectId?: string) {
    const formData = new FormData()
    formData.append('file', file)

    let url = `/invoices/upload?company_id=${companyId}`
    if (projectId) url += `&project_id=${projectId}`

    return apiRequest<{
        success: boolean
        invoice: Record<string, unknown>
        payables_created: number
        items_count: number
    }>(url, {
        method: 'POST',
        body: formData,
    })
}

export async function listInvoices(companyId: string) {
    return apiRequest<Record<string, unknown>[]>(`/invoices?company_id=${companyId}`)
}

// ========== RECEIPTS ==========

export async function uploadReceiptImage(file: File, companyId: string, projectId?: string) {
    const formData = new FormData()
    formData.append('file', file)

    let url = `/receipts/upload?company_id=${companyId}`
    if (projectId) url += `&project_id=${projectId}`

    return apiRequest<{
        success: boolean
        receipt_id: string
        image_url: string
        ocr_result?: Record<string, unknown>
        ocr_error?: string
    }>(url, {
        method: 'POST',
        body: formData,
    })
}

export async function validateReceipt(
    receiptId: string,
    establishmentName?: string,
    totalAmount?: number
) {
    let url = `/receipts/${receiptId}/validate?`
    if (establishmentName) url += `establishment_name=${encodeURIComponent(establishmentName)}&`
    if (totalAmount !== undefined) url += `total_amount=${totalAmount}`

    return apiRequest<{ success: boolean }>(url, { method: 'POST' })
}

export async function listReceipts(companyId: string) {
    return apiRequest<Record<string, unknown>[]>(`/receipts?company_id=${companyId}`)
}

// ========== INDICATORS ==========

export async function getLatestIndicators(companyId: string) {
    return apiRequest<{
        current_liquidity: number
        general_liquidity: number
        equity_degree: number
        is_bidding_ready: boolean
    }>(`/indicators/latest?company_id=${companyId}`)
}

export async function getBiddingStatus(companyId: string) {
    return apiRequest<{
        is_ready: boolean
        current_liquidity: { value: number; required: number; ok: boolean }
        general_liquidity: { value: number; required: number; ok: boolean }
        equity_degree: { value: number; required: number; ok: boolean }
        issues: string[]
    }>(`/indicators/bidding-status?company_id=${companyId}`)
}
