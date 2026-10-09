# Robinhood Agentic Trading integration — implementation contract

Status: design only; **not connected or live**. This document is not a claim that CryptoPilot can trade through Robinhood today.

## Official interfaces

- Robinhood Trading MCP: `https://agent.robinhood.com/mcp/trading` (official first-party endpoint; user authentication and Agentic Account onboarding required). See https://robinhood.com/us/en/support/articles/agentic-trading-overview/ .
- Separate Robinhood Crypto Trading API: https://docs.robinhood.com/ . This is a first-party, US-only API using Ed25519 request signing (`x-api-key`, `x-signature`, `x-timestamp`), **not** a wrapper and **not** interchangeable with MCP OAuth/session authorization.
- Do not use `robin_stocks`, scraped cookies, password collection, or unofficial Robinhood wrappers.

## Eligibility and UX

Show Robinhood only as an optional provider for eligible US users; no claims of availability in India or all US states. The MCP requires desktop authentication/onboarding and a Robinhood Agentic Account; users must independently open a corresponding Robinhood Crypto account and accept updated agreements. The agent can trade supported crypto pairs only in the Agentic Account; it cannot transfer, stake, or lend crypto. The agent may read other Robinhood account information, so obtain clear informed consent before connecting.

## Engineering acceptance criteria

1. Add an optional `robinhood_agentic` provider behind a default-off server-side feature flag. Keep the GitHub Pages demo and Base/USDC providers unchanged.
2. Implement an authenticated, server-side MCP client only after verifying Robinhood's current supported OAuth flow, tool discovery/schema, terms and third-party application eligibility. Never assume the documented MCP URL itself authorizes arbitrary CryptoPilot users. Do not put OAuth tokens, API keys or signing keys in GitHub Pages, localStorage, repository files or logs.
3. Explicit connect/disconnect and eligibility checks; display account scope and any account-wide read access. No password or session-cookie collection. Use least-privilege token storage and revocation.
4. Default to read-only/paper mode. Live trading requires a separately enabled server-side flag, user confirmation, a funded dedicated Agentic Account, and deterministic limits (per-order, daily, monthly, symbol allowlist, available balance, stale-quote rejection, idempotent client order IDs, emergency kill switch). LLM text cannot override these controls.
5. Validate provider tool schema and trading pairs at runtime; do not invent MCP tool names or presume sandbox support. Reconcile orders after timeouts before retrying; audit approvals and provider responses without secrets.
6. Add mocked contract tests for auth expiry, ineligible regions, order rejection, duplicate submission, timeout/reconciliation, limit exhaustion, disconnect, and disabled live trading. No live orders in CI.
7. Confirm Robinhood's current API terms and whether the intended multi-user CryptoPilot service is permitted before implementing or advertising public execution.

## Explicit non-goals

No withdrawal, transfer, staking or lending capability; no account credential sharing; no automatic migration of Base funds to Robinhood; no implied availability for Indian users; no live orders until reviewed and explicitly enabled.
