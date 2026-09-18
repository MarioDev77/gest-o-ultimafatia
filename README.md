# Última Fatia — Painel Financeiro

Monorepo com duas partes independentes:

```
.
├── frontend/       # Next.js (App Router) — painel administrativo
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── public/
│   └── package.json
│
└── backend/        # API Express + Postgres
    ├── src/
    ├── migrations/
    ├── package.json
    └── start.sh
```

## Rodando localmente

```bash
# Frontend
cd frontend
pnpm install
pnpm dev            # http://localhost:3000

# Backend (em outro terminal)
cd backend
pnpm install
pnpm dev            # http://localhost:4000
```

Copie `frontend/.env.local.example` → `frontend/.env.local` e `backend/.env.example` → `backend/.env`, e preencha os valores.

## Migrations

Rode os arquivos de `backend/migrations/` em ordem contra o Postgres (`001_initial.sql`, `002_financeiro.sql`, `003_indexes.sql`), com `psql` ou a ferramenta de migração de sua preferência.

## Deploy (Railway / Railpack)

Frontend e backend são **dois serviços separados**, cada um apontando pra um "Root Directory" diferente do mesmo repositório:

- **Serviço web**: Root Directory = `frontend` → detecta Next.js automaticamente (`pnpm build` / `pnpm start`).
- **Serviço api**: Root Directory = `backend` → detecta Node pelo `backend/package.json` (`pnpm start`, que roda `start.sh`).

> O erro `Railpack could not determine how to build the app` acontecia porque o serviço de backend usava `backend/` como raiz, mas só existia um `package.json` na raiz do repositório inteiro — o Railpack não reconhece nenhuma linguagem sem `package.json` na pasta analisada. Isso foi corrigido: `backend/` tem seu próprio `package.json` e `start.sh`.

Configure as variáveis de ambiente de cada serviço no painel do Railway (mesmas chaves de `frontend/.env.local.example` e `backend/.env.example`).
