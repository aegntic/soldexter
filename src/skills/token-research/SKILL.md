---
name: token-research
description: Deep token research combining on-chain metadata, DEX data, security analysis, and holder distribution. Triggers when user asks to analyze, research, evaluate, or assess a specific Solana token. Produces a comprehensive risk/verdict report.
---

# Token Research Skill

## Workflow Checklist

```
Token Research Progress:
- [ ] Step 1: Identify token mint address
- [ ] Step 2: Gather on-chain metadata (get_token_info)
- [ ] Step 3: Get DEX market data (get_dex_data)
- [ ] Step 4: Run GMGN security scan (get_token_security)
- [ ] Step 5: Get top holders (get_token_holders)
- [ ] Step 6: Cross-reference and produce verdict
```

## Step 1: Identify Token

Extract mint address from user input. If only symbol/name given, search trending tokens or ask user to provide the mint.

## Step 2: On-Chain Metadata

Call `get_token_info` with the mint address.

**Extract:** symbol, name, supply, freeze_authority, is_mutable, age (from creation_date), creator, pump_fun_flag.

**Red flags:** freeze authority active, metadata mutable, pump.fun token with age < 24h.

## Step 3: DEX Market Data

Call `get_dex_data` with the mint address.

**Extract:** price, volume_24h, liquidity, price_change_24h, market_cap, transactions.

**Warning thresholds:** liquidity < $50k, volume/liquidity ratio > 10 (wash trading signal).

## Step 4: GMGN Security Scan

Call `get_token_security` with the mint address.

**Critical checks:**
- `is_honeypot` — immediate hard fail
- `buy_tax` / `sell_tax` — flag if > 5%
- `rug_ratio` — flag if > 30%
- `sniper_count` — flag if > 5
- `suspected_insider_hold_rate` — flag if > 15%
- `fresh_wallet_rate` — flag if > 30%
- `bundler_trader_amount_rate` — flag if > 20%
- `rat_trader_amount_rate` — flag if > 25%

**Positive signals:**
- `renounced` = true
- `smart_degen_count` > 10
- `renowned_count` > 5
- `bluechip_owner_pct` > 10%
- `lock_info.is_locked` = true

**Creator check:** If `creator_created_count` > 20 and `creator_open_ratio` < 30%, creator has a history of abandoned tokens.

## Step 5: Holder Distribution

Call `get_token_holders` with the mint address.

**Assess:**
- Top 10 holder concentration — risky if > 40%
- Labeled wallets — whales, known entities, exchanges
- Dev wallet still holding — negative signal

## Step 6: Produce Verdict

Synthesize all data into a structured report:

```
## [SYMBOL] — Token Research Report

### Basics
- Name / Symbol / Mint
- Age: X days
- Platform: [Pump.fun / Native]
- Creator: [address] (created X tokens, X% still open)

### Market
- Price: $X | MCap: $X | Liquidity: $X
- 24h Volume: $X | 24h Change: X%

### Security
- Honeypot: [YES/NO]
- Buy/Sell Tax: X% / X%
- Rug Ratio: X%
- Mint Renounced: [YES/NO]
- Liquidity Locked: [YES/NO, X%]

### Smart Money
- Smart Degens: X | Renowned: X
- Bluechip Owner %: X%
- Snipers: X

### Risk Signals
- [List of flagged risk factors]

### Holder Distribution
- Top 10: X% of supply
- Dev Holding: [YES/NO, X%]

### Verdict: [SAFE / CAUTION / AVOID]
[1-2 sentence summary with key reasoning]
```

**Verdict logic:**
- **AVOID**: honeypot, tax > 10%, rug_ratio > 50%, or > 3 critical risk flags
- **CAUTION**: 1-2 risk flags, low liquidity, or moderate concentration
- **SAFE**: renounced, locked, no risk flags, good smart money presence, distributed holders
