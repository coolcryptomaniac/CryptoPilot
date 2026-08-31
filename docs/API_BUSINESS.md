# CryptoPilot API — B2B product

CryptoPilot API packages crypto intelligence and deterministic risk controls into one business-facing API without exposing user exchange secrets or giving third-party API clients custody.

## Positioning

Most APIs sell one layer: prices, news, a DEX quote, an exchange connector or a blockchain RPC. CryptoPilot's API product combines:

- curated multi-publisher crypto news;
- grant/funding readiness and gap analysis;
- integration/provider capability registry;
- public RWA discovery via Centrifuge;
- DeFi protocol/TVL context via DefiLlama;
- optional Pyth oracle data;
- optional Kalshi prediction-market data as **signal-only** context;
- deterministic risk scoring/limits;
- a separate authenticated consumer execution stack behind the same platform.

The sellable differentiator is the **risk-gated decision layer**: a client can ask what evidence exists and what size/risk boundary applies without handing CryptoPilot a withdrawal key.

## Authentication

Create a key from an authenticated CryptoPilot wallet session:

```http
POST /api/developer/keys
Authorization: Bearer <wallet-session>
Content-Type: application/json

{"name":"Production backend"}
```

The response contains a raw key such as `cp_live_...` exactly once. D1 stores only its SHA-256 hash.

Use:

```http
X-CryptoPilot-Key: cp_live_...
```

## Default quotas

| Subscription | Calls / rolling 24h |
|---|---:|
| Free | 100 |
| Pilot | 1,000 |
| Pro | 5,000 |
| Collective | 50,000 |

These are defaults and can be adjusted later when usage/cost data exists.

## Endpoints

### `GET /v1/news`

Parameters: `source`, `q`, `limit`.

Returns headline/short-excerpt intelligence from CryptoPilot's curated publisher layer.

### `GET /v1/grants`

Parameters: `ecosystem`, `status`.

Returns the current CryptoPilot funding registry, preparation score and missing evidence. A readiness score is **not** an eligibility/funding guarantee.

### `GET /v1/integrations`

Returns current provider adapters and whether operator credentials are configured.

### `GET /v1/rwa/pools`

Parameter: `limit`.

Returns active Centrifuge RWA pools/tokens from its public GraphQL API.

### `GET /v1/defi/protocols`

Parameter: `limit`.

Returns high-level DefiLlama protocol/TVL context.

### `GET /v1/prediction/markets`

Parameters: `limit`, `series_ticker`.

Requires configured Kalshi API credentials on the Worker. Market data only; CryptoPilot does not expose autonomous Kalshi wagering through this endpoint.

### `GET /v1/oracle/pyth?id=<feed-id>`

Requires `PYTH_API_KEY`. Multiple `id` query parameters are supported.

### `POST /v1/risk/quote`

Example:

```json
{
  "style":"Balanced",
  "networth":50000,
  "drawdown":18,
  "singleCap":28
}
```

Returns a deterministic CryptoPilot risk score and operator-bounded limits. It does not authorize an order.

## Key management

```http
GET /api/developer/keys
Authorization: Bearer <wallet-session>
```

```http
GET /api/developer/usage
Authorization: Bearer <wallet-session>
```

```http
DELETE /api/developer/keys/<id>
Authorization: Bearer <wallet-session>
```

## Suggested commercial packaging

### Free developer

- 100 calls/day
- News + grants + integration registry
- Public docs

### Pilot / indie

- 1,000 calls/day
- RWA + DeFi data
- Risk quote API
- Email/Telegram support later

### Pro

- 5,000 calls/day
- Oracle/prediction adapters when operator integrations are configured
- Higher retention and export limits
- Priority support

### Collective / business

- 50,000 calls/day
- organization keys/RBAC (next milestone)
- webhook delivery (next milestone)
- SLA/private deployment discussions

## Future enterprise add-ons

- organization accounts + RBAC;
- dual-control approvals;
- signed webhooks;
- client-specific risk policies;
- strategy backtest API;
- tax-lot/accounting exports;
- institutional custody/MPC adapters;
- private VPC/Cloudflare deployment;
- customer-managed encryption keys;
- Chainlink/Pyth institutional feeds;
- more RWA providers and permissioned-asset eligibility metadata.

## RoamWise partner bundle

CryptoPilot includes a RoamWise partner endpoint and referral URL. A future combined API package could offer crypto intelligence + travel intelligence for fintechs, wallets and loyalty apps without mixing custody between the products.
