---
name: smart-money-hunter
description: Track smart money and KOL trades to find tokens with institutional/profitable wallet inflow. Triggers when user asks about smart money, what profitable wallets are buying, KOL trades, whale tracking, or wants tokens with smart money conviction.
---

# Smart Money Hunter Skill

## Workflow Checklist

```
Smart Money Hunt Progress:
- [ ] Step 1: Fetch smart money buys (get_smart_money)
- [ ] Step 2: Fetch KOL buys (get_kol_trades)
- [ ] Step 3: Identify overlapping tokens
- [ ] Step 4: Research top conviction tokens
- [ ] Step 5: Present ranked results
```

## Step 1: Smart Money Buys

Call `get_smart_money` with `side: "buy"`, `limit: 20`.

**Extract:** token_mint, token_symbol, wallet, amount_usd, timestamp for each trade.

**Aggregate:** Group by token. Count unique wallets per token. Sum USD amounts. This gives a "conviction score" — more unique smart wallets buying the same token = stronger signal.

## Step 2: KOL Buys

Call `get_kol_trades` with `side: "buy"`, `limit: 20`.

**Same aggregation:** Group by token, count unique KOLs, sum amounts.

## Step 3: Find Overlap

Cross-reference smart money tokens with KOL tokens.

**Priority tiers:**
1. Tokens appearing in BOTH smart money and KOL lists — highest conviction
2. Tokens with 3+ unique smart money wallets — strong institutional signal
3. Tokens with large individual buys (>$10k) — whale conviction
4. Remaining KOL-only tokens — narrative play

## Step 4: Research Top Tokens

For the top 3-5 tokens from Step 3, run parallel research:

- `get_token_security` — risk check (honeypot, rug ratio, sniper count)
- `get_dex_data` — price, volume, liquidity
- `get_gmgn_trending` — confirm token is trending by smartmoney metric

**Skip any token that:** is honeypot, has sell tax > 5%, rug ratio > 30%, or liquidity < $20k.

## Step 5: Present Results

```
## Smart Money Hunter — [timestamp]

### Tier 1: Smart Money + KOL Overlap
1. **[SYMBOL]** — X smart wallets, Y KOLs | $Z total buys
   - Security: [pass/warn] | Liq: $X | MCap: $Y
   - Risk flags: [none / list]

### Tier 2: Strong Smart Money Conviction
2. **[SYMBOL]** — X unique smart wallets buying
   - [same details]

### Tier 3: Whale Conviction
3. **[SYMBOL]** — $X single buy by [wallet_label]
   - [same details]

### Smart Money Sells (tokens being exited)
- [SYMBOL] — X smart wallets selling, $Z total

### Watch List
Tokens to monitor that passed security but need more data:
- [list with brief notes]
```

## Tips

- Time-awareness: Smart money trades older than 6h may already be priced in. Note timestamps.
- Sell tracking: Also check `get_smart_money` with `side: "sell"` to find tokens smart money is exiting.
- Cross-wallet: If same wallet appears in both buy and sell lists for different tokens, note it as an active trader.
