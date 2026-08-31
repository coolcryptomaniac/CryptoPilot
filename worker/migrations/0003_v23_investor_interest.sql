CREATE TABLE IF NOT EXISTS investor_interest (
  id TEXT PRIMARY KEY,
  amount_usd REAL NOT NULL,
  country TEXT NOT NULL,
  email_hash TEXT NOT NULL,
  encrypted_payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'non_binding',
  source TEXT NOT NULL DEFAULT 'cryptopilot',
  notified_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_investor_interest_created ON investor_interest(created_at);
CREATE INDEX IF NOT EXISTS idx_investor_interest_email_hash ON investor_interest(email_hash,created_at);
CREATE INDEX IF NOT EXISTS idx_investor_interest_status ON investor_interest(status,created_at);
