# CryptoPilot 2.2 — production deployment runbook

This is the operator runbook for deploying the CryptoPilot GitHub Pages frontend plus Cloudflare Worker/D1 backend. It is intentionally **paper-first** and includes a separate founder/invite-only **Pilot mode** for tightly capped real spot orders.

> Important: a small order size is an operational-risk limit, not a tax, licensing, AML, consumer-protection or securities-law exemption. Confirm the rules that apply to the operator, users, counterparties and jurisdictions before enabling real-money features.

## 1. Architecture

```text
GitHub Pages (public UI)
  ├─ app.js               demo/paper portfolio
  ├─ production.js        wallet auth, 0x, backtests, USDC
  ├─ intelligence.js      news, grants, institutional room
  ├─ fallback.js          GitHub-only cached news/grants
  └─ platform.js          Pilot mode, USDT, integrations, B2B API, RoamWise
             │ HTTPS
             ▼
Cloudflare Worker: cryptopilot-api
  ├─ wallet-signature auth + hashed sessions
  ├─ AES-GCM encrypted exchange credentials
  ├─ deterministic risk constitution
  ├─ paper/testnet/pilot/live execution gates
  ├─ USDC + verified USDT subscriptions
  ├─ RWA/oracle/prediction-market read adapters
  ├─ developer API keys + quotas
  └─ audit / institutional endpoints
             │
             ▼
Cloudflare D1
  users, sessions, risk, connectors, orders, subscriptions,
  crypto_payments, api_keys, api_usage, audit_events, strategy_runs
```

CryptoPilot never needs to store a user's wallet seed phrase. Exchange credentials are encrypted server-side. DEX transactions and USDT payments are signed by the user's own wallet.

## 2. Prerequisites

- GitHub repository: `coolcryptomaniac/CryptoPilot`
- Cloudflare account with Workers + D1 available
- Node.js 22+
- Wrangler 4.x (installed as a dev dependency in `worker/`)
- An EVM wallet you control for operator login and, optionally, the founder Pilot allowlist
- For real exchange tests: trade-only API credentials from an exchange legally available to you. Disable withdrawals/transfers.

Optional integrations require their own provider credentials. Do not place secrets in GitHub Pages, source files, commits, screenshots or browser localStorage.

## 3. Clone and validate

```bash
git clone https://github.com/coolcryptomaniac/CryptoPilot.git
cd CryptoPilot/worker
npm install
npm run check
```

Do not continue if tests fail.

## 4. Authenticate Wrangler

Interactive local setup:

```bash
npx wrangler login
```

For GitHub Actions, create a scoped Cloudflare API token that can deploy Workers and manage the required D1 database, then add repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

The repository includes `.github/workflows/deploy-worker.yml`; it is manual (`workflow_dispatch`) so a normal code push cannot silently deploy a financial backend.

## 5. Create D1

From `worker/`:

```bash
npx wrangler d1 create cryptopilot-db
```

Wrangler returns a database ID. Edit `worker/wrangler.toml` and uncomment:

```toml
[[d1_databases]]
binding = "DB"
database_name = "cryptopilot-db"
database_id = "YOUR_REAL_D1_DATABASE_ID"
migrations_dir = "migrations"
```

Apply migrations locally first:

```bash
npm run db:migrate:local
```

Then remote:

```bash
npm run db:migrate:remote
```

Current migrations include the core user/trading schema and the 2.2 USDT/API monetization tables.

## 6. Credential encryption secret

Generate a random 32-byte key outside Git:

```bash
openssl rand -base64 32
```

Store it as a Worker secret:

```bash
npx wrangler secret put CREDENTIAL_MASTER_KEY
```

Back it up in an appropriate operator secret manager. Losing this key makes stored exchange credentials undecryptable. Exposing it compromises all encrypted connector credentials.

## 7. Deploy with all real trading OFF

Keep these defaults in `wrangler.toml`:

```toml
ENABLE_LIVE_TRADING = "false"
ENABLE_PILOT_TRADING = "false"
PILOT_MAX_ORDER_USD = "25"
PILOT_MAX_DAILY_NOTIONAL_USD = "100"
PILOT_MAX_DAILY_ORDERS = "5"
```

Deploy:

```bash
npx wrangler deploy
```

Copy the resulting Worker URL, for example:

```text
https://cryptopilot-api.<account>.workers.dev
```

Test:

```bash
curl https://YOUR-WORKER/api/health
```

Expected: `ok: true`, persistence enabled, full live false, Pilot false.

## 8. Connect the public app

Open:

`https://coolcryptomaniac.github.io/CryptoPilot/`

Go to **Connect** and paste the Worker URL. It is stored locally as a public endpoint URL; no secret is stored in the browser.

Use **Wallet authentication**. The signature is a login challenge only and explicitly does not authorize a trade or token transfer.

## 9. Exchange credentials

Use only API keys with `read` + `trade` permissions. Do not grant withdrawal/transfer permissions.

Credential shapes:

### Coinbase Advanced Trade

```json
{
  "mode": "paper",
  "permissions": ["read", "trade"],
  "credentials": {
    "apiKeyId": "organizations/.../apiKeys/...",
    "apiKeySecret": "-----BEGIN EC PRIVATE KEY-----\n..."
  }
}
```

### Binance Spot

```json
{
  "mode": "testnet",
  "permissions": ["read", "trade"],
  "credentials": {
    "apiKey": "...",
    "apiSecret": "..."
  }
}
```

### Kraken

```json
{
  "mode": "paper",
  "permissions": ["read", "trade"],
  "credentials": {
    "apiKey": "...",
    "apiSecret": "base64-secret"
  }
}
```

### Robinhood Crypto

```json
{
  "mode": "paper",
  "permissions": ["read", "trade"],
  "credentials": {
    "apiKey": "...",
    "privateKeyBase64": "32-byte-ed25519-seed-as-base64"
  }
}
```

Regional/API eligibility differs by provider. CryptoPilot does not bypass provider geography or account eligibility.

Saving/replacing credentials resets that connector's execution switch to OFF.

## 10. Commissioning sequence

Use this order:

1. Paper mode only.
2. Binance Spot Testnet or provider sandbox/test environment.
3. Confirm wallet auth, credential encryption, duplicate-order protection, emergency pause and audit logs.
4. Run backtests and deliberately trigger rejected orders.
5. Configure Pilot allowlist and limits.
6. Enable Pilot only for your own/explicit invited wallet(s).
7. Make one tiny spot order.
8. Verify exchange statement vs CryptoPilot audit entry.
9. Keep full `ENABLE_LIVE_TRADING=false` until an external security/compliance review and real operational monitoring exist.

## 11. Founder Pilot mode

Pilot is separate from unrestricted live trading.

Set your own EVM login wallet(s):

```bash
npx wrangler secret put PILOT_ALLOWED_WALLETS
```

Value example:

```text
0xYourWallet,0xSecondExplicitlyApprovedWallet
```

Then enable Pilot:

```toml
ENABLE_PILOT_TRADING = "true"
PILOT_MAX_ORDER_USD = "25"
PILOT_MAX_DAILY_NOTIONAL_USD = "100"
PILOT_MAX_DAILY_ORDERS = "5"
```

Redeploy. The connector itself must also be saved as `mode: "pilot"` and its user-level execution toggle must be enabled.

Pilot rejects leverage, margin, futures and borrowing fields. It permits only spot market/limit order types and enforces rolling-day D1 limits.

Recommended commissioning cap is $25/order and $100/rolling 24 hours. Lower it further if needed.

### India-specific tax/compliance note

If you operate from or serve India, do not assume Pilot limits create an exemption. Current Income Tax Department guidance applies a 30% rate to income from VDA transfers under Section 115BBH, and Section 194S contains annual TDS thresholds that depend on payer status. FIU-IND also maintains AML/CFT and VDA service-provider registration guidance. Get professional advice before offering discretionary/automated trading to third parties.

## 12. USDC subscriptions

Plans are server-priced:

- Pilot — 10 USDC/month
- Pro — 35 USDC/month
- Collective — 100 USDC/month

Configure Coinbase Payment Acceptance:

```bash
npx wrangler secret put COINBASE_PAYMENT_API_KEY_ID
npx wrangler secret put COINBASE_PAYMENT_API_KEY_SECRET
npx wrangler secret put COINBASE_WEBHOOK_SECRET
```

Then configure one settlement target:

```bash
npx wrangler secret put PAYMENT_TARGET_ACCOUNT_ID
```

or:

```bash
npx wrangler secret put PAYMENT_TARGET_ADDRESS
```

Optional redirect URLs:

```bash
npx wrangler secret put PAYMENT_SUCCESS_URL
npx wrangler secret put PAYMENT_FAILURE_URL
```

Webhook route:

```text
POST /api/webhooks/coinbase-payments
```

A paid plan becomes active only after a valid signed payment event.

## 13. USDT / Tether payment rail

CryptoPilot 2.2 supports a configurable EVM USDT merchant checkout. The user signs an ERC-20 transfer in their own wallet; the Worker verifies the token contract, sender, merchant address, amount, successful receipt and minimum confirmations before activating the subscription.

Choose a network where you are prepared to accept USDT and pay gas. Verify the official token contract for that network yourself before setting production configuration.

Set:

```bash
npx wrangler secret put USDT_PAYMENT_RPC_URL
npx wrangler secret put USDT_TOKEN_ADDRESS
npx wrangler secret put USDT_PAYMENT_TARGET_ADDRESS
npx wrangler secret put USDT_CHAIN_ID
```

Optional vars:

```toml
USDT_NETWORK = "evm"
USDT_DECIMALS = "6"
USDT_MIN_CONFIRMATIONS = "2"
```

Routes:

```text
POST /api/subscription/usdt/intent
POST /api/subscription/usdt/verify
```

Never treat a transaction hash supplied by the browser as proof of payment. CryptoPilot verifies the on-chain logs itself.

## 14. Tether WDK integration

The repository includes `web3/tether-wdk.example.mjs` as a self-custodial integration seam. Use WDK client-side/local-side; do not send user seed phrases to the CryptoPilot Worker.

Suggested grant/partner milestone:

1. WDK wallet/account creation on a dedicated test environment.
2. Register EVM/Solana/TRON wallet modules.
3. Add transaction policies mirroring CryptoPilot hard limits.
4. Add USD₮0 bridge module where useful.
5. Build a local agent interface that requests policy-approved payment intents rather than giving an LLM raw wallet control.

## 15. Pyth market data

As of the August 26, 2026 Pyth Core API change, authenticated Hermes requests require a key.

```bash
npx wrangler secret put PYTH_API_KEY
```

Example:

```text
GET /api/oracle/pyth?id=<feed-id>&id=<feed-id>
```

The B2B equivalent is `/v1/oracle/pyth` with `X-CryptoPilot-Key`.

## 16. Kalshi market signals

Kalshi is integrated only as an optional prediction-market **data signal**. CryptoPilot does not place autonomous event-contract wagers.

Configure:

```bash
npx wrangler secret put KALSHI_API_KEY_ID
npx wrangler secret put KALSHI_PRIVATE_KEY_PEM
```

The private key must be the PKCS#8 key associated with the Kalshi API credential.

Read endpoint:

```text
GET /api/prediction/kalshi?limit=20
```

## 17. RWA / institutional data

Centrifuge's public GraphQL API requires no operator key:

```text
GET /api/rwa/centrifuge?limit=20
```

It is read-only. Any investment/redemption functionality should require the user's own signer plus product/jurisdiction eligibility checks.

DefiLlama context:

```text
GET /api/defi/protocols?limit=25
```

## 18. Circle CCTP V2

Public status route:

```text
GET /api/circle/cctp?sourceDomain=<id>&txHash=0x...
```

Use `testnet=true` for the sandbox Iris host.

The Circle Grant Passport treats Arc integration separately from generic USDC/CCTP support; do not claim Arc readiness until a real Arc deployment exists.

## 19. Developer/B2B API business

An authenticated CryptoPilot user can issue an API key:

```text
POST /api/developer/keys
Authorization: Bearer <wallet-session>

{"name":"My production app"}
```

The raw `cp_live_...` key is shown once; D1 stores only its SHA-256 hash.

Use it:

```bash
curl -H 'X-CryptoPilot-Key: cp_live_...' \
  https://YOUR-WORKER/v1/integrations
```

Current API surfaces:

```text
GET  /v1/news
GET  /v1/grants
GET  /v1/integrations
GET  /v1/rwa/pools
GET  /v1/defi/protocols
GET  /v1/prediction/markets
GET  /v1/oracle/pyth
POST /v1/risk/quote
```

Default daily quotas:

- Free — 100
- Pilot — 1,000
- Pro — 5,000
- Collective — 50,000

This makes the API sellable without giving API customers access to user exchange credentials or custody.

## 20. Telegram

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
```

Webhook:

```text
POST /api/telegram/webhook
```

Telegram is status/alerts only. It deliberately cannot place trades.

## 21. RoamWise integration

Public partner metadata:

```text
GET /api/partner/roamwise
```

The frontend links to `https://www.roamwise.co.in/` using a CryptoPilot referral UTM. Suggested future integration is stablecoin-paid travel planning or subscriber travel benefits. Keep financial/travel products contractually separate unless you deliberately create a commercial arrangement.

## 22. Production monitoring

Before inviting external real-money users, add at minimum:

- Cloudflare rate limiting/WAF rules for auth and order endpoints
- uptime monitoring for Worker health
- exchange-provider outage alarms
- error-rate alerts
- API-usage anomaly alerts
- periodic D1 export/backup process
- secret-rotation process
- incident-response runbook
- explicit data-retention policy
- independent penetration test
- smart-contract audit before any CPT bridge/mint/burn or sale functionality

## 23. Regulatory/institutional readiness gaps

Code cannot automatically make CryptoPilot licensed or grant-eligible. Track at least:

- legal entity + bank/accounting setup
- jurisdiction/product legal memo
- FIU/VASP or equivalent analysis where applicable
- KYC/KYB and sanctions process where required
- terms/privacy/risk disclosures
- data-processing agreements
- CERT-In / cybersecurity obligations where applicable
- external app + contract audits
- incident response / BCP / DR
- organization accounts, RBAC and dual-control approvals
- qualified custody/MPC integrations for institutional users
- audited financials as fundraising stage requires
- real usage, retention, uptime, revenue and performance metrics
- program-specific chain integrations and measurable ecosystem impact

## 24. Rollback / emergency procedure

If anything looks wrong:

1. Set `ENABLE_PILOT_TRADING=false` and `ENABLE_LIVE_TRADING=false`.
2. Redeploy Worker.
3. Use the app's emergency pause for affected users.
4. Disable/revoke exchange API keys at the exchange itself.
5. Rotate any suspected Worker secrets.
6. Review D1 `orders` and `audit_events` before re-enabling anything.

The exchange/provider-side key revocation is the final safety boundary.

## 25. Final launch checklist

- [ ] CI green on `main`
- [ ] Pages deploy green
- [ ] D1 created and all migrations applied
- [ ] encryption secret backed up securely
- [ ] health endpoint says persistence true
- [ ] paper orders pass
- [ ] duplicate idempotency request replays instead of double-submitting
- [ ] emergency pause blocks orders
- [ ] testnet provider passes
- [ ] Pilot wallet allowlist contains only explicit operator/test wallets
- [ ] Pilot cap <= intended amount
- [ ] Pilot daily notional cap <= intended amount
- [ ] withdrawals disabled at each exchange
- [ ] USDC webhook signature verified
- [ ] USDT payment verified on chain
- [ ] API keys stored only by intended B2B clients
- [ ] rate limits / monitoring configured
- [ ] applicable legal, tax and AML obligations reviewed
- [ ] full live mode remains OFF until a separate launch decision

