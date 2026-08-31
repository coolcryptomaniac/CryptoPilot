# CryptoPilot production setup

CryptoPilot 2.0 is paper-first. Real exchange execution is deliberately gated by both the Worker and the authenticated user.

## D1 persistence

From `worker/`:

```bash
npx wrangler d1 create cryptopilot-db
```

Copy the returned database ID into `worker/wrangler.toml`, uncomment `[[d1_databases]]`, then run:

```bash
npm install
npm run db:migrate:local
npm run db:migrate:remote
```

The migration creates users, wallet challenges, hashed sessions, encrypted exchange connections, adaptive risk profiles, portfolios, positions, idempotent orders, subscriptions, audit events, and strategy-run history.

## Credential encryption

Generate a 32-byte key outside GitHub:

```bash
openssl rand -base64 32
npx wrangler secret put CREDENTIAL_MASTER_KEY
```

Exchange credentials are AES-256-GCM encrypted before D1 storage. The master key stays in Worker secrets.

## Wallet login

1. `POST /api/auth/wallet/challenge` with an EVM address.
2. Sign the exact challenge with `personal_sign`.
3. `POST /api/auth/wallet/verify`.
4. The Worker returns a random opaque bearer session; D1 stores only its SHA-256 hash.

The signed message explicitly says that login does not authorize a trade or token transfer.

`production.js` supports injected EIP-1193 wallets. Reown/WalletConnect can supply an EIP-1193 provider to the same flow; see `web3/reown-appkit.example.mjs`. A real Reown Project ID is required to ship the modal.

## Exchange credentials

Generate exchange keys without withdrawal/transfer permissions. CryptoPilot rejects permission labels containing `withdraw` or `transfer`.

Authenticated example:

```http
POST /api/exchanges/coinbase
Authorization: Bearer <session>
Content-Type: application/json
```

```json
{
  "mode": "paper",
  "permissions": ["read", "trade"],
  "credentials": {
    "apiKeyId": "organizations/.../apiKeys/...",
    "apiKeySecret": "-----BEGIN EC PRIVATE KEY-----\\n..."
  }
}
```

Credential shapes:

- Coinbase: `apiKeyId`, `apiKeySecret`
- Binance: `apiKey`, `apiSecret`
- Kraken: `apiKey`, `apiSecret`
- Robinhood Crypto: `apiKey`, `privateKeyBase64`

Saving/replacing credentials resets that connector's `live_enabled` flag to false.

## Live-order constitution

All `/api/orders/:exchange` requests require `X-Idempotency-Key`.

Before any non-paper request is sent, the Worker checks:

- emergency-pause state;
- connector `trade` permission;
- global `ENABLE_LIVE_TRADING=true` for actual live mode;
- connector-level authenticated live switch;
- explicit USD notional for deterministic risk checks;
- adaptive per-order limit bounded by `MAX_LIVE_ORDER_USD`;
- rolling 24-hour order-count breaker bounded by `MAX_DAILY_LIVE_ORDERS`.

Binance Spot Testnet is intentionally exempt from the global live switch, so it is the preferred first execution test. Coinbase's static Advanced Trade sandbox route remains for response-shape testing.

## 0x DEX

```bash
npx wrangler secret put ZEROX_API_KEY
```

The Worker retrieves a 0x v2 allowance-holder quote. The user's wallet signs the final transaction. If approval is required, approve only the allowance spender returned by 0x; never approve the execution/Settler target. CryptoPilot does not store wallet seed phrases/private keys.

## USDC subscriptions

Coinbase Payment Acceptance requires operator onboarding and CDP credentials:

```bash
npx wrangler secret put COINBASE_PAYMENT_API_KEY_ID
npx wrangler secret put COINBASE_PAYMENT_API_KEY_SECRET
npx wrangler secret put COINBASE_WEBHOOK_SECRET
```

Configure either `PAYMENT_TARGET_ACCOUNT_ID` or `PAYMENT_TARGET_ADDRESS` (with network, default `base`). Prices are server-side: Pilot 10 USDC, Pro 35 USDC, Collective 100 USDC. The browser cannot lower them. Payment webhooks are timestamp/HMAC checked before subscription state changes.

## Market stream and backtesting

The deployed Pages build loads `production.js`, which subscribes to Coinbase Advanced Trade's public ticker WebSocket for BTC-USD, ETH-USD, and SOL-USD. Existing REST spot pricing remains the fallback.

`POST /api/backtest` runs an understandable SMA-cross baseline against Coinbase public candles with fees and max-drawdown reporting. Add walk-forward/out-of-sample testing before any strategy can graduate to real money.

## Telegram

Telegram remains status/alerts only. Trading commands are intentionally not accepted through chat.

## Before real money

Keep `ENABLE_LIVE_TRADING=false` until D1 and migrations are deployed, wallet auth/emergency stop/idempotency are tested, Binance testnet is stable, provider failure paths are exercised, webhook verification is tested, rate limiting/abuse controls are added, dependency/security review is complete, and applicable legal/compliance requirements are addressed. CPT remains a testnet utility prototype; no token sale/yield/fundraising contract is enabled in this engineering layer.
