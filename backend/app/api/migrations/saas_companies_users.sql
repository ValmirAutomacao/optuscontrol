-- Migração: Campos adicionais na tabela companies para modelo SaaS
-- Data: 2026-01-15

-- Adicionar campos de cadastro completo da empresa
ALTER TABLE companies ADD COLUMN IF NOT EXISTS fantasy_name TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS state_registration TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS municipal_registration TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS address_number TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS address_complement TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS neighborhood TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS city_code TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS zip_code TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Dados do contador responsável
ALTER TABLE companies ADD COLUMN IF NOT EXISTS accountant_name TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS accountant_crc TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS accountant_cpf TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS accountant_email TEXT;

-- Controle de assinatura SaaS
ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'free';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS max_users INTEGER DEFAULT 3;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS max_storage_mb INTEGER DEFAULT 500;

-- Tabela de roles de usuários (vínculo usuário-empresa)
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'operator',
  is_active BOOLEAN DEFAULT true,
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_company_id ON user_roles(company_id);

-- Tabela de permissões por role
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,
  module TEXT NOT NULL,
  can_create BOOLEAN DEFAULT false,
  can_read BOOLEAN DEFAULT true,
  can_update BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  can_export BOOLEAN DEFAULT false,
  UNIQUE(role, module)
);

-- Inserir permissões padrão
INSERT INTO role_permissions (role, module, can_create, can_read, can_update, can_delete, can_export) VALUES
  -- Owner: tudo
  ('owner', 'companies', true, true, true, true, true),
  ('owner', 'users', true, true, true, true, true),
  ('owner', 'invoices', true, true, true, true, true),
  ('owner', 'receipts', true, true, true, true, true),
  ('owner', 'payables', true, true, true, true, true),
  ('owner', 'projects', true, true, true, true, true),
  ('owner', 'export', true, true, true, true, true),
  
  -- Admin: tudo exceto companies/delete
  ('admin', 'companies', false, true, true, false, true),
  ('admin', 'users', true, true, true, true, true),
  ('admin', 'invoices', true, true, true, true, true),
  ('admin', 'receipts', true, true, true, true, true),
  ('admin', 'payables', true, true, true, true, true),
  ('admin', 'projects', true, true, true, true, true),
  ('admin', 'export', true, true, true, true, true),
  
  -- Accountant: leitura e exportação
  ('accountant', 'companies', false, true, false, false, true),
  ('accountant', 'users', false, true, false, false, false),
  ('accountant', 'invoices', false, true, false, false, true),
  ('accountant', 'receipts', false, true, false, false, true),
  ('accountant', 'payables', false, true, false, false, true),
  ('accountant', 'projects', false, true, false, false, true),
  ('accountant', 'export', true, true, true, true, true),
  
  -- Manager: CRUD projetos e despesas
  ('manager', 'companies', false, true, false, false, false),
  ('manager', 'users', false, true, false, false, false),
  ('manager', 'invoices', true, true, true, false, false),
  ('manager', 'receipts', true, true, true, false, false),
  ('manager', 'payables', true, true, true, false, false),
  ('manager', 'projects', true, true, true, false, false),
  ('manager', 'export', false, true, false, false, false),
  
  -- Operator: apenas upload
  ('operator', 'companies', false, true, false, false, false),
  ('operator', 'users', false, false, false, false, false),
  ('operator', 'invoices', true, true, false, false, false),
  ('operator', 'receipts', true, true, false, false, false),
  ('operator', 'payables', false, true, false, false, false),
  ('operator', 'projects', false, true, false, false, false),
  ('operator', 'export', false, false, false, false, false)
ON CONFLICT (role, module) DO NOTHING;

-- RLS para user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver seus próprios roles" ON user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins podem gerenciar roles da empresa" ON user_roles
  FOR ALL USING (
    company_id IN (
      SELECT ur.company_id FROM user_roles ur 
      WHERE ur.user_id = auth.uid() AND ur.role IN ('owner', 'admin')
    )
  );
