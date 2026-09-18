-- 002_financeiro.sql
-- Painel administrativo financeiro: produtos, vendas, despesas, comprovantes PIX,
-- custo de fabricação e abertura de caixa.
-- Segue o padrão já usado em 001_initial.sql: UUID como PK, soft delete via
-- deleted_at, timestamps em TIMESTAMPTZ, CHECK constraints no banco (não confiar
-- só na validação do frontend/backend), REVOKE ALL FROM PUBLIC.
-- Todos os valores monetários são guardados em CENTAVOS (INTEGER), pra evitar
-- erro de arredondamento com float. O frontend converte pra R$ na exibição.

-- ============================================================
-- PRODUTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  description TEXT,
  category TEXT,
  photo_key TEXT, -- chave do objeto no S3 (mesmo padrão de backend/src/routes/uploads.ts)
  unit TEXT NOT NULL DEFAULT 'unidade',
  -- Preço e custo ficam NULL até o admin editar/cadastrar o valor real pelo painel.
  -- Nunca inserir valor fictício aqui: enquanto for NULL, o frontend deve avisar
  -- que o produto está com cadastro incompleto.
  sale_price_cents INTEGER CHECK (sale_price_cents >= 0),
  manufacturing_cost_cents INTEGER CHECK (manufacturing_cost_cents >= 0),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS products_status_idx ON products(status) WHERE deleted_at IS NULL;

-- Produtos principais atuais do negócio (Última Fatia — nova versão).
-- Sem preço/custo fixo: o admin edita pela aba Produtos assim que estiver pronto.
INSERT INTO products (name, unit, status)
SELECT 'Morango Cravejado', 'unidade', 'ativo'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Morango Cravejado');

INSERT INTO products (name, unit, status)
SELECT 'Cone Trufado', 'unidade', 'ativo'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Cone Trufado');

-- ============================================================
-- INGREDIENTES / CUSTO DE FABRICAÇÃO
-- ============================================================
CREATE TABLE IF NOT EXISTS manufacturing_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  unit TEXT NOT NULL, -- kg, g, l, ml, unidade, etc.
  purchased_quantity NUMERIC(12,3) NOT NULL CHECK (purchased_quantity > 0),
  purchase_price_cents INTEGER NOT NULL CHECK (purchase_price_cents >= 0),
  -- custo por unidade calculado automaticamente pelo próprio banco
  unit_cost_cents NUMERIC(14,4) GENERATED ALWAYS AS
    (purchase_price_cents::NUMERIC / purchased_quantity) STORED,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Relaciona quanto de cada ingrediente um produto usa, pra somar o custo de
-- fabricação "de baixo pra cima" quando o admin preferir calcular assim em vez
-- de digitar o custo direto no cadastro do produto.
CREATE TABLE IF NOT EXISTS product_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES manufacturing_ingredients(id) ON DELETE RESTRICT,
  quantity_used NUMERIC(12,3) NOT NULL CHECK (quantity_used > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS product_ingredients_product_idx ON product_ingredients(product_id);

-- ============================================================
-- VENDAS
-- ============================================================
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number BIGSERIAL UNIQUE, -- número curto pra exibir na tela ("Venda #1024")
  sale_datetime TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  customer_name TEXT CHECK (customer_name IS NULL OR char_length(customer_name) <= 160),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('dinheiro', 'pix', 'cartao')),
  -- só faz sentido pra pagamento em dinheiro; validado na regra de negócio (backend)
  amount_received_cents INTEGER CHECK (amount_received_cents >= 0),
  change_cents INTEGER NOT NULL DEFAULT 0 CHECK (change_cents >= 0),
  discount_cents INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0), -- soma dos itens, sem desconto
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0), -- subtotal - desconto (valor que entra no caixa)
  total_cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (total_cost_cents >= 0), -- soma do custo dos produtos vendidos
  status TEXT NOT NULL DEFAULT 'concluida' CHECK (status IN ('concluida', 'cancelada')),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CHECK (total_cents = subtotal_cents - discount_cents)
);

CREATE INDEX IF NOT EXISTS sales_datetime_idx ON sales(sale_datetime) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS sales_status_idx ON sales(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS sales_payment_method_idx ON sales(payment_method) WHERE deleted_at IS NULL;

-- Itens da venda: permite mais de um produto por venda (estrutura escalável),
-- mesmo que o fluxo inicial da tela seja "1 produto por venda".
CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name_snapshot TEXT NOT NULL, -- preserva o nome do produto no momento da venda
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0), -- pode diferir do preço padrão (desconto pontual)
  unit_cost_cents INTEGER NOT NULL CHECK (unit_cost_cents >= 0),
  line_total_cents INTEGER NOT NULL CHECK (line_total_cents >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (line_total_cents = unit_price_cents * quantity)
);

CREATE INDEX IF NOT EXISTS sale_items_sale_idx ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS sale_items_product_idx ON sale_items(product_id);

-- ============================================================
-- DESPESAS
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 1 AND 200),
  category TEXT NOT NULL CHECK (category IN (
    'materia_prima', 'embalagens', 'transporte', 'marketing', 'equipamentos', 'taxas', 'outros'
  )),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  expense_date DATE NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('dinheiro', 'pix', 'cartao')),
  note TEXT,
  receipt_key TEXT, -- comprovante opcional, mesmo bucket S3
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS expenses_date_idx ON expenses(expense_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS expenses_category_idx ON expenses(category) WHERE deleted_at IS NULL;

-- ============================================================
-- COMPROVANTES PIX
-- ============================================================
CREATE TABLE IF NOT EXISTS pix_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  image_key TEXT NOT NULL, -- objeto no S3 (upload seguro via /api/uploads/presign)
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  receipt_datetime TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'conferido', 'divergente')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS pix_receipts_status_idx ON pix_receipts(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS pix_receipts_sale_idx ON pix_receipts(sale_id);
CREATE INDEX IF NOT EXISTS pix_receipts_datetime_idx ON pix_receipts(receipt_datetime);

-- ============================================================
-- ABERTURA DE CAIXA (saldo inicial do dia, pro relatório de fluxo de caixa)
-- ============================================================
CREATE TABLE IF NOT EXISTS cash_openings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opening_date DATE NOT NULL UNIQUE,
  opening_balance_cents INTEGER NOT NULL DEFAULT 0 CHECK (opening_balance_cents >= 0),
  note TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PERMISSÕES (mesmo padrão de 001_initial.sql)
-- ============================================================
REVOKE ALL ON TABLE
  products, manufacturing_ingredients, product_ingredients,
  sales, sale_items, expenses, pix_receipts, cash_openings
FROM PUBLIC;
