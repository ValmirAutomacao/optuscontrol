-- Migração: Tabelas de Medições e Provisões
-- Data: 2026-01-15

-- Tabela de Medições (Measurements)
CREATE TABLE IF NOT EXISTS measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    reference_month DATE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    status TEXT DEFAULT 'pending',  -- pending, approved, invoiced
    attachment_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_measurements_project_id ON measurements(project_id);
CREATE INDEX IF NOT EXISTS idx_measurements_company_id ON measurements(company_id);
CREATE INDEX IF NOT EXISTS idx_measurements_reference_month ON measurements(reference_month);

-- RLS
ALTER TABLE measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Measurements são visíveis pela empresa" ON measurements
    FOR SELECT USING (
        company_id IN (SELECT company_id FROM user_roles WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY "Gestores podem criar medições" ON measurements
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM user_roles 
            WHERE user_id = auth.uid() AND is_active = true 
            AND role IN ('owner', 'admin', 'manager')
        )
    );

CREATE POLICY "Gestores podem atualizar medições" ON measurements
    FOR UPDATE USING (
        company_id IN (
            SELECT company_id FROM user_roles 
            WHERE user_id = auth.uid() AND is_active = true 
            AND role IN ('owner', 'admin', 'manager')
        )
    );

-- Tabela de Provisões (Provisions)
CREATE TABLE IF NOT EXISTS provisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    supplier_name TEXT,
    expected_amount DECIMAL(15,2),
    expected_date DATE,
    matched_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending',  -- pending, matched, cancelled
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_provisions_project_id ON provisions(project_id);
CREATE INDEX IF NOT EXISTS idx_provisions_company_id ON provisions(company_id);
CREATE INDEX IF NOT EXISTS idx_provisions_status ON provisions(status);

-- RLS
ALTER TABLE provisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Provisions são visíveis pela empresa" ON provisions
    FOR SELECT USING (
        company_id IN (SELECT company_id FROM user_roles WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY "Gestores podem criar provisões" ON provisions
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM user_roles 
            WHERE user_id = auth.uid() AND is_active = true 
            AND role IN ('owner', 'admin', 'manager')
        )
    );

-- Tabela de Notificações
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    type TEXT NOT NULL,  -- payment_due, new_document, liquidity_alert, etc.
    title TEXT NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT false,
    action_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem apenas suas notificações" ON notifications
    FOR ALL USING (user_id = auth.uid());

-- Adicionar campos em projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget DECIMAL(15,2);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS expected_end_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS actual_end_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
