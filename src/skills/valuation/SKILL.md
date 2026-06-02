---
name: token-valuation
description: Performs on-chain DCF-style valuation analysis for Solana tokens.
  Triggers when user asks "what is this token worth", "is X undervalued", "fair value",
  "intrinsic value", "should I buy TOKEN", "price target", "valuation", or wants
  fundamental analysis beyond technicals/safety.
---

# Token Valuation — On-Chain DCF (REKTDDEX)

## Overview

Crypto-adapted DCF framework. Traditional DCF uses WACC + FCF + shares.
This uses: crypto discount rate + protocol fee revenue + token supply.
Produced by `solagent-valuation` Rust crate in `engine/crates/valuation/`.

## Workflow

```
Progress:
- [ ] Step 1: Gather on-chain data (volume, holders, safety, liquidity)
- [ ] Step 2: Estimate protocol revenue (volume × fee_rate)
- [ ] Step 3: Calculate crypto discount rate (safety + vol + liquidity)
- [ ] Step 4: Project 5-year revenue with competitive decay
- [ ] Step 5: Estimate terminal value via Metcalfe's Law
- [ ] Step 6: Compute fair value range (bull/base/bear)
- [ ] Step 7: Sensitivity analysis (discount rate ±2%, terminal growth ±1%)
- [ ] Step 8: Present with signal + confidence
```

## Step 1: Gather Data

Use soldexter Solana tools:
- `tools/solana/dex-data.ts` → volume_24h, volume_30d, liquidity, price
- `tools/solana/holders.ts` → holder_count, holder_growth_30d
- `tools/solana/gmgn-security.ts` → safety_score (0-100)
- `tools/solana/token-info.ts` → token_symbol, supply

If GMGN safety unavailable, use 50 as default.

## Step 2: Revenue Estimation

```
protocol_fees_30d = volume_30d × 0.003  (standard DEX fee)
daily_avg = protocol_fees_30d / 30
growth_rate = holder_growth_30d × 0.80  (20% haircut, capped ±50%)
```

For meme tokens with no fee generation: use holder growth as revenue proxy.

## Step 3: Crypto Discount Rate (NOT WACC)

Traditional WACC doesn't apply. Use risk-adjusted rate:
- Base: 8% (risk-free + equity risk premium analog)
- Safety adjustment: (100 - safety_score)/100 × 15%
- Volatility premium: realized_vol_30d/100, capped 30%
- Liquidity discount: up to 10% for pools < $100K
- Dev risk: 0-5% if dev track record poor

Range: 12% (blue-chip SOL/USDC) to 40% (risky meme, low safety).

## Step 4: Revenue Projection (5 years)

Annual decay: Y1=100%, Y2=85%, Y3=70%, Y4=55%, Y5=40%.
Reflects competitive dynamics — growth slows as edge erodes.

```
year1_revenue = base_annual × (1 + growth_rate × 1.00)
year2_revenue = year1 × (1 + growth_rate × 0.85)
...
```

Discount each year to present value using discount rate.

## Step 5: Terminal Value (Metcalfe's Law)

```
active_users = holder_count × 0.30
terminal_growth = 1-3% (based on network size)
terminal_users = active_users × (1 + tg)^5
terminal_value = terminal_users² × (value_per_user × 0.10) / (1 + dr)^5
```

## Step 6: Fair Value Per Token

```
enterprise_value = PV(cashflows) + terminal_value
fair_value_base = enterprise_value / token_supply
fair_value_bear = base × 0.80
fair_value_bull = base × 1.20
```

Signal from upside (base - current_price) / current_price:
- >50% below → StrongBuy (90/100)
- 25-50% below → Buy (65/100)
- Within 25% → Fair (40/100)
- 25-50% above → Overvalued (20/100)
- >50% above → Avoid (5/100)

## Step 7: Sensitivity

3×3 matrix: discount rate (base ±2%) × terminal growth (base ±1%).
Shows how fair value changes under different assumptions.

## Step 8: Output Format

```
Token: BONK (DezXAZ8z7PnrnRJNzD2sKq4...)
Price: $0.00002831 | MCap: $1.9B
──────────────────────────────────────
Protocol Revenue (30d): $2.4M
Holder Growth: +12.3% (30d)
Discount Rate: 18.5% (safety: 72/100, vol: 85%)
──────────────────────────────────────
Fair Value Range:
  Bear:  $0.00002140 (-24.3%)
  Base:  $0.00003820 (+35.0%)  ← UNDERVALUED
  Bull:  $0.00005210 (+84.1%)
Signal: BUY (35% upside to base)
Confidence: High (90d+ history, $85K daily vol, 650K holders)
──────────────────────────────────────
Sensitivity Matrix:
         TG 1.0%  TG 2.0%  TG 3.0%
DR 16.5%  +52%    +58%    +64%
DR 18.5%  +35%    +41%    +47%    ← base
DR 20.5%  +19%    +25%    +31%
```

## Integration with Alpha Capture

ValuationSignal feeds into confluence scorer at w=0.15.
- Score: 0-100 (from signal enum)
- Combined with: Whale(0.20), Behavioral(0.20), Accumulation(0.15), etc.
- Position sizing: deeper undervalued = bigger allocation
- Risk anchor: stop loss tied to fair value lower bound

## Caveats

1. Revenue is estimated, not actual — DEX fees are a proxy
2. Meme tokens may have zero real revenue — holder growth proxy used
3. 5-year projection in crypto is speculative — treat as directional
4. Discount rate sensitive to safety score quality
5. Terminal value via Metcalfe's Law assumes network effects persist
6. Always pair with technical/momentum signals — never trade on valuation alone
