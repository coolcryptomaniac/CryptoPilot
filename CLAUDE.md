# CryptoPilot — Claude Code instructions

Work as a cautious production engineer on CryptoPilot. The app is a non-custodial, paper-first crypto intelligence/trading platform with explicitly bounded real-money experiments.

## Never break these boundaries
- Do not commit secrets or wallet/exchange private keys.
- Keep unrestricted live trading and Pilot trading OFF by default.
- Do not add withdrawal/transfer exchange permissions.
- AI, news, social and prediction-market inputs may suggest/score; they may not bypass deterministic risk gates.
- Keep DEX and backend-free MicroTrade final execution user-signed.
- Treat Google/social identity as onboarding/profile data, not money authorization.
- Kalshi stays market-data-only unless a separately reviewed change is requested.
- Investor interest is non-binding and must not be represented as funded capital. Explicit contact-sharing consent is mandatory.
- Do not add a public CPT token sale, return/yield promise or fundraising smart contract without separate legal/security review.

## Before proposing a merge
Run:

```bash
node --check app.js
node --check production.js
node --check intelligence.js
node --check platform.js
node --check v23.js
cd worker && npm install --ignore-scripts --no-audit --no-fund && npm run check
```

Add tests whenever changing payment verification, authentication, encryption, order gating, Pilot limits, investor disclosures or API-key handling.

## Key files
- `AGENTS.md` — shared agent rules
- `worker/` — production backend
- `openapi.yaml` — B2B API contract
- `docs/PRODUCTION_DEPLOYMENT.md` — deployment/operator runbook

Claude Code supports MCP integrations. Configure only operator-approved MCP servers and never expose production secrets through MCP configuration committed to this repository.
