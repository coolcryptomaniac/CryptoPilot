# CryptoPilot agent instructions

These instructions apply to Codex and other coding agents working in this repository.

## Product goal
Build a lightweight, non-custodial, risk-gated crypto intelligence/trading product. Preserve the public GitHub Pages demo and keep real-money execution opt-in and bounded.

## Mandatory safety invariants
- Never commit API keys, seed phrases, private keys, OAuth client secrets, Cloudflare tokens or encryption keys.
- Never enable `ENABLE_LIVE_TRADING` or `ENABLE_PILOT_TRADING` by default.
- Never add withdrawal/transfer permissions to exchange adapters.
- Never let an LLM/news/social signal bypass deterministic risk gates, idempotency or emergency pause.
- Keep Telegram/Kalshi/social logins non-trading unless a separately reviewed design explicitly changes that boundary.
- Wallet/social login signatures are authentication, not generic authorization to move funds.
- Keep DEX/microtrade actions user-signed. Browser-only $1-$5 budgets are UX guardrails, not security controls.
- Do not create a public CPT token sale, yield promise, guaranteed return or fundraising smart contract without a separate legal/security review.
- Investor submissions are non-binding expressions of interest. Never label them funded/committed capital. Require the explicit risk, non-binding, NDA/disclosure and contact-sharing acknowledgements.
- Do not transmit investor/contact data secretly. The submitter must be told where it goes.

## Engineering workflow
1. Work on a feature branch.
2. Run frontend syntax checks and `cd worker && npm run check`.
3. Add/update tests for financial control changes.
4. Prefer official provider APIs/docs and record regional/provider constraints.
5. Merge only when CI passes.
6. Keep GitHub Pages functional without a private backend where practical.

## Architecture landmarks
- `app.js`: demo/paper portfolio core
- `production.js`: wallet auth, DEX, backtests
- `intelligence.js`: news/grants/institutional room
- `platform.js`: Pilot, USDT, infrastructure, B2B API
- `v23.js`: microtrade, social, investor EOI, AI-dev UX
- `worker/`: authenticated production backend
- `openapi.yaml`: sellable B2B API contract

## Agent integration
Codex can use this repository directly for reviewed code changes. OpenAI's current developer platform supports Codex and plugin/MCP-based integrations; use the current official OpenAI developer documentation rather than hard-coding stale CLI flags or model names.
