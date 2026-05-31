---
name: new-token-scanner
description: Scan new token launches from GMGN trenches (Pump.fun, letsbonk, etc.) and evaluate them for early entry. Triggers when user asks about new launches, fresh tokens, trenches, Pump.fun, bonding curves, or wants to find tokens before they hit DEX.
---

# New Token Scanner Skill

## Workflow Checklist

```
New Token Scan Progress:
- [ ] Step 1: Fetch new creations from trenches (get_gmgn_trenches)
- [ ] Step 2: Fetch near-completion tokens (bonding curve > 80%)
- [ ] Step 3: Apply basic filters
- [ ] Step 4: Security check promising tokens (get_token_security)
- [ ] Step 5: Present ranked opportunities
```

## Step 1: New Creations

Call `get_gmgn_trenches` with `type: "new_creation"`, `limit: 30`.

**Filter criteria (remove tokens that fail):**
- Holder count < 5 — too early, likely just creator
- No buys at all — zero interest
- Platform-specific: if user requested specific platform (e.g., Pump.fun only)

**Sort remaining by:** holder_count desc, then buys desc.

## Step 2: Near-Completion Tokens

Call `get_gmgn_trenches` with `type: "near_completion"`, `limit: 20`.

**These tokens are about to graduate from bonding curve → DEX.** Higher risk/reward:
- Bonding curve > 85% — very close to graduation
- Holder count growing fast — organic interest signal
- Volume/liquidity ratio reasonable

Also call `get_gmgn_trenches` with `type: "completed"`, `limit: 10` to see recently graduated tokens.

## Step 3: Apply Filters

**Hard filter (remove):**
- Honeypot (check via `get_token_security` if available)
- Creator with > 50 past tokens and < 20% open ratio — serial rugger
- Suspiciously low holder count relative to volume

**Soft filter (note but keep):**
- Very new (< 30 min old) — early but risky
- Low liquidity — expected for trenches
- High buy/sell ratio imbalance — possible bot activity

## Step 4: Security Check

For the top 5-10 tokens, call `get_token_security` in parallel.

**Key checks for new tokens:**
- `fresh_wallet_rate` — high = Sybil/bot campaign
- `bundler_trader_amount_rate` — high = automated buying
- `suspected_insider_hold_rate` — high = dev team loading up
- `sniper_count` — high = snipers already in, you're late
- `creator_created_count` + `creator_open_ratio` — track record

**Green flags for new tokens:**
- Low fresh_wallet_rate (< 20%)
- Low bundler rate (< 10%)
- Some smart degen holders already
- Creator has good track record (> 50% open ratio)

## Step 5: Present Results

```
## New Token Scanner — [timestamp]

### 🔥 Near Graduation (bonding curve > 80%)
1. **[SYMBOL]** — [platform] | BC: 92% | Holders: X | Buys/Sells: X/X
   - MCap: $X | Vol: $X
   - Security: [notes]
   - Creator: [address] (X tokens, X% still open)
   - Risk Level: [LOW/MED/HIGH]

### 🆕 Fresh Launches (< 1h old)
2. **[SYMBOL]** — [platform] | BC: 15% | Holders: X
   - [same details]

### ✅ Recently Graduated (now on DEX)
3. **[SYMBOL]** — graduated X min ago
   - DEX Liq: $X | Vol: $X | Price: $X
   - [security notes]

### ⚠️ Avoid List
Tokens that failed security checks:
- [SYMBOL]: [reason]
- [SYMBOL]: [reason]
```

## Risk Framework for New Tokens

| Signal | Safe | Caution | Avoid |
|--------|------|---------|-------|
| Fresh wallet rate | < 15% | 15-30% | > 30% |
| Bundler rate | < 5% | 5-15% | > 15% |
| Insider hold rate | < 10% | 10-20% | > 20% |
| Sniper count | 0-2 | 3-5 | > 5 |
| Creator track record | > 50% open | 30-50% open | < 30% open |

## Tips

- Time sensitivity: New token data is highly time-sensitive. Always note timestamps.
- Pump.fun specific: Tokens under ~$50k market cap are still on bonding curve. Above that they graduate.
- Gas wars: Near-graduation tokens can have high slippage. Note this for users.
