# 📊 Optus Control

**Hub de Conformidade Contábil e Gestão Financeira para Empresas de Engenharia**

Optus Control é uma plataforma SaaS multi-tenant que centraliza a gestão de notas fiscais, cupons fiscais via OCR, contas a pagar, indicadores de liquidez e exportações contábeis. Desenvolvida para contadores, gestores financeiros e operadores de campo.

---

## 🚀 Funcionalidades

- **OCR de Cupons Fiscais** — Captura de foto via app mobile e extração automática de dados com Google Gemini Vision
- **Parser de NF-e (XML)** — Upload e processamento de arquivos XML de Notas Fiscais Eletrônicas
- **Contas a Pagar** — Geração automática de payables a partir de NF-e ou cupons validados
- **Medições e Matching** — Vinculação automática de provisões com NF-e recebidas por CNPJ, valor e data
- **Indicadores de Liquidez** — Cálculo automatizado de LC, LG e Grau de Endividamento para aptidão em licitações
- **Exportações Contábeis** — Geração de CSV, Excel, SPED ECD e SPED Fiscal (EFD-ICMS/IPI)
- **Dashboard Gerencial** — Métricas em tempo real, gráficos de receitas, despesas e transações recentes
- **Multi-tenancy** — Suporte a múltiplas empresas com isolamento de dados via RLS (Supabase)
- **App Mobile** — Aplicativo nativo para iOS e Android via Capacitor
- **Modo Offline** — Sincronização de dados com banner de status e banco local

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Frontend Web | React 18 + Vite + TypeScript + Tailwind CSS |
| App Mobile | Capacitor 6 (iOS & Android) |
| Backend | Python 3.11 + FastAPI |
| Banco de Dados | Supabase (PostgreSQL 15) |
| Autenticação | Supabase Auth (JWT + RLS) |
| IA / OCR | Google Gemini 2.0 Flash |
| Storage | Supabase Storage (XMLs, PDFs, fotos) |
| Deploy Frontend | Vercel |
| Deploy Backend | Docker + VPS |

---

## 📁 Estrutura do Projeto

```
optuscontrol/
├── frontend/                  # React + Vite + Capacitor
│   ├── src/
│   │   ├── components/        # Componentes reutilizáveis (dashboard, layout, modais)
│   │   ├── pages/             # Páginas da aplicação
│   │   ├── hooks/             # Hooks customizados (useAuth, useOfflineSync, usePermissions)
│   │   └── lib/               # Clientes API, Supabase e banco offline
│   ├── android/               # Projeto Android nativo (Capacitor)
│   └── ios/                   # Projeto iOS nativo (Capacitor)
│
├── backend/                   # Python + FastAPI
│   └── app/
│       ├── api/routes/        # invoices, receipts, payables, indicators, projects...
│       ├── core/              # nfe_parser, ocr_service, sped_generator, auth, config
│       ├── db/                # supabase_client
│       └── schemas/           # Modelos Pydantic
│
├── api/                       # Entrypoint serverless para Vercel
├── vercel.json                # Configuração de deploy
└── package.json               # Scripts raiz
```

---

## ⚙️ Configuração e Instalação

### Pré-requisitos

- Node.js 18+
- Python 3.11+
- Conta no [Supabase](https://supabase.com)
- Chave de API do Google Gemini (para OCR)

### 1. Clone o repositório

```bash
git clone https://github.com/valmirautomacao/optuscontrol.git
cd optuscontrol
```

### 2. Configure o Backend

```bash
cd backend
cp .env.example .env
```

Edite o `.env` com suas credenciais:

```env
SUPABASE_URL=https://sua-url.supabase.co
SUPABASE_SERVICE_KEY=sua-chave-service-role
OPENROUTER_API_KEY=sua-chave-openrouter
RECEITAWS_TOKEN=seu-token-receitaws
DATABASE_URL=postgresql://user:pass@host:port/db
```

Instale as dependências e rode o servidor:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

A documentação interativa da API estará disponível em `http://localhost:8000/docs`.

### 3. Configure o Frontend

```bash
cd frontend
cp .env.example .env
# Preencha as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

A aplicação estará disponível em `http://localhost:5173`.

### 4. Backend via Docker (opcional)

```bash
cd backend
docker build -t optuscontrol-api .
docker run -p 8000:8000 --env-file .env optuscontrol-api
```

---

## 📱 Build Mobile (Capacitor)

```bash
cd frontend
npm run build

# Android
npx cap sync android
npx cap open android

# iOS
npx cap sync ios
npx cap open ios
```

---

## 🗄️ Banco de Dados

As migrations SQL estão em `backend/app/api/migrations/`. Execute-as no seu projeto Supabase na ordem:

1. `saas_companies_users.sql` — Estrutura multi-tenant (companies, user_profiles)
2. `measurements_provisions_notifications.sql` — Medições, provisões e notificações
3. `002_add_document_fields.sql` — Campos de documento adicionais

**Principais tabelas:**

| Tabela | Descrição |
|---|---|
| `companies` | Empresas (multi-tenant) |
| `user_profiles` | Usuários com papéis (admin, accountant, operator, viewer) |
| `projects` | Obras e projetos |
| `invoices` | Notas Fiscais Eletrônicas (NF-e) |
| `payables` | Contas a pagar |
| `receipts` | Cupons fiscais (OCR) |
| `financial_indicators` | Índices de liquidez (LC, LG, GE) |

---

## 🔑 Papéis e Permissões

| Papel | Descrição |
|---|---|
| `admin` | Acesso total, gestão de usuários e empresa |
| `accountant` | Acesso a relatórios, exportações e indicadores |
| `operator` | Lançamento de notas e cupons (mobile) |
| `viewer` | Somente leitura |

---

## 📤 Deploy

### Frontend (Vercel)

```bash
npm run build   # na raiz do projeto
```

O `vercel.json` já está configurado para apontar o output para `frontend/dist` com SPA rewrite.

### Backend (VPS com Docker)

```bash
docker build -t optuscontrol-api ./backend
docker run -d -p 8000:8000 --env-file .env optuscontrol-api
```

---

## 📄 Licença

Propriedade de [Valmir Automação](https://github.com/valmirautomacao). Todos os direitos reservados.
