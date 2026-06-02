---
name: token-valuation
description: On-chain DCF valuation for Solana tokens. Triggers on "what is X worth", "is X undervalued", "fair value", "intrinsic value", "price target" for crypto tokens.
---

# Token Valuation — On-Chain DCF for Solana

## Overview

Crypto-native DCF using `get_token_valuation` (bridge/valuation.ts). Traditional equity DCF uses WACC + FCF + Gordon Growth. This uses crypto discount rates, protocol fee revenue, and Metcalfe's terminal value.

## Workflow Checklist

```
Progress:
- [ ] Step 1: Gather on-chain data (get_token_info, get_dex_data, get_token_holders, get_token_security)
- [ ] Step 2: Call get_token_valuation tool with mint + optional overrides
- [ ] Step 3: Interpret result (fair_value range, signal, confidence)
- [ ] Step 4: Cross-check with technicals (trending, wallet activity)
- [ ] Step 5: Present valuation with caveats
```

## Step 1: Gather On-Chain Data

Call these soldexter tools in parallel:

- `get_token_info` → `token_symbol`, `token_supply`, `creator_address`, `freeze_authority`
- `get_dex_data` → `current_price`, `volume_24h`, `market_cap`, `liquidity_usd`, `price_change_24h`
- `get_token_holders` → `holder_count`, `holder_growth_30d`
- `get_token_security` → `safety_score` (raw 0-100 from GMGN)

**Red flags to surface:** freeze authority active, safety_score < 40, liquidity_usd < $50k, holder_count < 100.

## Step 2: Call get_token_valuation

Bridge: `src/tools/solana/valuation-bridge.ts` → calls `solagent-valuation` Rust binary with fallback in-process.

**Inputs:**
- `mint` (required)
- `safety_score_override` (optional, 0-100, default from GMGN)
- `fee_rate_override` (optional, default 0.003)

If GMGN safety unavailable, pass estimated score based on security scan (honeypot, rug_ratio, renounced).

## Step 3: Interpret Result

The tool returns a `TokenValuationResult`:
- `fair_value`: `{ bear, base, bull }` in USD per token
- `signal`: StrongBuy | Buy | Fair | Overvalued | Avoid
- `confidence`: High | Medium | Low
- `upside_pct`: (base - current_price) / current_price
- `confluence_weight`: weight for signal combination (default 0.15)
- `discount_rate`: 12-40%
- `enterprise_value`, `terminal_value`

**Signal thresholds:** >50% below → StrongBuy; 25-50% → Buy; ±25% → Fair; 25-50% above → Overvalued; >50% → Avoid.

**Confidence mapping:** High = safety_score > 70 + daily_vol > $10k + holders > 5000; Medium = partial data; Low = fallback valuation + missing inputs.

## Step 4: Cross-Check with Technicals

- Call `get_trending_tokens` to see if token is trending (volume acceleration)
- Call `get_wallet_activity` for top wallets to detect coordinated selling
- Compare `volume_growth_30d` vs `holder_growth_30d`: divergence = possible wash trades

**Confluence:** If valuation signal aligns with momentum + whale accumulation → increase confidence. If valuation says Buy but whale wallets are net-sellers → downgrade signal.

## Step 5: Present Valuation

```
## [SYMBOL] — Solana Token Valuation

### Inputs
- Mint: [mint]
- Current Price: $X | MCap: $X | Liquidity: $X
- Holders: X (+X% 30d) | Volume: $X (24h)
- Safety Score: X/100 | Fee Rate: 0.30%

### Valuation
- Fair Value Range:
  - Bear:  $X (-X%)
  - Base:  $X (+X% upside) ← [SIGNAL]
  - Bull:  $X (+X%)
- Protocol Revenue (30d): $X
- Discount Rate: X%
- Terminal Value (Metcalfe): $X
- Confidence: X
- Confluence Score: X/100 (w=0.15)

### Verdict
[1-2 sentence: signal, confidence, and key caveat]

### Caveats
- Revenue is estimated (volume × fee_rate), not actual
- Meme tokens may have zero protocol revenue; holder growth used as proxy
- 5-year projection highly speculative in crypto
- Always pair with token-research safety checks before trading
```

## Key Differences from Equity DCF

| Traditional DCF | Solana Token DCF |
|---|---|
| WACC 6-10% | Crypto discount rate 12-40% |
| FCF from income statement | Protocol rev = volume × fee_rate |
| Shares outstanding | Token supply (on-chain) |
| Gordon Growth terminal | Metcalfe's Law: terminal ∝ holders² |
| `get_financials` / `get_market_data` | `get_token_valuation` tool |
| Annual/quarterly reports | Real-time on-chain data |
| Sector WACC tables | Safety score + volatility proxy |

## Integration

Signal from this skill feeds into the alpha-capture confluence scorer at weight 0.15. Combine with whale(0.20), behavioral(0.20), accumulation(0.15), smart_money(0.15), momentum(0.15).
