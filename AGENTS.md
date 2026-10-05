# Soldexter Agents

This project is an autonomous Solana research agent forked from Dexter (virattt/dexter).

Credits:
- Original Dexter: virattt/dexter (Dexter Labs)
- Soldexter: @aegntix / Mattae Cooper (aegntic/soldexter)

## Architecture

- Agent loop: plan -> execute tools -> validate -> refine
- Tools: Solana-native research. Core path is GMGN OpenAPI (read-only) plus public RPC, DexScreener, GeckoTerminal, RugCheck, and Jupiter price
- Wallet intelligence: `scan_wallet` (five layers), `audit_token_risk`, append-only paper ledger
- Subagents: `wallet-intel` plus the existing research workers. Subagents use the gather model
- Memory: Persistent via gbrain + SQLite
- Execution: Optional Jupiter swaps (paper-trade default). No new live-trading path. The double opt-in (`EXECUTION_ENABLED` and `MAINNET_ENABLED`) is unchanged

## Soldextra

`src/soldextra/registry.ts` is the only place a feature moves between `core` and `soldextra`.

Default, until the owner decides otherwise: a feature that needs a paid key is soldextra, and everything else is core. There is no price table in the registry. Set `tier` on a row to flip a feature. Soldextra stays off unless `SOLDEXTRA_ENABLED=true` and that feature's key is set. Missing data is `unverifiable (reason)`, not a guessed number.

## Hard rules

- No wallet private keys, no wallet connections, and no new trade execution
- GMGN is the official OpenAPI only (`https://openapi.gmgn.ai`). Do not call `/defi/quotation` or other site endpoints
- Do not wire GMGN swap, multi-swap, order, quote, or cooking. Do not read `GMGN_PRIVATE_KEY`
- Do not scrape X or GMGN pages. Do not vendor or run repos flagged in the 2026-10-05 prior-art review
- Measured numbers carry a source and a UTC timestamp. Do not invent a win rate, multiplier, or deviation

## Cost control

`SOLDEXTER_COST_CONTROL=local` sends fetch and parse turns to Ollama. `fast` uses the provider's fast model. Score and synthesis stay on the session model. Override one role with `SOLDEXTER_MODEL_FETCH`, `SOLDEXTER_MODEL_PARSE`, `SOLDEXTER_MODEL_SCORE`, or `SOLDEXTER_MODEL_SYNTHESIZE`.

## Build
```
bun install
bun run dev
```

`GMGN_API_KEY` is enough to boot. Helius is optional. Tests: `bun test`.
