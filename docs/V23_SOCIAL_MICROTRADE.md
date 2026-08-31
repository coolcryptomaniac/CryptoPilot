# CryptoPilot 2.3 — MicroTrade, social distribution, investor EOI and AI development

## 1. Backend-free $1–$5 MicroTrade

The public GitHub Pages app can launch a real, user-signed Uniswap swap without a CryptoPilot Worker. It uses the official Uniswap interface custom-link flow and pre-fills Base USDC as the input asset.

This is intentionally a handoff, not a hidden trade bot:

1. CryptoPilot records a local browser intent.
2. CryptoPilot opens the official Uniswap interface.
3. The user checks chain, token, route, price impact and gas.
4. The user's wallet signs or rejects the transaction.
5. CryptoPilot never sees the seed/private key and never presses final confirmation.

Browser UI defaults:

- $5 maximum launch intent
- $10 local rolling 24-hour intent budget
- $100 local rolling 30-day intent budget

These browser counters are **UX guardrails only**. They can be cleared or bypassed and are not a financial-security control. For enforceable server-side controls use the existing authenticated Pilot/CEX architecture and venue/account controls.

Hyperliquid is integrated as public `allMids` market data. Do not use it as the $1–$5 rail: its venue documentation includes a minimum-order-value rejection at $10. A future authenticated Hyperliquid connector must use a separately reviewed signer/API-wallet design and must not reuse social-login authorization.

## 2. Social sharing

The public app includes:

- WhatsApp share
- X/Twitter share
- LinkedIn share
- Facebook share
- Telegram share
- native Web Share for Instagram/other mobile apps
- copy-link fallback

Instagram has no generic browser share endpoint equivalent to WhatsApp/X/LinkedIn; the native share sheet is the cleanest device-level path.

## 3. Google/social onboarding

The Social tab can load Google Identity Services with an operator-supplied Google OAuth Client ID. That client ID is a public application identifier, not a secret.

The backend-free implementation stores only a local social profile in the browser. It does **not** treat the Google credential as authorization for a trade or token transfer.

For production account linking:

- verify Google/OAuth tokens server-side;
- link them to a CryptoPilot user identity;
- continue to require wallet/exchange-specific authorization for money movement;
- consider Web3Auth/Privy only after creating operator project IDs and reviewing their current security/account-recovery model.

## 4. Investor expression-of-interest page

The Commitment tab is not a payment page and not a binding subscription/token-sale instrument.

Required fields:

- name/firm
- indicative amount from $1M to $100B
- email and phone
- country and city
- preferred future settlement method (crypto, bank transfer, card, cash/other regulated settlement, other)
- optional settlement detail such as USDC/USDT/BTC

Required acknowledgements:

- future investment could lose all capital;
- submission is a non-binding expression of interest;
- NDA/full-disclosure process is requested before any binding transaction;
- explicit consent that the contact/details may be provided to `founder@roamwise.co.in`.

### Without Worker

The form opens the submitter's email client with a prefilled message to `founder@roamwise.co.in`. Nothing is silently transmitted.

### With Worker + D1

Apply migration `0003_v23_investor_interest.sql`.

The Worker:

- validates all disclosures;
- requires $1M–$100B amount bounds;
- hashes the email for duplicate suppression;
- encrypts the complete EOI payload with `CREDENTIAL_MASTER_KEY` using the existing AES-GCM vault;
- stores only amount/country/hash separately for aggregation;
- never stores the visitor IP;
- exposes only aggregate non-binding interest publicly.

Optional founder email notification:

```bash
cd worker
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put INVESTOR_NOTIFY_FROM
# optional; defaults to founder@roamwise.co.in
npx wrangler secret put INVESTOR_NOTIFY_TO
```

`INVESTOR_NOTIFY_FROM` must be a sender/domain verified with the email provider. The notification describes the submission as non-binding and does not imply funds were received.

Routes:

```text
POST /api/investor/interest
GET  /api/investor/summary
```

## 5. Hyperliquid API

Public normalized route:

```text
GET /api/hyperliquid/mids
```

B2B API-key route:

```text
GET /v1/hyperliquid/mids
```

Both are market-data-only.

## 6. Codex + Claude Code

The repository contains:

- `AGENTS.md` for Codex/shared coding-agent rules
- `CLAUDE.md` for Claude Code rules
- `openapi.yaml` as the CryptoPilot B2B API contract

Both agent instruction files require CI/testing and preserve the same financial-safety boundaries. Use the current official OpenAI/Anthropic documentation when configuring MCP servers because CLI/config formats can evolve.

## 7. Tempo lessons

Tempo is useful as a product benchmark because it has a narrow payments-first thesis rather than a generic L1 pitch. CryptoPilot should learn from:

- stablecoin-native payments as a first-class workflow;
- microtransaction and agentic-commerce primitives;
- sponsored/gas-abstracted user experience;
- payment-specific metadata/memos;
- smart-account/passkey UX;
- deep strategic design partnerships.

A Tempo integration should be added only once a concrete CryptoPilot payment/agent workflow needs it; do not add chains purely to inflate a grant checklist.

## 8. Flying Tulip lessons

Useful product/fundraising lessons include:

- primary investors on visibly aligned terms;
- explicit onchain backing/redemption mechanics;
- team incentives tied to actual product revenue rather than a large free initial token allocation;
- public capital-allocation dashboards;
- staged product rollout and visible operating metrics;
- transparency about redemptions and changing market conditions.

CryptoPilot can copy the **transparency and alignment principles** without copying a token public sale. Any CPT issuance/sale/redemption structure needs separate securities/tax/legal analysis, audited smart contracts and jurisdiction-specific eligibility controls.

## 9. Visual system

`v23.css` adds GPU-light gradients, animated sheen/orbs, Liquid Neon and Akatsuki Storm themes, while respecting `prefers-reduced-motion`.

The goal is crypto-native visual energy without turning the app into a resource-heavy canvas/WebGL experience.
