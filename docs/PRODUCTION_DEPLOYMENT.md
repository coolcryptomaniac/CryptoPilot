# CryptoPilot — current production deployment guide

**Version:** 2.2  
**Reviewed:** 2026-09-01

This is the current operator guide. `PRODUCTION_DEPLOYMENT_V22.md` is retained as historical build documentation; use this file for deployment.

CryptoPilot is designed to be paper-first. The separate **Pilot** mode permits tightly capped spot execution for explicitly allowlisted operator/test wallets. A small dollar cap reduces operational exposure but **does not create a tax, licensing, AML/KYC, consumer-law or securities-law exemption**.

## Production topology

```text
GitHub Pages
  app.js                paper/demo
  production.js         wallet auth, WebSocket, 0x, USDC, backtests
  intelligence.js       news, grants, institutional room, CPT strategy
  platform.js           Pilot, USDT, infrastructure, B2B API, RoamWise
  fallback.js           GitHub-only news/grant/control cache
       |
       | HTTPS
       v
Cloudflare Worker: cryptopilot-api
       |
       +-- D1: auth/risk/orders/payments/API usage/audit
       +-- exchange APIs (user-specific encrypted trade-only credentials)
       +-- 0x / Pyth / Centrifuge / DefiLlama / Circle / Kalshi public data
       +-- Coinbase Payment Acceptance
       +-- configurable EVM USDT receipt verification
```

The browser never receives stored exchange API secrets. CryptoPilot does not store wallet seed phrases. DEX and USDT transactions are user-signed.

## A. GitHub Pages

The frontend is already deployed from `main` through `.github/workflows/pages.yml`.

Public URL:

```text
https://coolcryptomaniac.github.io/CryptoPilot/
```

The hourly news workflow also rebuilds Pages so the cached CoinDesk/Cointelegraph/Investing.com feed stays current even with no Worker.

## B. Local validation

```bash
git clone https://github.com/coolcryptomaniac/CryptoPilot.git
cd CryptoPilot/worker
npm install
npm run check
```

Do not deploy a revision that fails `npm run check`.

## C. Cloudflare authentication

Local interactive path:

```bash
npx wrangler login
```

For the repository's manual Worker deployment workflow, create GitHub repository secrets:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

Use a scoped token with only the Worker/D1 permissions required for this application.

## D. Create and bind D1

```bash
cd worker
npx wrangler d1 create cryptopilot-db
```

Cloudflare returns a `database_id`. In `worker/wrangler.toml`, uncomment and fill:

```toml
[[d1_databases]]
binding = "DB"
database_name = "cryptopilot-db"
database_id = "YOUR_REAL_DATABASE_ID"
migrations_dir = "migrations"
```

Validate migration locally:

```bash
npm run db:migrate:local
```

Apply remotely:

```bash
npm run db:migrate:remote
```

Migrations create users, wallet challenges, hashed sessions, encrypted exchange connections, risk profiles, portfolios, positions, orders, subscriptions, audit events, strategy runs, verified crypto-payment records, hashed developer API keys and API usage records.

## E. Encryption master key

Generate outside Git:

```bash
openssl rand -base64 32
npx wrangler secret put CREDENTIAL_MASTER_KEY
```

Back this up in a secure operator secret manager. Never commit it.

## F. Deploy with money movement OFF

Keep:

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

Or run **Deploy CryptoPilot Worker** manually from GitHub Actions after the Cloudflare repository secrets exist.

Health check:

```bash
curl https://YOUR-WORKER.workers.dev/api/health
```

Confirm:

- `ok: true`
- `persistence: true`
- `globalLiveTrading: false`
- Pilot disabled

## G. Connect the frontend

Open the public app → **Connect** → paste the Worker URL.

Authenticate your EVM wallet. The signed login challenge explicitly states it is only authentication and does not authorize trades/transfers.

## H. Exchange credentials

Create API credentials directly with the exchange. Prefer:

```text
READ = enabled
TRADE = enabled
WITHDRAW = disabled
TRANSFER = disabled
```

CryptoPilot rejects permission labels containing withdrawal/transfer.

Supported credential payloads:

### Coinbase

```json
{
  "mode":"paper",
  "permissions":["read","trade"],
  "credentials":{
    "apiKeyId":"organizations/.../apiKeys/...",
    "apiKeySecret":"-----BEGIN EC PRIVATE KEY-----\n..."
  }
}
```

### Binance

```json
{
  "mode":"testnet",
  "permissions":["read","trade"],
  "credentials":{"apiKey":"...","apiSecret":"..."}
}
```

### Kraken

```json
{
  "mode":"paper",
  "permissions":["read","trade"],
  "credentials":{"apiKey":"...","apiSecret":"base64-secret"}
}
```

### Robinhood Crypto

```json
{
  "mode":"paper",
  "permissions":["read","trade"],
  "credentials":{"apiKey":"...","privateKeyBase64":"32-byte-ed25519-seed-base64"}
}
```

Provider/jurisdiction eligibility still applies. CryptoPilot does not bypass geographic restrictions.

Saving credentials encrypts them with AES-GCM and resets connector execution to OFF.

## I. Commissioning path

Use this exact progression:

1. **Paper** — wallet auth, credential encryption, risk limits, duplicate request replay, emergency stop, audit.
2. **Testnet/sandbox** — request signing and provider error handling.
3. **Pilot** — one allowlisted operator/test wallet, tiny real spot transaction, reconcile with exchange statement.
4. **Full live** — do not enable for external users until security/compliance/monitoring work is complete.

## J. Founder/invite-only Pilot

Store an allowlist as a secret:

```bash
npx wrangler secret put PILOT_ALLOWED_WALLETS
```

Example value:

```text
0xOperatorWallet,0xExplicitTestWallet
```

Then set:

```toml
ENABLE_PILOT_TRADING = "true"
PILOT_MAX_ORDER_USD = "25"
PILOT_MAX_DAILY_NOTIONAL_USD = "100"
PILOT_MAX_DAILY_ORDERS = "5"
```

Redeploy.

In the app's **Pilot** tab:

1. save a connector as mode `pilot`;
2. enable that connector's execution switch;
3. submit a tiny spot order.

Pilot requirements are cumulative:

- global Pilot switch ON;
- authenticated wallet in operator allowlist;
- connector saved as `pilot`;
- connector has `trade` permission;
- per-connector execution switch ON;
- market/limit spot only;
- no margin/leverage/futures/borrowing;
- positive explicit USD notional;
- <= operator per-order cap;
- <= rolling-day order count;
- <= rolling-day Pilot notional;
- normal adaptive risk constitution must also approve it;
- idempotency key required.

Full `ENABLE_LIVE_TRADING` can remain OFF while Pilot operates.

### Tax/compliance warning

Do not choose `$100` because you think it is automatically exempt. It is merely an operator cap. For India, current VDA tax/TDS and FIU-IND obligations depend on the activity and statutory thresholds/rules, not CryptoPilot's UI limit. Obtain professional advice before offering automated/discretionary trading to third parties.

## K. USDC subscriptions

Server prices:

```text
Pilot       10 USDC/month
Pro         35 USDC/month
Collective 100 USDC/month
```

Configure Coinbase Payment Acceptance:

```bash
npx wrangler secret put COINBASE_PAYMENT_API_KEY_ID
npx wrangler secret put COINBASE_PAYMENT_API_KEY_SECRET
npx wrangler secret put COINBASE_WEBHOOK_SECRET
```

And one target:

```bash
npx wrangler secret put PAYMENT_TARGET_ACCOUNT_ID
```

or:

```bash
npx wrangler secret put PAYMENT_TARGET_ADDRESS
```

Optional:

```bash
npx wrangler secret put PAYMENT_SUCCESS_URL
npx wrangler secret put PAYMENT_FAILURE_URL
```

Webhook:

```text
POST /api/webhooks/coinbase-payments
```

The subscription becomes active only after webhook verification.

## L. USDT / Tether checkout

The EVM USDT path is user-signed and independently verified on-chain.

Set exact network values yourself after verifying the official USDT contract for that chain:

```bash
npx wrangler secret put USDT_PAYMENT_RPC_URL
npx wrangler secret put USDT_TOKEN_ADDRESS
npx wrangler secret put USDT_PAYMENT_TARGET_ADDRESS
npx wrangler secret put USDT_CHAIN_ID
```

Defaults:

```toml
USDT_NETWORK = "evm"
USDT_DECIMALS = "6"
USDT_MIN_CONFIRMATIONS = "2"
```

Flow:

```text
POST /api/subscription/usdt/intent
  -> app receives exact token/target/amount/chain
  -> user's wallet signs ERC-20 transfer
POST /api/subscription/usdt/verify
  -> Worker fetches chain receipt
  -> checks success + confirmations
  -> checks exact USDT token address
  -> checks Transfer from authenticated wallet
  -> checks merchant address
  -> checks paid amount
  -> checks transaction hash not reused
  -> activates subscription
```

A browser-supplied transaction hash alone is never treated as payment proof.

## M. Tether WDK

Example integration:

```text
web3/tether-wdk.example.mjs
```

The WDK signer/seed must remain on the user's local secure runtime. Never send a mnemonic to the Worker.

Recommended Tether grant milestones:

1. local WDK wallet/account prototype;
2. hard fee/value policies matching CryptoPilot risk caps;
3. USD₮ payment intent execution;
4. USD₮0 bridge quote + explicit user/policy approval;
5. local agent interface that can request bounded intents but cannot sign arbitrary LLM-generated transactions;
6. production Worker/D1 commissioning;
7. reproducible demo/video/technical deliverable for the active Tether grant task.

## N. Pyth

Current upgraded Hermes calls require `PYTH_API_KEY`:

```bash
npx wrangler secret put PYTH_API_KEY
```

CryptoPilot uses:

```text
https://pyth.dourolabs.app/hermes/v2/updates/price/latest
```

Routes:

```text
GET /api/oracle/pyth?id=<feed-id>
GET /v1/oracle/pyth?id=<feed-id>
```

For institutional production market data, review Pyth provider/resilience requirements rather than relying blindly on a single public endpoint.

## O. Kalshi prediction signals

CryptoPilot uses the **public** market discovery endpoint:

```text
https://external-api.kalshi.com/trade-api/v2/markets
```

No Kalshi secret is required for this read-only integration.

Routes:

```text
GET /api/prediction/kalshi?limit=20
GET /v1/prediction/markets?limit=20
```

CryptoPilot does **not** expose authenticated Kalshi order placement. If that is ever considered separately, Kalshi's private API uses API keys and RSA-PSS request signatures and would require its own regulatory/product review.

## P. RWA / real-estate-adjacent discovery

Centrifuge provides a public read-only GraphQL endpoint:

```text
https://api.centrifuge.io
```

CryptoPilot route:

```text
GET /api/rwa/centrifuge?limit=20
GET /v1/rwa/pools?limit=20
```

This is discovery/data only. Any fund-token acquisition, redemption, securities/RWA eligibility or transfer restrictions must be handled separately with the user's signer and the asset/provider's eligibility rules.

Future RWA target: RWA.xyz API for broader tokenized-asset analytics once an operator API key/commercial data plan is configured.

## Q. DefiLlama

Read-only protocol/TVL context:

```text
GET /api/defi/protocols?limit=25
GET /v1/defi/protocols?limit=25
```

Use as contextual risk data, not a direct trade trigger.

## R. Circle CCTP V2

Status lookup:

```text
GET /api/circle/cctp?sourceDomain=<domain>&txHash=0x...
```

Add `testnet=true` for the sandbox Iris host.

Circle grant readiness intentionally treats **Arc integration** as separate from generic USDC/CCTP integration.

## S. 0x DEX

```bash
npx wrangler secret put ZEROX_API_KEY
```

CryptoPilot gets a quote; the user signs the transaction. When approval is needed, approve only the allowance spender returned by 0x—not an arbitrary execution address.

## T. Telegram

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
```

```text
POST /api/telegram/webhook
```

Telegram remains status/alerts only and deliberately cannot place trades.

## U. B2B CryptoPilot API

Full product guide:

```text
docs/API_BUSINESS.md
```

Create an API key after wallet login:

```http
POST /api/developer/keys
Authorization: Bearer <wallet-session>
Content-Type: application/json

{"name":"Customer backend"}
```

D1 stores only the key hash. The raw `cp_live_...` value is shown once.

Call:

```bash
curl -H 'X-CryptoPilot-Key: cp_live_...' \
  https://YOUR-WORKER/v1/integrations
```

Default rolling-24h quotas:

```text
Free          100
Pilot       1,000
Pro         5,000
Collective 50,000
```

Sellable routes:

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

These keys do not grant access to user exchange credentials and do not authorize withdrawals.

## V. RoamWise

Public partner metadata:

```text
GET /api/partner/roamwise
```

Frontend partner URL:

```text
https://www.roamwise.co.in/?utm_source=cryptopilot&utm_medium=partner&utm_campaign=founder_ecosystem
```

Reasonable integration directions:

- CryptoPilot subscriber travel benefit;
- stablecoin-paid RoamWise travel planning;
- crypto-friendly travel intelligence;
- joint API/referral bundle for wallets/fintechs;
- later loyalty/reward interoperability after legal/product review.

Do not imply a third-party partnership beyond what actually exists.

## W. Grant Passport

The Grant Radar now tracks active/current/monitor programs across:

- Tether/USDT + WDK
- TRON
- Solana
- Circle/Arc
- Base
- BNB Chain
- Ethereum
- Stellar
- Starknet
- Celo
- XRPL/Ripple
- Arbitrum
- Avalanche
- NEAR
- Optimism/Superchain
- TON
- Internet Computer
- Cardano

The app intentionally exposes **gaps**, including:

```text
productionWorker
d1Deployed
securityAudit
smartContractAudit
team
budget
metrics
traction
pitch
legalEntity
legalMemo
kycKyb
sanctionsScreening
privacyTerms
incidentResponse
chain-specific integrations
Arc integration
local-first Tether deliverable
```

A score is preparation guidance, not eligibility.

## X. Investor/institutional gaps before external capital

Engineering can prove controls, but institutional diligence still needs human/company evidence:

- legal entity and governance;
- founder/team biographies and references;
- cap table;
- jurisdiction/product legal memo;
- AML/KYC/KYB/sanctions process where applicable;
- privacy/terms/risk disclosure package;
- external penetration test;
- smart-contract/bridge audit before CPT cross-chain use;
- incident response, BCP/DR, secret rotation;
- Cloudflare WAF/rate limits and observability;
- organization accounts + RBAC;
- dual-control approvals;
- MPC/qualified custody for institutional workflows;
- real uptime, revenue, retention, active users and execution metrics;
- audited financials when fundraising stage requires them.

## Y. Monitoring and emergency shutdown

Before external real-money testing:

- add Worker rate limits/WAF;
- health/error monitoring;
- exchange outage alerts;
- API usage anomaly detection;
- D1 backup/export process;
- secret rotation schedule;
- incident-response contacts/process.

If anything looks wrong:

1. set `ENABLE_PILOT_TRADING=false`;
2. set `ENABLE_LIVE_TRADING=false`;
3. redeploy;
4. emergency-pause affected user(s);
5. revoke exchange API keys at the exchange itself;
6. rotate suspicious secrets;
7. inspect `orders` and `audit_events` before re-enabling.

Provider-side API-key revocation is the final execution safety boundary.

## Z. Production checklist

- [ ] CI green on `main`
- [ ] Pages deployment green
- [ ] D1 real ID bound
- [ ] all D1 migrations applied
- [ ] Worker encryption secret stored and backed up
- [ ] `/api/health` says persistence true
- [ ] paper flow tested
- [ ] idempotency replay tested
- [ ] emergency pause tested
- [ ] testnet/sandbox tested
- [ ] Pilot allowlist contains only explicit wallets
- [ ] Pilot caps reviewed
- [ ] withdrawal/transfer disabled on exchange credentials
- [ ] one tiny Pilot order reconciled to provider statement
- [ ] USDC webhook verified
- [ ] USDT on-chain verification tested
- [ ] developer API key create/revoke/quota tested
- [ ] Pyth key configured if using Pyth
- [ ] Centrifuge/Kalshi public data routes tested
- [ ] rate limiting/monitoring configured
- [ ] legal/tax/AML obligations reviewed for intended launch scope
- [ ] full live remains OFF unless a separate launch decision is made
