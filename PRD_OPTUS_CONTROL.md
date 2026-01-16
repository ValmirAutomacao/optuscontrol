# PRD Optus Control

Sistema de Gestão Financeira e Conformidade para Licitações

---

## 1. Visão Geral

### 1.1 Objetivo
Sistema mobile-first para empresas de engenharia organizarem documentação fiscal/financeira, gerarem balanços patrimoniais e DREs, e garantirem conformidade para licitações públicas (Leis 14.133/21 e 8.666/93).

### 1.2 Problema Resolvido
- Desorganização documental (NFs, cupons, medições dispersos)
- Desclassificação em licitações (falta de índices de liquidez)
- Gargalo contador-empresa (informações chegam tarde)
- Despesas de campo (cupons fiscais perdidos)

### 1.3 Público-Alvo
| Perfil | Descrição |
|--------|-----------|
| Empresas de engenharia | Cliente pagante |
| Contadores | Usuário estratégico |
| Gestores de obra | Usuário operacional (mobile) |

---

## 2. Stack Tecnológica

```
┌─────────────────────────────────────────────┐
│          Frontend (React + Vite)            │
│  - Web Dashboard (Admin/Contador)           │
│  - Mobile App (Capacitor - iOS/Android)     │
└──────────────────┬──────────────────────────┘
                   │ API REST
┌──────────────────▼──────────────────────────┐
│       Backend (Python + FastAPI)            │
│  - Parser XML (NF-e)                        │
│  - OCR Cupons (Gemini Vision)               │
│  - Cálculo de Índices                       │
│  - Exportações Contábeis                    │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│         Supabase (BaaS)                     │
│  - PostgreSQL (Dados)                       │
│  - Auth (JWT + RLS)                         │
│  - Storage (Fotos/XMLs/PDFs)                │
│  - Realtime (WebSockets)                    │
└─────────────────────────────────────────────┘
```

| Camada | Tecnologia |
|--------|------------|
| Frontend Web | React 18 + Vite + Tailwind CSS |
| Frontend Mobile | Capacitor 6 |
| Backend | Python 3.11 + FastAPI |
| Banco de Dados | Supabase (PostgreSQL 15) |
| IA/OCR | Google Gemini 2.0 Flash |
| Automação | n8n (self-hosted) |

---

## 3. Design System (Baseado no Finova)

### 3.1 Layout Principal

```
┌───────────┬──────────────────────────────────────────────────────────┐
│  SIDEBAR  │  TopBar: Search | Icons | Avatar                         │
│  (escura) ├──────────────────────────────────────────────────────────┤
│           │  [Card 1] [Card 2] [Card 3] [Card 4]  ← 4 Métricas       │
│  Menu     ├──────────────────────────┬───────────────────────────────┤
│  Support  │  Revenue Evaluation      │  Expense Statistics          │
│  CTA Card │  (Bar Chart com badges)  │  (Donut + Lista transações)  │
│  Logout   ├──────────────────────────┴───────────────────────────────┤
│           │  [Total Income]  [Total Payment]  ← Mini charts          │
└───────────┴──────────────────────────────────────────────────────────┘
```

### 3.2 Paleta de Cores

```css
/* Cores Principais */
--primary-blue: #4361EE;
--secondary-yellow: #FBBF24;
--success-green: #10B981;
--error-red: #EF4444;
--accent-orange: #F97316;

/* Fundos */
--bg-main: #F8F9FC;
--bg-card: #FFFFFF;
--sidebar-bg: #1A1D21;
--sidebar-hover: #2A2D32;
--sidebar-active: #4361EE;

/* Textos */
--text-primary: #1A1D21;
--text-secondary: #6B7280;
--text-muted: #9CA3AF;
--text-white: #FFFFFF;
```

### 3.3 Tipografia

```css
--font-family: 'Inter', sans-serif;

/* Valores grandes (cards) */
--text-value: 600 28px/1.2;

/* Labels pequenos */
--text-label: 500 12px/1.4;

/* Títulos de seção */
--text-title: 600 16px/1.3;

/* Texto normal */
--text-body: 400 14px/1.5;
```

### 3.4 Componentes Principais

#### Sidebar (220px, escura)
- Logo "Optus Control" em branco
- Menu com ícones (Dashboard, Performance, Statistics, Analytics, Payments)
- Badge vermelho para notificações
- CTA Card verde no rodapé ("Build future wealth...")
- Botão Logout vermelho

#### Cards de Métricas (4 no topo)
```
┌────────────────────────────────┐
│ [Label cinza]            [●]   │  ← Círculo gradiente
│ $4,50,000                      │  ← Valor bold 28px
│ 🟢 +6% From last week    [78%] │  ← Variação + progress
└────────────────────────────────┘
```

#### Gráfico de Barras (Revenue Evaluation)
- Barras azuis (#4361EE) e amarelas (#FBBF24)
- Border-radius 8px no topo
- Labels internos ("50%", "55%", "70%")
- Badge "100%" preto sobre barra destaque
- Legenda: ● Target ● Achieved ● Yearly

#### Donut Chart (Expense Statistics)
- 2 cores: Azul + Laranja
- Valor central bold ($14,052)
- Legenda abaixo

#### Lista de Transações
```
[🛒] Shopping    [Archivos]    $440
     11 Minute Ago
```

---

## 4. Schema do Banco de Dados

### 4.1 Tabelas Principais

```sql
-- Multi-tenancy
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cnpj TEXT UNIQUE NOT NULL,
  subscription_plan TEXT DEFAULT 'trial',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  company_id UUID REFERENCES companies(id),
  full_name TEXT NOT NULL,
  role TEXT NOT NULL, -- admin, accountant, operator, viewer
  is_active BOOLEAN DEFAULT true
);

-- Obras/Projetos
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  budget DECIMAL(15,2)
);

-- Notas Fiscais (NF-e)
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  project_id UUID REFERENCES projects(id),
  access_key TEXT UNIQUE,
  number TEXT NOT NULL,
  supplier_cnpj TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  issue_date DATE NOT NULL,
  total_value DECIMAL(15,2) NOT NULL,
  xml_file_url TEXT,
  status TEXT DEFAULT 'pending'
);

-- Contas a Pagar
CREATE TABLE payables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  invoice_id UUID REFERENCES invoices(id),
  description TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  due_date DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  status TEXT DEFAULT 'pending'
);

-- Cupons Fiscais (OCR)
CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  project_id UUID REFERENCES projects(id),
  image_url TEXT NOT NULL,
  establishment_name TEXT,
  total_amount DECIMAL(15,2),
  ocr_status TEXT DEFAULT 'pending',
  ocr_confidence DECIMAL(3,2),
  is_validated BOOLEAN DEFAULT false
);

-- Índices Financeiros
CREATE TABLE financial_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  reference_date DATE NOT NULL,
  current_liquidity DECIMAL(5,2),  -- LC
  general_liquidity DECIMAL(5,2),  -- LG
  equity_degree DECIMAL(5,2),       -- GE
  is_bidding_ready BOOLEAN DEFAULT false
);
```

---

## 5. Módulos Funcionais

### 5.1 Módulo A: OCR de Cupons Fiscais

```
[App Mobile] Foto → [Backend] Gemini Vision → [Validação] → [Payable]
```

**Prompt Gemini:**
```
Analise este cupom fiscal e retorne JSON:
{
  "establishment_name": "...",
  "establishment_cnpj": "...",
  "receipt_date": "YYYY-MM-DD",
  "total_amount": 0.00,
  "items": [...],
  "confidence": 0.95
}
```

### 5.2 Módulo B: Parser XML (NF-e)

```
[Upload XML] → [Parse lxml] → [Invoice] → [Payables automáticos]
```

### 5.3 Módulo C: Medições e Matching

```
[Provisão] + [NF chegou] → [Matching automático por CNPJ + valor + data]
```

### 5.4 Módulo D: Índices de Liquidez

```python
LC = Ativo_Circulante / Passivo_Circulante      # >= 1.0
LG = (AC + ANC) / (PC + PNC)                     # >= 1.0
GE = (PC + PNC) / Patrimônio_Líquido             # <= 1.0
```

### 5.5 Módulo E: Exportações

| Formato | Descrição |
|---------|-----------|
| CSV | Estrutura universal |
| Excel | Múltiplas abas |
| SPED ECD | Contábil |
| SPED Fiscal | EFD-ICMS/IPI |

---

## 6. Estrutura de Pastas

```
optuscontrol/
├── backend/
│   ├── app/
│   │   ├── api/routes/       # invoices, receipts, payables, indicators
│   │   ├── core/             # nfe_parser, ocr_service, calculations
│   │   ├── db/               # supabase_client
│   │   └── schemas/          # Pydantic models
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/ui/    # Button, Card, Input
│   │   ├── components/dashboard/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── styles/
│   └── capacitor.config.ts
└── database/
    ├── schema.sql
    └── rls_policies.sql
```

---

## 7. Plano de Desenvolvimento

### Fase 1: MVP (4 semanas)

| Semana | Entregas |
|--------|----------|
| 1 | Setup (Supabase, Backend, Frontend), Auth, Dashboard básico |
| 2 | Parser XML (NF-e), Contas a pagar automáticas |
| 3 | OCR Gemini, Validação de cupons, App mobile básico |
| 4 | Cálculo de índices, Export CSV/Excel, Deploy |

### Fase 2: Refinamento (2-3 semanas)
- Medições e matching
- SPED ECD/Fiscal
- Dashboard do contador
- Notificações

### Fase 3: Escala (1-2 semanas)
- Integração n8n
- Relatórios avançados
- API pública

---

## 8. Checklist de Implementação

### Design System
- [ ] CSS Variables (cores, tipografia)
- [ ] Sidebar escura (logo, menu, CTA, logout)
- [ ] TopBar (search, icons, profile)
- [ ] Cards de Métricas com círculos
- [ ] Gráfico de barras
- [ ] Donut chart
- [ ] Lista de transações

### Backend
- [ ] FastAPI setup
- [ ] Parser NF-e (lxml)
- [ ] OCR Service (Gemini)
- [ ] Cálculo de índices
- [ ] Exportadores

### Frontend
- [ ] React + Vite + Tailwind
- [ ] Dashboard
- [ ] Upload de XML
- [ ] Captura de cupom
- [ ] Listagens

### Mobile
- [ ] Capacitor config
- [ ] Câmera nativa
- [ ] Upload de fotos

---

**Versão:** 1.0  
**Data:** 14/01/2026  
**Status:** ✅ APROVADO PARA DESENVOLVIMENTO
