-- 004_semanas.sql
-- Semanas de venda: o admin cria uma semana com um nome livre (ex: "Primeira
-- semana") e registra as vendas dentro dela. Segue o mesmo padrão das demais
-- migrations (UUID, soft delete, timestamps em TIMESTAMPTZ, REVOKE FROM PUBLIC).
-- É segura pra rodar mais de uma vez (IF NOT EXISTS) e não altera nem apaga
-- nenhuma venda existente: as vendas antigas ficam apenas "sem semana".

CREATE TABLE IF NOT EXISTS sale_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Não permite duas semanas ativas com o mesmo nome (ignora maiúscula/minúscula).
CREATE UNIQUE INDEX IF NOT EXISTS sale_weeks_name_unique_idx
  ON sale_weeks (LOWER(name)) WHERE deleted_at IS NULL;

-- Coluna opcional: vendas sem semana continuam válidas.
ALTER TABLE sales ADD COLUMN IF NOT EXISTS week_id UUID REFERENCES sale_weeks(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS sales_week_idx ON sales(week_id) WHERE deleted_at IS NULL;

REVOKE ALL ON TABLE sale_weeks FROM PUBLIC;
