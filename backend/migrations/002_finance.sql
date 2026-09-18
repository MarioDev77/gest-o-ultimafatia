CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160), description TEXT, price NUMERIC(12,2) NOT NULL CHECK (price >= 0), stock INTEGER CHECK (stock IS NULL OR stock >= 0), active BOOLEAN NOT NULL DEFAULT TRUE, created_by UUID NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), customer_name TEXT NOT NULL CHECK (char_length(customer_name) BETWEEN 1 AND 160), total NUMERIC(12,2) NOT NULL CHECK (total > 0), payment_method TEXT NOT NULL CHECK (payment_method IN ('pix','card','boleto','cash')), status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled')), notes TEXT, created_by UUID NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), paid_at TIMESTAMPTZ, deleted_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE, product_id UUID NOT NULL REFERENCES products(id), quantity INTEGER NOT NULL CHECK (quantity > 0), unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0), subtotal NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), description TEXT NOT NULL CHECK (char_length(description) BETWEEN 1 AND 240), category TEXT NOT NULL, amount NUMERIC(12,2) NOT NULL CHECK (amount > 0), expense_date DATE NOT NULL DEFAULT CURRENT_DATE, created_by UUID NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), actor_id UUID REFERENCES users(id), action TEXT NOT NULL, entity TEXT NOT NULL, entity_id UUID, metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sales_created_idx ON sales(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS expenses_date_idx ON expenses(expense_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS products_active_idx ON products(active) WHERE deleted_at IS NULL;
REVOKE UPDATE, DELETE ON TABLE audit_logs FROM PUBLIC;
