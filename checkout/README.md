# CryptoPilot Checkout

A zero-dependency, mobile-first **INR/UPI → USDC/USDT** checkout that can be embedded in any website or GitHub Pages project.

It is intentionally non-custodial: the regulated ramp provider handles KYC, fiat payment and crypto delivery directly to the user's wallet. CryptoPilot never asks for a seed phrase/private key and does not receive user INR or crypto.

## What is included

- `cryptopilot-checkout.js` — reusable `<cryptopilot-checkout>` Web Component with isolated Shadow DOM styling.
- `index.html` + `standalone.js` — hosted checkout page suitable for a normal link or an iframe.
- `embed-example.html` — iframe integration that passes wallet/email at runtime with `postMessage`.
- A backend adapter that probes `/api/checkout/config` and `/api/checkout/preview` for compatible backends, then falls back to CryptoPilot's current `/api/ramp/config` and `/api/ramp/preview` routes.

The first live provider adapter is OnMeta's official on-ramp widget. The component listens to the provider's order/action/completion events and re-emits stable CryptoPilot checkout events for the host application.

## 1. Direct Web Component integration

```html
<script type="module" src="https://coolcryptomaniac.github.io/CryptoPilot/checkout/cryptopilot-checkout.js"></script>

<cryptopilot-checkout
  id="checkout"
  api-base="https://YOUR-WORKER.workers.dev"
  brand="My App"
  theme="dark"
  accent="#7cf7c4"
  source="my-github-project">
</cryptopilot-checkout>

<script type="module">
  await customElements.whenDefined('cryptopilot-checkout');
  const checkout = document.querySelector('#checkout');

  checkout.setOptions({
    amountInr: 1000,
    token: 'USDC',
    chainId: '137',
    walletAddress: '0x...',
    email: 'user@example.com'
  });

  checkout.addEventListener('cp-checkout:complete', (event) => {
    console.log('completed', event.detail);
  });
</script>
```

### Supported attributes/options

| Option | Example | Purpose |
|---|---|---|
| `apiBase` / `api-base` | `https://...workers.dev` | Backend that returns provider configuration and fee preview |
| `brand` | `RoamWise` | Host brand shown in checkout |
| `theme` | `dark`, `light`, `akatsuki` | Isolated checkout theme |
| `accent` | `#7cf7c4` | Six-digit brand accent |
| `amountInr` / `amount` | `1000` | Prefilled INR amount |
| `token` | `USDC`, `USDT` | Stablecoin |
| `chainId` / `chain-id` | `137`, `8453`, `56` | Polygon, Base or BNB Smart Chain |
| `walletAddress` / `wallet` | `0x...` | Required receiving EVM wallet |
| `email` | `user@example.com` | Optional provider prefill; avoid putting it in URLs |
| `source` | `roamwise-checkout` | Project identifier sent in provider metadata |

## 2. Hosted iframe integration

Use the hosted checkout without copying any component files:

```html
<iframe
  id="cryptoCheckout"
  src="https://coolcryptomaniac.github.io/CryptoPilot/checkout/?embed=1"
  title="Crypto checkout"
  style="width:100%;height:760px;border:0;border-radius:24px">
</iframe>
<script>
  const frame = document.querySelector('#cryptoCheckout');
  const origin = 'https://coolcryptomaniac.github.io';

  frame.addEventListener('load', () => {
    frame.contentWindow.postMessage({
      type: 'cryptopilot-checkout:init',
      options: {
        apiBase: 'https://YOUR-WORKER.workers.dev',
        brand: 'My App',
        amountInr: 1000,
        token: 'USDC',
        chainId: '137',
        walletAddress: '0x...',
        email: 'user@example.com',
        source: 'my-app'
      }
    }, origin);
  });

  window.addEventListener('message', event => {
    if (event.origin !== origin) return;
    if (event.data?.type === 'cryptopilot-checkout:complete') {
      console.log(event.data.detail);
    }
  });
</script>
```

The iframe route deliberately does **not** require email or wallet in its URL, reducing accidental logging/history exposure.

## 3. Copy into another GitHub repository

Copy the `checkout/` folder into any static repository and serve it through GitHub Pages, Netlify, Vercel, Cloudflare Pages or a normal web server. Point `api-base` at a deployed compatible Worker.

If each product should have its own OnMeta merchant account, deploy its own Worker and set that project's provider credentials there. If several products belong to the same approved merchant, they can use the same backend and distinguish traffic with `source`.

## Host events

The component dispatches bubbling/composed CustomEvents:

- `cp-checkout:ready`
- `cp-checkout:config`
- `cp-checkout:preview`
- `cp-checkout:review`
- `cp-checkout:opened`
- `cp-checkout:provider-event`
- `cp-checkout:order`
- `cp-checkout:action`
- `cp-checkout:complete`
- `cp-checkout:error`
- `cp-checkout:closed`
- `cp-checkout:sell-gated`

Hosted iframe mode mirrors them to the parent as `postMessage` types such as `cryptopilot-checkout:complete`.

## Fee policy

CryptoPilot's default platform fee target remains:

- **0.25%**
- **₹1 minimum**
- **₹25 maximum**

Provider spread, payment, network/gas and applicable tax/TDS charges remain separate and come from the provider's executable quote. CryptoPilot platform-fee collection remains disabled until the provider contract explicitly supports a transparent partner/client fee.

## Provider setup

The Worker keeps provider configuration outside static GitHub code. For OnMeta staging:

```bash
cd worker
npx wrangler secret put ONMETA_WIDGET_API_KEY
```

Keep:

```text
ONMETA_ENV=staging
RAMP_PLATFORM_FEE_COLLECTION_ENABLED=false
```

Production requires merchant KYB/approval. Do **not** commit the OnMeta client secret (`ONMETA_API_SECRET`). The client secret is only for server-side signed API/webhook work.

## Sell / crypto → INR

The UI exposes the Sell direction but keeps it gated until a server-side off-ramp adapter is configured. OnMeta's widget is on-ramp only; its off-ramp flow requires API authentication, KYC, a verified bank account, sell quotation, order creation, user crypto transfer, transaction-hash submission and status/webhook handling.

Do not advertise arbitrary wallet → arbitrary UPI-ID payout. The documented off-ramp settles INR to the provider-verified bank destination.

## Security boundaries

- The component never accepts a seed phrase or private key.
- Provider SDK URLs are explicitly allowlisted to official staging/production OnMeta SDK origins.
- The OnMeta API secret is never sent to browsers.
- Sensitive host values such as email can be passed at runtime rather than through URL query strings.
- Checkout completion events are UX signals. Server-side fulfillment should rely on a verified provider webhook before releasing valuable goods/services.
