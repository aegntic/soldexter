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
- [ ] Step 4: Score wallets with 5-layer model
- [ ] Step 5: Research top conviction tokens
- [ ] Step 6: Present ranked results
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

## Step 4: Score Wallets with 5-Layer Model

For each wallet address identified in Step 3 (especially overlap and high-conviction wallets), gather the following data to invoke the bridge scorer:

**Data to collect per wallet:**
- `tradeHistory`: recent trades (token_in, token_out, amount_in, amount_out, usd_value, timestamp)
- `liquidityEvents`: LP add/remove events for pools the wallet interacted with (pool, event_type, sol_delta, timestamp)

**Conceptual call to the bridge:**
```
scoreWallet({ address, tradeHistory, liquidityEvents })
```
Feed the gathered data into the bridge function. It returns a `FiveLayerScore` object containing `composite` (0–100), `tier`, per-layer scores, `red_flags`, and `rationale`.

### Five Scoring Layers (Weighted Composite)

| Layer | Weight | What it measures |
|---|---|---|
| Inverse Loss Archaeology | 20% | Consistency of PnL — does the wallet recover from drawdowns or spiral? |
| Liquidity Ghost Detection | 25% | LP manipulation signals — remove/add cycles that precede pumps. |
| Irrational Conviction | 20% | Hold-through-volatility score — diamond-hand behaviour vs churn. |
| CTO Meta Reader | 20% | Timing quality around CTO (Creator Trading) launches or insider windows. |
| Consensus Deviation | 15% | Divergence from crowd flow — is this wallet early against consensus? |

Composite = weighted sum of all five layer scores (0–100).

### Tier Thresholds

| Tier | Score | Interpretation |
|---|---|---|
| PRECOGNITIVE | ≥ 75 | Elite operator — front-run or deep-thesis conviction. Highest weight. |
| SOVEREIGN | ≥ 55 | Consistently profitable — well-capitalised, low-bot probability. Strong signal. |
| EMERGING | ≥ 35 | Promising but unproven — track for follow-up. |
| Noise | < 35 | Discard unless other signals override. |

### Red-Flag Disqualifiers

Wallets flagged with any of the following are classified **Noise** immediately (composite = 0, skip further scoring):

- `bot_like_frequency` — >50 trades in the last 24h suggests automation.
- `dust_volume` — average trade <$10 USD across >20 trades (wash/spam volume).
- `persistent_loser` — <10% win rate across >10 trades (repeated loss Buidl).

**Use in token ranking:** weight Step 3 priority tiers by wallet tier. A token with 3 PRECOGNITIVE wallets outranks a token with 5 EMERGING wallets, even at equal buy count.

## Step 5: Research Top Tokens

For the top 3-5 tokens from Step 3 (now ordered by scored wallet tiers), run parallel research:

- `get_token_security` — risk check (honeypot, rug ratio, sniper count)
- `get_dex_data` — price, volume, liquidity
- `get_gmgn_trending` — confirm token is trending by smartmoney metric

**Skip any token that:** is honeypot, has sell tax > 5%, rug ratio > 30%, or liquidity < $20k.

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
