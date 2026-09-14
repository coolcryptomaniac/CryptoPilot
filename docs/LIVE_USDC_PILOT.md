# Live USDC Pilot

## What this adds

`/pilot-fund/` is a zero-secret, self-custody live pilot surface for CryptoPilot.

- EIP-1193 wallet connect (Coinbase Wallet, MetaMask and compatible injected wallets)
- automatic Base network switch/add flow
- direct on-chain read of native Base USDC balance
- $1 / $2 / $3 / $5 live-test selector
- mandatory real-money + non-custody acknowledgements
- handoff to the official Uniswap interface for quote review and wallet signature
- no seed phrases, private keys, withdrawal permission, pooled customer wallet or hidden approval

## Mainnet configuration

- Chain: Base (`8453`, hex `0x2105`)
- Native gas token: ETH
- Native USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- USDC decimals: 6

The USDC address must be rechecked against Circle's official contract-address documentation before changing chains.

## Why the first public pilot is self-custody

A founder-controlled pooled wallet would materially increase security, operational, AML/KYC, custody and licensing exposure. The initial enthusiast pilot therefore keeps funds in each participant's own wallet and requires every live transaction to be reviewed and signed by that participant.

This still allows genuine mainnet testing with real USDC while keeping CryptoPilot out of seed-phrase custody.

## Identity roadmap

The current page uses the connected wallet as the transaction identity. The repository already has optional Google onboarding elsewhere in the product. For a unified consumer login, add an embedded-wallet provider such as Privy/Coinbase embedded wallets only after provider account/KYB setup and jurisdiction review. Google/social authentication must never substitute for the user's wallet signature when money moves.

## Public-pilot rules

1. Start at $1 and retain the $5 per-handoff cap until operational data supports a change.
2. Do not add leverage, margin, borrowing, futures or automatic withdrawals.
3. Never request a seed phrase or private key.
4. Do not present deposits/trades as guaranteed-return, savings, or yield products.
5. Add KYC/KYB/AML and jurisdiction controls before any custodial or pooled-money model.
6. Keep a prominent emergency-disable path for any future Worker-backed execution feature.

## Test checklist

- Desktop MetaMask: connect, network switch, balance read.
- Coinbase Wallet/mobile wallet browser: connect and balance read.
- Wrong chain: trade remains blocked.
- Base with zero USDC: trade remains blocked.
- Base with < selected amount: trade remains blocked.
- Both disclosures unchecked: trade remains blocked.
- Sufficient USDC + both checks: Uniswap handoff opens.
- Verify the final Uniswap quote, network, token addresses, fees and slippage before signing.
