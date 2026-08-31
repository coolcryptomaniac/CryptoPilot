# CryptoPilot 2.3 test matrix

## Public GitHub Pages
- [ ] Liquid Neon theme loads
- [ ] Akatsuki Storm theme loads
- [ ] reduced-motion preference disables nonessential animation
- [ ] MicroTrade accepts $1–$5 and rejects >$5
- [ ] local day/month intent counters update
- [ ] Uniswap opens with Base + USDC input and user wallet remains final signer
- [ ] Hyperliquid public mids load or fail gracefully
- [ ] WhatsApp/X/LinkedIn/Facebook/Telegram links render
- [ ] native share/copy-link fallback works
- [ ] Google GIS loads only after an operator/client ID is entered
- [ ] Google profile never toggles CEX/DEX execution permissions
- [ ] backendless investor form opens a visible mailto to founder@roamwise.co.in
- [ ] disclosure and NDA/data-room documents are clickable
- [ ] Tempo/Flying Tulip benchmark cards render

## Worker + D1
- [ ] migrations 0001–0003 apply cleanly
- [ ] EOI requires all four acknowledgements
- [ ] EOI rejects amount < $1M or > $100B
- [ ] full EOI payload is encrypted before D1 storage
- [ ] public summary contains no email/phone/city/name PII
- [ ] duplicate same-email EOI is suppressed for 10 minutes
- [ ] missing Resend config stores EOI without failing submission
- [ ] configured Resend sender notifies founder and marks notified_at
- [ ] Hyperliquid normalized route is read-only
- [ ] /v1/hyperliquid/mids consumes API quota
- [ ] existing Pilot/live gates remain unchanged

## Regression
- [ ] CoinDesk/Cointelegraph/Investing.com hourly redeploy still publishes v23 files
- [ ] existing wallet auth works
- [ ] existing USDC/USDT subscription logic works
- [ ] Binance testnet path works
- [ ] 0x remains user-signed
- [ ] CPT remains testnet/no-sale
