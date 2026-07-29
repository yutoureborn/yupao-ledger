PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('received', 'issued')),
  status TEXT NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded', 'void')),
  invoice_number TEXT NOT NULL,
  invoice_code TEXT,
  title TEXT NOT NULL,
  counterparty_name TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  tax_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (tax_amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'CNY',
  invoice_date TEXT NOT NULL,
  transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
  note TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  updated_by TEXT NOT NULL REFERENCES users(id),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoices_household_date
ON invoices (household_id, invoice_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_household_type
ON invoices (household_id, type, status, invoice_date DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_transaction
ON invoices (household_id, transaction_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number_type
ON invoices (household_id, type, invoice_number)
WHERE status = 'recorded';
