# Institutional readiness

CryptoPilot's institutional story should be evidence-led, not marketing-led.

## Implemented controls

- Non-custodial architecture: CryptoPilot does not store wallet seed phrases/private keys.
- AES-GCM encrypted per-user exchange credentials.
- Wallet-signature authentication with opaque hashed sessions.
- Exchange credentials can be limited to read/trade and withdrawal/transfer permission labels are rejected.
- Global and per-user live-trading gates.
- Deterministic per-order caps, rolling daily circuit breaker and emergency pause.
- Order idempotency to reduce duplicate execution risk.
- Application audit trail and authenticated audit JSON export.
- Authenticated risk report exposing limits, connector modes, recent activity and subscription state without revealing credentials.
- User-signed 0x DEX transactions.
- Historical backtesting before strategy promotion.

## Required before institutional capital

- Independent smart-contract/security audits.
- External penetration test and vulnerability-management process.
- SOC 2 or equivalent controls program when commercially appropriate.
- Formal incident response, BCP/DR, data retention and privacy policies.
- Role-based organization accounts and dual-control trade approvals.
- Institutional custody/MPC integrations instead of consumer exchange API keys where appropriate.
- Market-data entitlement review and production SLAs.
- Legal/regulatory analysis for each served jurisdiction and product mode.
- Audited financials/corporate governance as investor diligence requires.
- Real uptime, AUM, user-retention and strategy-performance metrics with no cherry-picking.

The `/api/institutional/controls`, `/api/institutional/report` and `/api/institutional/audit-export` endpoints expose the current control posture programmatically.
