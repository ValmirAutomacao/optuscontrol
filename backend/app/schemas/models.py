from pydantic import BaseModel
from typing import List, Optional
from datetime import date, datetime

# ====== Invoices ======

class InvoiceItem(BaseModel):
    sequence: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    ncm: Optional[str] = None
    cfop: Optional[str] = None
    unit: Optional[str] = None
    quantity: float = 0
    unit_price: float = 0
    total: float = 0

class InvoicePayment(BaseModel):
    number: Optional[str] = None
    due_date: Optional[str] = None
    amount: float = 0

class InvoiceCreate(BaseModel):
    company_id: str
    project_id: Optional[str] = None
    access_key: Optional[str] = None
    number: str
    series: Optional[str] = None
    supplier_cnpj: str
    supplier_name: str
    supplier_state: Optional[str] = None
    issue_date: date
    total_products: float = 0
    total_services: float = 0
    total_value: float
    icms_value: float = 0
    ipi_value: float = 0
    items: List[InvoiceItem] = []
    payments: List[InvoicePayment] = []

class InvoiceResponse(BaseModel):
    id: str
    company_id: str
    number: str
    supplier_name: str
    supplier_cnpj: str
    issue_date: date
    total_value: float
    status: str

# ====== Receipts ======

class ReceiptItem(BaseModel):
    description: str
    quantity: float = 1
    unit_price: float = 0
    total: float = 0

class ReceiptCreate(BaseModel):
    company_id: str
    project_id: Optional[str] = None
    image_url: str
    establishment_name: Optional[str] = None
    establishment_cnpj: Optional[str] = None
    receipt_date: Optional[date] = None
    total_amount: Optional[float] = None
    items: List[ReceiptItem] = []
    ocr_confidence: float = 0

class ReceiptResponse(BaseModel):
    id: str
    image_url: str
    establishment_name: Optional[str]
    receipt_date: Optional[date]
    total_amount: Optional[float]
    ocr_status: str
    is_validated: bool

# ====== Payables ======

class PayableCreate(BaseModel):
    company_id: str
    project_id: Optional[str] = None
    invoice_id: Optional[str] = None
    description: str
    supplier_name: str
    supplier_cnpj: Optional[str] = None
    due_date: date
    amount: float
    account_category: Optional[str] = None
    is_provision: bool = False

class PayableResponse(BaseModel):
    id: str
    description: str
    supplier_name: str
    due_date: date
    amount: float
    status: str
    payment_date: Optional[date]

# ====== Financial Indicators ======

class FinancialIndicatorsCreate(BaseModel):
    company_id: str
    reference_date: date
    current_assets: float = 0
    non_current_assets: float = 0
    current_liabilities: float = 0
    non_current_liabilities: float = 0
    equity: float = 0
    gross_revenue: float = 0
    net_revenue: float = 0
    net_profit: float = 0

class FinancialIndicatorsResponse(BaseModel):
    id: str
    reference_date: date
    current_liquidity: float
    general_liquidity: float
    equity_degree: float
    is_bidding_ready: bool
