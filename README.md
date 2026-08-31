# CryptoPilot

CryptoPilot is a lightweight **paper-first AI crypto portfolio autopilot**: adaptive risk profiling, portfolio analytics, news signals, social investing circles, Telegram hooks, USDC subscription hooks and exchange/DEX adapters.

## Test the frontend

The repository is configured for GitHub Pages. After Pages is enabled for **GitHub Actions**, the expected URL is:

`https://coolcryptomaniac.github.io/CryptoPilot/`

The frontend works without credentials in paper/demo mode. Open **Connect** to save the URL of a deployed Worker backend.

## What is implemented

- Responsive PWA-style dashboard with Neon and **Akatsuki** themes.
- Adaptive risk score from explicit investment style, investable-net-worth band, drawdown tolerance, hard allocation cap and paper-trade feedback.
- Hard risk rules override learned preferences.
- Coinbase public spot-price fallback in the browser.
- News/signal demo + server route for GDELT news retrieval.
- Paper orders and bot commands.
- Social circles for research, shared watchlists and paper portfolios; no pooled custody in V1.
- Exchange registry for Coinbase, Binance, Kraken and Robinhood Crypto.
- **Binance Spot/Testnet** signed-order backend implementation (live remains policy-gated).
- **Kraken REST AddOrder** signed-order backend implementation (live remains policy-gated).
- Coinbase Advanced Trade and Robinhood adapters are credential/status scaffolds pending their asymmetric signing implementation.
- **0x Swap API v2** quote backend; the user wallet should sign DEX transactions.
- Telegram webhook/response skeleton.
- USDC subscription UI: Free, 10, 35 and 100 USDC tiers. Coinbase Payment Acceptance hook is intentionally prevented from charging until operator/onboarding configuration is complete.
- CPT testnet ERC-20 prototype: fixed/capped 100M supply, no sale/yield contract.

## Safety architecture

1. Paper mode is the default.
2. Set `ENABLE_LIVE_TRADING=true` only on a secured backend after testing.
3. Never expose exchange secrets to GitHub Pages/browser code.
4. Create exchange credentials without withdrawal permission whenever the exchange supports it.
5. Use exchange testnets/sandboxes first.
6. AI/news output is advisory; deterministic portfolio/risk rules approve or reject orders.
7. DEX transactions should be signed by the user's own wallet. CryptoPilot should not store seed phrases/private keys.

## Worker deployment

```bash
cd worker
npm install
npx wrangler login
npx wrangler secret put BINANCE_API_KEY
npx wrangler secret put BINANCE_API_SECRET
npx wrangler secret put KRAKEN_API_KEY
npx wrangler secret put KRAKEN_API_SECRET
npx wrangler secret put ZEROX_API_KEY
npx wrangler secret put TELEGRAM_BOT_TOKEN
npm run deploy
```

Keep `ENABLE_LIVE_TRADING = "false"` during development. Binance defaults to testnet in `wrangler.toml`.

## Exchange notes

- Coinbase Advanced Trade uses short-lived JWT authentication; do not sign this from the public frontend.
- Binance supports REST/WebSocket trading and Spot Testnet; this repo signs REST orders server-side.
- Kraken private REST endpoints require nonce + API-Sign; this repo includes signing for `AddOrder`.
- Robinhood Crypto's official trading API is currently US-customer-only; keep it as a regional adapter, not the default for India/global users.
- 0x is the first DEX adapter because one integration can aggregate many EVM liquidity sources; the API returns transaction data, while the user wallet signs.

## CPT token model

The included `CryptoPilotToken.sol` is a **testnet utility prototype**, not a fundraising sale contract. Functional design lessons:

- BNB-like: optional subscription/fee discounts and ecosystem rewards.
- ETH/SOL-like: utility should come from actual app activity, not promised appreciation.
- Community tokens: contribution/reputation rewards and bounded governance.

Avoid guaranteed yield, revenue share, buyback promises or guaranteed price appreciation. A public token sale/fundraise can trigger securities, VDA, AML/KYC, tax and consumer-protection obligations depending on jurisdiction; obtain jurisdiction-specific legal review before enabling one.

## Next production milestones

- Server-side Coinbase JWT signing and order routes.
- Robinhood Ed25519 signing adapter and regional eligibility checks.
- D1/Postgres persistence, auth, encrypted credential vault and audit log.
- WalletConnect/embedded wallet integration for user-signed DEX trades.
- Verified stablecoin checkout after merchant onboarding.
- WebSocket market data + event queue + circuit breakers.
- Backtesting and per-strategy performance attribution before live-autopilot launch.
