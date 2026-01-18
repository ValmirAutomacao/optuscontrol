-- Migration: Add document type, number, and payment fields to receipts
-- Date: 2026-01-18

-- Adicionar novos campos à tabela receipts
ALTER TABLE receipts 
ADD COLUMN IF NOT EXISTS document_type VARCHAR(20) DEFAULT 'outro',
ADD COLUMN IF NOT EXISTS document_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS access_key VARCHAR(50),
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30),
ADD COLUMN IF NOT EXISTS payment_type VARCHAR(20) DEFAULT 'avista',
ADD COLUMN IF NOT EXISTS installments INTEGER DEFAULT 1;

-- Criar índices para busca
CREATE INDEX IF NOT EXISTS idx_receipts_document_type ON receipts(document_type);
CREATE INDEX IF NOT EXISTS idx_receipts_document_number ON receipts(document_number);

-- Adicionar campo receipt_id na tabela payables (para vincular despesas a contas a pagar)
ALTER TABLE payables 
ADD COLUMN IF NOT EXISTS receipt_id UUID REFERENCES receipts(id) ON DELETE SET NULL;

-- Comentários para documentação
COMMENT ON COLUMN receipts.document_type IS 'Tipo: nfce, nfe, recibo, comprovante, outro';
COMMENT ON COLUMN receipts.document_number IS 'Número do documento fiscal';
COMMENT ON COLUMN receipts.access_key IS 'Chave de acesso (44 dígitos para NFC-e/NF-e)';
COMMENT ON COLUMN receipts.payment_method IS 'Forma: pix, dinheiro, credito, debito, boleto';
COMMENT ON COLUMN receipts.payment_type IS 'Tipo: avista, parcelado';
COMMENT ON COLUMN receipts.installments IS 'Número de parcelas';
COMMENT ON COLUMN payables.receipt_id IS 'Referência ao cupom/despesa que gerou esta conta';
