# Changelog

## Unreleased

### Added

- Wallet-intelligence scan (`scan_wallet`) with owner weights (inverse loss 20%, liquidity ghost 25%, irrational conviction 20%, CTO meta-reader 20%, consensus deviation 15%), tiers (PRECOGNITIVE, SOVEREIGN, EMERGING, NOISE), and red-flag disqualifiers. A single measured layer is PROVISIONAL. Fields that were not measured are `unverifiable (reason)` and carry no invented win rate, multiplier, or deviation
- Risk auditor (`audit_token_risk`) for mint and freeze authority, Token-2022 extensions, LP status, creator history, a rebuilt funding-graph bundler check, and loud flags for drainers, honeypots, and fake-airdrop bait
- Append-only paper ledger (`log_paper_signal`, `score_paper_signals`) scored at 1h, 24h, and 72h after fees and slippage
- Soldextra registry at `src/soldextra/registry.ts`. Default: paid-key features are soldextra, everything else is core. Flip `tier` on a row to move a feature. No prices are encoded
- Official GMGN OpenAPI client. Read-only query routes only. Free tier is paced at 5/5 with backoff on 429
- Configurable model roles (`SOLDEXTER_COST_CONTROL` and `SOLDEXTER_MODEL_*`) so fetch and parse can use Ollama or a fast model
- `wallet-intel` subagent

### Changed

- GMGN tools no longer call `gmgn.ai/defi/quotation`. Those routes are blocked and outside the official API
- Token, holder, DEX, and trending tools fall back to keyless sources when Helius or Birdeye is unset, and they no longer fill missing holder or win-rate fields with zero
- Helius parsed-transaction reads request `maxSupportedTransactionVersion: 1`
- The live-trade gate is unchanged. This release adds no swap, order, or cooking path

### Fixed

- Meteora DLMM program id is `LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo`
