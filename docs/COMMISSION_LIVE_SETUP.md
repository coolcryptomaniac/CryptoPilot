# CryptoPilot live commission setup

CryptoPilot should collect disclosed integrator fees through the first-party 0x Swap API v2 rather than hidden spread or a pooled customer wallet.

## Revenue destination

0x sends the integrator fee on-chain to the address supplied as `swapFeeRecipient`. Therefore revenue accumulates in a CryptoPilot-controlled treasury wallet, not inside GitHub, Cloudflare, Uniswap, or a CryptoPilot database.

For the Base USDC pilot, configure a dedicated Base-compatible treasury address and request the fee in USDC where supported. Do not use a user's deposit address, exchange deposit address, personal hot wallet, or any address whose private key is stored in this repository.

Recommended production configuration (Cloudflare Worker secrets/vars):

- `ZEROX_API_KEY` — secret, server-side only.
- `CRYPTOPILOT_FEE_RECIPIENT` — dedicated treasury wallet address.
- `CRYPTOPILOT_SWAP_FEE_BPS=50` — 0.50% initial disclosed pilot fee. Operator can lower this before launch.
- `CRYPTOPILOT_FEE_TOKEN=USDC` — prefer USDC when USDC is either buyToken or sellToken.

The client must never receive `ZEROX_API_KEY`.

## Quote flow

The Worker requests 0x Swap API v2 with the connected user's address as `taker` and includes:

- `swapFeeRecipient=<CRYPTOPILOT_FEE_RECIPIENT>`
- `swapFeeBps=<CRYPTOPILOT_SWAP_FEE_BPS>`
- `swapFeeToken=<USDC contract>` when permitted

The returned `fees.integratorFee` must be displayed before the user signs. The user remains the taker and signs the transaction in their own wallet.

## Revenue ledger

Record non-sensitive execution metadata after confirmed transactions: transaction hash, chain, sell/buy token, gross amount, integrator fee amount/token, 0x request/zid when available, timestamp, and user wallet hash (not seed/private key). A revenue dashboard should aggregate:

- lifetime integrator fees
- today / 7d / 30d fees
- fee token balances
- trade count and volume
- effective fee rate
- failed/reverted trades separately

On-chain treasury balance is the source of truth for accumulated commission; the database ledger is accounting/analytics only.

## Live-test gate

Keep the current $1/$2/$3/$5 pilot cap. Test first with a founder-controlled test wallet and a separate treasury wallet. Confirm that the quote explicitly contains `fees.integratorFee`, the UI shows it, the user signs the exact quoted transaction, the trade settles, and the treasury receives the expected fee before opening the feature to external users.

Do not claim that a successful transaction eliminates tax, AML, VDA-service, consumer-protection, or other regulatory obligations. Real-money rollout should be jurisdiction-gated as required.