# CryptoPilot

CryptoPilot is a lightweight **paper-first AI crypto portfolio autopilot and risk-gated crypto intelligence platform** with adaptive risk, market/news intelligence, social investing circles, exchange/DEX adapters, stablecoin subscriptions, grant readiness, institutional due-diligence tooling and a metered B2B API.

## Production engineering layer 2.2

The public app remains useful on GitHub Pages alone. A Cloudflare Worker + D1 unlocks authenticated accounts, encrypted exchange credentials, subscriptions, developer API keys, institutional reports and tightly controlled real-money Pilot testing.

Public app:

`https://coolcryptomaniac.github.io/CryptoPilot/`

## Major capabilities

- Wallet-signature authentication with opaque hashed sessions.
- AES-256-GCM encrypted per-user exchange credentials.
- Coinbase Advanced Trade, Binance Spot/Testnet, Kraken and Robinhood Crypto adapters.
- User-signed 0x DEX routing; CryptoPilot does not store wallet seed phrases/private keys.
- Adaptive risk constitution, order idempotency, emergency pause and rolling circuit breakers.
- Paper, testnet, **Pilot** and separately gated unrestricted live modes.
- Founder/invite-only Pilot defaults: **$25/order, $100 rolling 24h, 5 orders/day**, spot only, no leverage; operator can lower these limits.
- Coinbase public ticker WebSocket plus REST fallback and historical backtesting.
- USDC subscriptions through Coinbase Payment Acceptance.
- **USDT subscriptions** through user-signed EVM ERC-20 transfers with chain/receipt/log/amount/expiry verification.
- Tether WDK self-custody integration seam for wallets/agents/USD₮0 bridging.
- Curated CoinDesk, Cointelegraph and Investing.com newsroom with hourly GitHub-only cache fallback.
- Grant Radar including Tether, TRON, Solana, Circle/Arc, Base, BNB, Ethereum, Stellar, Starknet, Celo, XRPL, Arbitrum, Avalanche, NEAR, Optimism, TON, DFINITY and Cardano programs/monitoring.
- Institutional room with control posture, risk reports and audit export.
- RWA/crypto infrastructure registry including Centrifuge, DefiLlama, Pyth, Circle CCTP V2 and Kalshi **public market-data-only** signals.
- RoamWise founder-ecosystem partner/reference integration.
- Metered **CryptoPilot API** with hashed API keys and per-plan quotas.
- Published `openapi.yaml` for B2B integration.
- CPT remains a capped **testnet utility prototype**. No public sale/yield/fundraising contract is enabled.

## New frontend tabs in 2.2

- **Pilot** — status, encrypted connector setup and tightly capped test-order helper.
- **Infrastructure** — current adapters, RWA discovery and RoamWise partner link.
- **API** — create a B2B API key and inspect usage.
- **Plans** — USDC plus verified USDT subscription checkout.
- Existing **News**, **Grant Radar**, **Institutional** and **CPT Token** intelligence tabs remain.

## Safety model

1. Paper mode remains the default.
2. Full `ENABLE_LIVE_TRADING` remains **false** by default.
3. Pilot is a distinct allowlisted mode and is also **false** by default.
4. A small Pilot limit is an operational safety boundary, **not** a tax/licensing/AML exemption.
5. Exchange keys should have read/trade only; withdrawal/transfer permission labels are rejected.
6. Saving/replacing connector credentials resets its execution switch to OFF.
7. Every non-paper order needs an idempotency key and deterministic risk checks.
8. Pilot rejects leverage, margin, futures and borrowing.
9. AI/news/prediction signals cannot bypass the risk constitution.
10. Kalshi is used only as public prediction-market signal data; CryptoPilot does not expose authenticated Kalshi trading.
11. RWA discovery is read-only; investment/redemption requires separate user signing and eligibility handling.
12. Grant readiness scores are preparation guidance, never eligibility/funding guarantees.

## Production deployment

Use the current operator runbook:

[`docs/PRODUCTION_DEPLOYMENT.md`](docs/PRODUCTION_DEPLOYMENT.md)

Short version:

```bash
cd worker
npm install
npm run check
npx wrangler d1 create cryptopilot-db
# Insert the returned D1 database_id into worker/wrangler.toml
npm run db:migrate:remote
openssl rand -base64 32
npx wrangler secret put CREDENTIAL_MASTER_KEY
npx wrangler deploy
```

A manual GitHub Actions deployment workflow exists at `.github/workflows/deploy-worker.yml` and uses `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` repository secrets.

## Stablecoin payments

Server-controlled subscription prices remain:

- Pilot — 10 USDC/USDT monthly
- Pro — 35 USDC/USDT monthly
- Collective — 100 USDC/USDT monthly

USDC is handled through Coinbase Payment Acceptance. USDT uses configurable EVM token/network/merchant settings and verifies the actual RPC chain and transfer on-chain before activating a subscription.

Never hardcode a token contract simply because it is called USDT. Configure and verify the official token address for the exact network you intend to support.

## B2B CryptoPilot API

See [`docs/API_BUSINESS.md`](docs/API_BUSINESS.md) and [`openapi.yaml`](openapi.yaml).

Developer keys are created after wallet login and stored only as SHA-256 hashes. Default rolling-day quotas:

- Free — 100 calls
- Pilot — 1,000
- Pro — 5,000
- Collective — 50,000

Current `/v1` surfaces:

- `GET /v1/news`
- `GET /v1/grants`
- `GET /v1/integrations`
- `GET /v1/rwa/pools`
- `GET /v1/defi/protocols`
- `GET /v1/prediction/markets`
- `GET /v1/oracle/pyth`
- `POST /v1/risk/quote`

Clients send `X-CryptoPilot-Key`. These endpoints do not expose user exchange credentials or authorize withdrawals.

## Current integration registry

Implemented/adapter-ready:

- Coinbase Advanced Trade
- Binance Spot + Spot Testnet
- Kraken
- Robinhood Crypto (regional eligibility applies)
- 0x user-signed DEX routing
- Coinbase Payment Acceptance / USDC
- verified EVM USDT checkout
- Tether WDK self-custody prototype seam
- Circle CCTP V2 status
- Centrifuge public RWA GraphQL
- DefiLlama protocol context
- Pyth authenticated upgraded Hermes data
- Kalshi public prediction-market data
- Telegram status/alerts
- RoamWise partner/referral metadata

Integration targets tracked in the platform registry include Alchemy Wallet APIs, Jupiter and LI.FI.

## Funding and institutional readiness

Use:

- [`docs/FUNDING_READINESS.md`](docs/FUNDING_READINESS.md)
- [`docs/grant-readiness.md`](docs/grant-readiness.md)
- [`docs/institutional-readiness.md`](docs/institutional-readiness.md)
- [`docs/token-chain-strategy-2030.md`](docs/token-chain-strategy-2030.md)
- [`docs/PRODUCTION_DEPLOYMENT.md`](docs/PRODUCTION_DEPLOYMENT.md)

The Grant Passport deliberately marks unresolved gaps such as external audits, production Worker/D1 deployment, traction/metrics, founder/team evidence, application budgets, chain-specific integrations, legal/KYB/AML work, privacy/terms and incident response.

## Core authenticated API additions

- `GET /api/pilot/status`
- `GET /api/integrations`
- `GET /api/partner/roamwise`
- `GET /api/rwa/centrifuge`
- `GET /api/defi/protocols`
- `GET /api/prediction/kalshi`
- `GET /api/oracle/pyth`
- `GET /api/circle/cctp`
- `POST /api/subscription/usdt/intent`
- `POST /api/subscription/usdt/verify`
- `GET|POST /api/developer/keys`
- `DELETE /api/developer/keys/:id`
- `GET /api/developer/usage`

## Before any external real-money launch

Do not equate passing CI with regulatory or institutional readiness. At minimum, commission D1/Worker, paper + testnet paths, rate limiting/WAF, monitoring, external security testing, secret rotation, incident response, jurisdiction/product legal review, and any required KYC/KYB/AML/VASP controls. Institutional launch additionally needs organization/RBAC/dual-control and appropriate custody/MPC integrations.
