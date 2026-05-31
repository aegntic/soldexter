# Soldexter

Autonomous Solana research and trading intelligence agent.

Think Claude Code, but built for Solana — token analysis, wallet tracking, DEX data, on-chain forensics, and optional trade execution.

Built by **[@aegntix](https://x.com/aegntix) / Mattae Cooper**. Inspired by [Dexter Labs](https://github.com/virattt/dexter).

## Quick Start

```bash
# Install
bun install

# Set up API keys (at minimum Helius + Birdeye)
export HELIUS_API_KEY=your_key
export BIRDEYE_API_KEY=your_key
export OPENAI_API_KEY=your_key  # or use ollama

# Run
bun run dev
```

## What It Does

Soldexter is an autonomous CLI agent that:
- Takes complex Solana/crypto questions in plain language
- Decomposes them into multi-step research plans
- Executes tools in parallel using live on-chain + off-chain data
- Validates and cross-references results
- Produces actionable trading intelligence

## Tools

| Tool | What it does |
|------|-------------|
| `get_token_info` | Token metadata, supply, freeze authority, age, creator |
| `get_dex_data` | Price, volume, liquidity, price changes, DEX pair data |
| `get_wallet_activity` | Wallet transaction history — swaps, transfers, amounts |
| `decode_transaction` | Full transaction forensic breakdown |
| `get_trending_tokens` | Trending tokens by volume/momentum |
| `get_token_holders` | Top holders with concentration analysis |
| `web_search` | Web search (Exa/Tavily/Perplexity) |
| `browser` | JavaScript-rendered page navigation |
| `memory` | Persistent knowledge across sessions |
| `spawn_subagent` | Delegate sub-tasks to parallel agents |

## Data Sources

- **Helius** — Solana RPC, enhanced transactions, DAS API, wallet labels
- **Birdeye** — Token prices, OHLCV, trending, wallet P&L
- **Jupiter v6** — Swap quotes and execution (paper-trade default)
- **DexScreener** — DEX pair data fallback

## Execution (Optional)

Soldexter defaults to **paper-trade mode**. To enable live trading:

```bash
export EXECUTION_ENABLED=true
export MAINNET_ENABLED=true
export SOLANA_KEYPAIR=path/to/keypair.json
```

Live trading requires double opt-in. Paper mode prints quotes without executing.

## Example Sessions

### Token Analysis
```
> Analyze EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v (USDC)

Soldexter: Fetching token info, DEX data, and top holders...
[parallel tool calls: get_token_info, get_dex_data, get_token_holders]

## USDC (USD Coin)
Price: $1.00 | MCap: $2.1B | Liquidity: $890M
Holders: 12.4M | Top 10: 45.2%
Age: 1,847 days | Freeze: None ✅
Verdict: Stablecoin, deep liquidity, safe to transact.
```

### Wallet Tracking
```
> What is 7x4kX... doing right now?

Soldexter: Looking up wallet labels and recent activity...
[get_wallet_activity, search_wallet_labels, get_wallet_pnl]

## Wallet 7x4kX... Profile
Label: Known whale | 30d P&L: +$2.3M (+187%) | Win rate: 71%
Last action: Bought 85 SOL of POPE (3 min ago)
Pattern: Loading new meme launches — typical early-entry behavior.
```

### Market Scan
```
> Show me the top trending tokens with >$50k liquidity

Soldexter: [get_trending_tokens with min_liquidity=50000]

## Trending (24h)
1. BONK2 — $0.0000034 (+187%, Vol: $4.2M, Liq: $890k)
2. MEW — $0.0023 (+94%, Vol: $2.1M, Liq: $340k)
3. POPE — $0.00000012 (+312%, Vol: $1.8M, Liq: $89k) ⚠️ Low liq
```

## Architecture

Soldexter is built on [Dexter](https://github.com/virattt/dexter)'s proven agent loop:
- **Agent core** — Plan → execute → validate → refine
- **Subagent spawning** — Parallel research tasks
- **Persistent memory** — Knowledge survives across sessions
- **Scratchpad** — JSONL audit log of every tool call
- **Token optimization** — Context window management for long sessions

Plus Solana-native additions:
- **6 on-chain tools** — Token info, DEX data, wallet activity, TX decode, trending, holders
- **3 providers** — Helius, Birdeye, Jupiter
- **Execution layer** — Paper-trade by default, Jupiter swaps when enabled

## License

MIT

## Credits

- **Soldexter**: [Mattae Cooper](https://x.com/aegntix) / [aegntic](https://github.com/aegntic/soldexter)
- **Dexter** (original): [Virat Singh](https://x.com/virattt) / [Dexter Labs](https://github.com/virattt/dexter)
