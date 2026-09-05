# Regulated INR ramp

CryptoPilot now has a provider-ramp layer for INR → crypto without CryptoPilot taking custody of user funds.

## Initial provider

The first UI adapter targets OnMeta's hosted/widget on-ramp because its current public documentation supports INR, UPI, built-in KYC/compliance and a staging environment. Production use still requires merchant onboarding/KYB and provider approval.

The browser widget supports **on-ramp only**. Crypto → INR off-ramp remains a server/API integration because the provider requires KYC plus a verified bank destination. Do not market this as arbitrary wallet → arbitrary UPI-ID payout.

## CryptoPilot fee policy

Default target fee:

- 25 basis points (0.25%)
- ₹1 minimum
- ₹25 maximum

The fee is deliberately **not collected by default**. Set `RAMP_PLATFORM_FEE_COLLECTION_ENABLED=true` only after the chosen provider contract explicitly supports a transparent partner/client-fee mechanism. Never simulate the fee by receiving user INR/crypto into a CryptoPilot-controlled account or by hiding the fee in an exchange rate.

Provider conversion spread, payment fees, network/gas fees and applicable tax/TDS remain separate and must be displayed from the provider's executable quote.

## Worker configuration

Safe public configuration values:

```text
RAMP_ENABLED=true
RAMP_ONMETA_ENABLED=true
ONMETA_ENV=staging
RAMP_PLATFORM_FEE_BPS=25
RAMP_PLATFORM_FEE_MIN_INR=1
RAMP_PLATFORM_FEE_MAX_INR=25
RAMP_PLATFORM_FEE_COLLECTION_ENABLED=false
```

Set the OnMeta widget Client ID/API key as a Worker secret or protected environment value rather than committing it:

```bash
cd worker
npx wrangler secret put ONMETA_WIDGET_API_KEY
```

Never expose or commit `ONMETA_API_SECRET`. It is reserved for signed backend API calls/webhook verification when the off-ramp API is implemented.

For production, switch only after KYB approval:

```text
ONMETA_ENV=production
```

## Public API

`GET /api/ramp/config`

Returns the enabled provider, supported token/network choices, fee policy and user-facing disclosures. It never returns `ONMETA_API_SECRET`.

`POST /api/ramp/preview`

Example body:

```json
{
  "amountInr": 1000,
  "token": "USDC",
  "chainId": "137"
}
```

This endpoint previews the CryptoPilot fee policy only. It is **not** an executable crypto quote; the regulated provider supplies the actual rate and provider fees.

## Frontend flow

1. User opens **Buy / Sell**.
2. Enters INR amount, USDC/USDT, network and their own wallet address.
3. CryptoPilot loads `/api/ramp/config` and `/api/ramp/preview`.
4. If OnMeta is configured, CryptoPilot loads the provider widget and preselects INR + UPI.
5. The provider handles KYC, payment and delivery directly to the user's wallet.
6. CryptoPilot does not hold INR, crypto or private keys.

## Production checklist

- Complete provider merchant KYB.
- Start in staging and confirm the full UPI/KYC flow.
- Confirm token/network allowlist for the merchant account.
- Contractually confirm whether a partner/client fee can be collected and how it appears in provider quotes/receipts.
- Keep fee collection disabled until that confirmation exists.
- Add provider webhook verification before trusting any completion status server-side.
- Implement off-ramp only through the documented server API with verified bank payout and required AML/KYC controls.
- Add a second regulated provider later and route by executable net quote/availability instead of hard-coding one provider.
