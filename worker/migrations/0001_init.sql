PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY,wallet_address TEXT UNIQUE NOT NULL,email TEXT,created_at TEXT NOT NULL DEFAULT (datetime('now')),updated_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS wallet_challenges (wallet_address TEXT PRIMARY KEY,nonce TEXT NOT NULL,message TEXT NOT NULL,expires_at TEXT NOT NULL,used INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,token_hash TEXT UNIQUE NOT NULL,expires_at TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

CREATE TABLE IF NOT EXISTS exchange_connections (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,exchange TEXT NOT NULL,encrypted_credentials TEXT NOT NULL,permissions_json TEXT NOT NULL DEFAULT '["read"]',mode TEXT NOT NULL DEFAULT 'paper',live_enabled INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'configured',created_at TEXT NOT NULL DEFAULT (datetime('now')),updated_at TEXT NOT NULL DEFAULT (datetime('now')),UNIQUE(user_id,exchange));
CREATE INDEX IF NOT EXISTS idx_exchange_connections_user ON exchange_connections(user_id);

CREATE TABLE IF NOT EXISTS risk_profiles (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,style TEXT NOT NULL DEFAULT 'Balanced',investable_networth REAL NOT NULL DEFAULT 50000,max_drawdown_pct REAL NOT NULL DEFAULT 18,single_asset_cap_pct REAL NOT NULL DEFAULT 28,learned_risk INTEGER NOT NULL DEFAULT 46,less_risk_clicks INTEGER NOT NULL DEFAULT 0,samples INTEGER NOT NULL DEFAULT 0,panic_stops INTEGER NOT NULL DEFAULT 0,paused INTEGER NOT NULL DEFAULT 0,paused_reason TEXT,updated_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS portfolios (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL DEFAULT 'Main',currency TEXT NOT NULL DEFAULT 'USD',mode TEXT NOT NULL DEFAULT 'paper',created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_portfolios_user ON portfolios(user_id);
CREATE TABLE IF NOT EXISTS positions (id TEXT PRIMARY KEY,portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,asset TEXT NOT NULL,quantity REAL NOT NULL DEFAULT 0,average_cost REAL NOT NULL DEFAULT 0,updated_at TEXT NOT NULL DEFAULT (datetime('now')),UNIQUE(portfolio_id,asset));

CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,exchange TEXT NOT NULL,external_order_id TEXT,mode TEXT NOT NULL DEFAULT 'paper',symbol TEXT NOT NULL,side TEXT NOT NULL,order_type TEXT NOT NULL,quantity REAL,quote_amount REAL,notional_usd REAL,status TEXT NOT NULL DEFAULT 'pending',idempotency_key TEXT UNIQUE NOT NULL,request_json TEXT NOT NULL,response_json TEXT,created_at TEXT NOT NULL DEFAULT (datetime('now')),updated_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id,created_at);
CREATE TABLE IF NOT EXISTS subscriptions (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,plan TEXT NOT NULL DEFAULT 'Free',status TEXT NOT NULL DEFAULT 'inactive',provider TEXT,external_session_id TEXT,current_period_end TEXT,updated_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE SET NULL,event_type TEXT NOT NULL,severity TEXT NOT NULL DEFAULT 'info',metadata_json TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_audit_user_created ON audit_events(user_id,created_at);
CREATE TABLE IF NOT EXISTS strategy_runs (id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE SET NULL,strategy TEXT NOT NULL,product_id TEXT NOT NULL,params_json TEXT NOT NULL,result_json TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now')));
