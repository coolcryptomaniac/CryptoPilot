# CryptoPilot

CryptoPilot is a lightweight **paper-first AI crypto portfolio autopilot** with adaptive risk, market/news intelligence, social investing circles, exchange/DEX adapters, Telegram status hooks, USDC subscriptions, grant readiness and institutional due-diligence tooling.

## Production engineering layer 2.1

This version moves V1.5 toward a production-shaped architecture while keeping live trading **off by default**.

### Added

- Cloudflare D1 schema for users, wallet challenges, hashed sessions, encrypted exchange connections, risk profiles, portfolios, orders, subscriptions, audit events, and strategy history.
- Wallet-signature authentication. Login signatures explicitly do **not** authorize trades or transfers.
- AES-256-GCM encryption for per-user exchange credentials using a Worker-only master key.
- Coinbase Advanced Trade production signing with short-lived CDP JWTs.
- Binance Spot + Spot Testnet HMAC adapter.
- Kraken signed `AddOrder` adapter.
- Robinhood Crypto Ed25519 adapter (regional eligibility applies).
- 0x Swap API v2 quote routing; the user's wallet signs the DEX transaction.
- Order idempotency, adaptive per-order caps, rolling daily-order circuit breaker, emergency pause, and two-stage live enablement.
- Coinbase public ticker WebSocket enhancement plus REST price fallback.
- Coinbase candle-backed SMA baseline backtesting before strategy graduation.
- Coinbase Payment Acceptance session/webhook plumbing for 10 / 35 / 100 USDC subscription tiers, gated on merchant onboarding and secrets.
- Telegram remains status/alerts only; it cannot place trades.
- Reown/WalletConnect integration seam through the same EIP-1193 wallet-auth flow.
- **Curated Newsroom** using CoinDesk, Cointelegraph and Investing.com RSS feeds, showing headlines/short excerpts and publisher links rather than republishing full articles.
- **Grant Radar** tracking major ecosystem programs and scoring concrete readiness gaps without claiming automatic eligibility.
- **Institutional Room** with public control posture plus authenticated risk reports and audit JSON export.
- **CPT 2030 chain strategy**: Ethereum ecosystem canonical first, Solana second when usage justifies it, BNB Chain third for distribution, TRON as a use-case/grant pilot.

## Frontend

After GitHub Pages is enabled with **GitHub Actions** as the source, the expected URL is:

`https://coolcryptomaniac.github.io/CryptoPilot/`

The Pages workflow injects `production.js` and `intelligence.js` into the deployed site. The original UI still works in local/demo mode with no backend.

New tabs added by the intelligence layer:

- **News** — source-filtered crypto headlines.
- **Grant Radar** — major funding programs, readiness score and missing evidence.
- **Institutional** — control posture, authenticated risk report and audit export.
- **CPT Token** gains an ecosystem-fit chain strategy card.

## Safety model

1. Paper mode is the default.
2. Exchange secrets never belong in GitHub Pages/browser code.
3. User exchange credentials are encrypted at rest in D1.
4. Exchange keys should have no withdrawal/transfer permission; CryptoPilot rejects those permission labels.
5. Real execution requires both `ENABLE_LIVE_TRADING=true` on the Worker **and** a separate authenticated per-connector live switch.
6. Binance Spot Testnet is the preferred first execution path.
7. Every non-paper order requires an idempotency key and deterministic risk checks before the exchange call.
8. AI/news output cannot bypass the risk constitution.
9. DEX transactions are signed by the user's own wallet; CryptoPilot never stores seed phrases/private keys.
10. CPT remains a capped **testnet utility prototype**. No public sale/yield/fundraising contract is enabled.
11. Grant readiness scores are not eligibility decisions or funding guarantees.
12. News content is limited to headlines, short excerpts and outbound source links.

## Worker setup

```bash
cd worker
npm install
npx wrangler d1 create cryptopilot-db
```

Insert the returned D1 `database_id` into `worker/wrangler.toml`, uncomment the `[[d1_databases]]` block, then:

```bash
npm run db:migrate:local
npm run db:migrate:remote
```

Generate the encryption key outside Git:

```bash
openssl rand -base64 32
npx wrangler secret put CREDENTIAL_MASTER_KEY
```

Optional integrations:

```bash
npx wrangler secret put ZEROX_API_KEY
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put COINBASE_PAYMENT_API_KEY_ID
npx wrangler secret put COINBASE_PAYMENT_API_KEY_SECRET
npx wrangler secret put COINBASE_WEBHOOK_SECRET
```

See [`docs/production-setup.md`](docs/production-setup.md), [`docs/grant-readiness.md`](docs/grant-readiness.md), [`docs/institutional-readiness.md`](docs/institutional-readiness.md) and [`docs/token-chain-strategy-2030.md`](docs/token-chain-strategy-2030.md).

## User exchange credential shapes

Credentials are saved through authenticated `/api/exchanges/:exchange` requests and encrypted before D1 storage. Saving/replacing credentials automatically disables that connector's live switch.

- Coinbase: `apiKeyId`, `apiKeySecret`
- Binance: `apiKey`, `apiSecret`
- Kraken: `apiKey`, `apiSecret`
- Robinhood Crypto: `apiKey`, `privateKeyBase64`

## Core API

- `POST /api/auth/wallet/challenge`
- `POST /api/auth/wallet/verify`
- `GET /api/auth/me`
- `GET|POST /api/risk/profile`
- `POST /api/risk/pause` / `resume`
- `GET /api/exchanges`
- `POST|DELETE /api/exchanges/:exchange`
- `POST /api/exchanges/:exchange/live`
- `POST /api/orders/:exchange`
- `GET /api/dex/quote`
- `GET /api/market/candles`
- `POST /api/backtest`
- `GET /api/news/curated`
- `GET /api/news/sources`
- `GET /api/grants`
- `GET /api/institutional/controls`
- `GET /api/institutional/report`
- `GET /api/institutional/audit-export`
- `POST /api/subscription/checkout`
- `GET /api/subscription`
- `POST /api/webhooks/coinbase-payments`
- `POST /api/telegram/webhook`

## Before real-money launch

Keep `ENABLE_LIVE_TRADING = "false"` until D1 is deployed, authentication/emergency pause/idempotency are tested, Binance testnet passes, provider failure paths and payment webhooks are verified, rate limiting/abuse controls are added, dependency/security review is complete, and applicable legal/compliance requirements for served jurisdictions are understood.
