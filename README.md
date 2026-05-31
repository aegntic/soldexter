<p align="center">
  <img src="assets/soldexter-banner.svg" alt="Soldexter — Autonomous Solana Research Agent" width="100%">
</p>

<p align="center">
  <strong>Autonomous Solana research & trading intelligence agent.</strong><br>
  Think Claude Code, but built for Solana.
</p>

<p align="center">
  <a href="https://github.com/aegntic/soldexter/releases"><img src="https://img.shields.io/github/v/release/aegntic/soldexter?color=14F195&label=release&style=flat-square" alt="Release"></a>
  <a href="https://github.com/aegntic/soldexter/blob/main/LICENSE"><img src="https://img.shields.io/github/license/aegntic/soldexter?color=9945FF&style=flat-square" alt="License"></a>
  <a href="https://github.com/aegntic/soldexter/stargazers"><img src="https://img.shields.io/github/stars/aegntic/soldexter?color=b47aff&style=flat-square" alt="Stars"></a>
  <img src="https://img.shields.io/badge/runtime-bun-f9f?style=flat-square" alt="Runtime">
  <img src="https://img.shields.io/badge/chain-Solana-14F195?style=flat-square" alt="Chain">
  <img src="https://img.shields.io/badge/paper--trade-default-27c93f?style=flat-square" alt="Paper Trade">
</p>

---

<p align="center">
  <img src="assets/soldexter-terminal-mockup.svg" alt="Soldexter terminal session" width="90%">
</p>

## What is Soldexter?

Soldexter is a terminal-native AI agent that takes natural language questions about Solana tokens, wallets, and markets — then autonomously researches them using live on-chain and off-chain data.

It decomposes complex questions into multi-step research plans, executes 6+ tools in parallel, cross-references results, and produces actionable trading intelligence. All from your terminal.

### Key Features

- **6 Solana-native tools** — Token analysis, DEX data, wallet forensics, TX decode, trending tokens, holder analysis
- **Parallel execution** — Tools run concurrently with automatic cross-referencing
- **Subagent spawning** — Delegate sub-tasks to isolated parallel agents
- **Persistent memory** — Knowledge survives across sessions
- **Paper-trade default** — Jupiter swap quotes without execution, live requires explicit double opt-in
- **Multiple LLM backends** — OpenAI, Anthropic, Google, or local via Ollama

## Quick Start

```bash
# Clone
git clone https://github.com/aegntic/soldexter.git
cd soldexter

# Install
bun install

# Set up API keys (at minimum Helius + Birdeye)
export HELIUS_API_KEY=your_helius_key
export BIRDEYE_API_KEY=your_birdeye_key
export OPENAI_API_KEY=your_openai_key  # or use ollama for local

# Run
bun run dev
```

## Tools

| Tool | Description | Source |
|------|-------------|--------|
| `get_token_info` | Token metadata, supply, freeze authority, age, creator, pump.fun detection | Helius DAS |
| `get_dex_data` | Live price, volume, liquidity, price changes, DEX pair data | Birdeye |
| `get_wallet_activity` | Wallet transaction history — parsed swaps, transfers, amounts, programs | Helius RPC |
| `decode_transaction` | Full forensic breakdown: programs, inner instructions, token transfers, fees | Helius |
| `get_trending_tokens` | Trending tokens by volume/momentum with liquidity filtering | Birdeye |
| `get_token_holders` | Top holders with supply concentration and wallet labels | Helius |
| `web_search` | Web search via Exa, Tavily, Perplexity, or LangSearch | Multi |
| `browser` | JavaScript-rendered page navigation and scraping | Playwright |
| `memory` | Persistent knowledge base across sessions | Local |
| `spawn_subagent` | Delegate focused sub-tasks to parallel agents | Internal |

## Example Sessions

### Token Deep Dive

```
> Analyze EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v (USDC)

Soldexter: Fetching token info, DEX data, and top holders...
[parallel: get_token_info, get_dex_data, get_token_holders]

## USDC (USD Coin)
Price: $1.00 | MCap: $2.1B | Liquidity: $890M
Holders: 12.4M | Top 10: 45.2%
Age: 1,847 days | Freeze: None ✅ | Pump.fun: No ✅
Verdict: Stablecoin, deep liquidity, safe to transact.
```

### Wallet Intelligence

```
> What is 7x4kX... doing right now?

Soldexter: Looking up wallet labels and recent activity...
[parallel: get_wallet_activity, search_wallet_labels, get_wallet_pnl]

## Wallet 7x4kX... Profile
Label: Known whale | 30d P&L: +$2.3M (+187%) | Win rate: 71%
Last action: Bought 85 SOL of POPE (3 min ago)
Pattern: Loading new meme launches — typical early-entry behavior.
```

### Market Scanner

```
> Show me trending tokens with >$50k liquidity

Soldexter: [get_trending_tokens with min_liquidity=50000]

## Trending (24h)
1. BONK2 — $0.0000034 (+187%, Vol: $4.2M, Liq: $890k)
2. MEW — $0.0023 (+94%, Vol: $2.1M, Liq: $340k)
3. POPE — $0.00000012 (+312%, Vol: $1.8M, Liq: $89k) ⚠️ Low liq
```

### Transaction Forensics

```
> Decode tx 5UjH...qKP2

Soldexter: [decode_transaction]

## Transaction Breakdown
Type: Swap | Program: Jupiter Aggregator v6
Token In: 50 SOL ($7,250) → Token Out: 42.3M BONK
Fee: 0.00005 SOL | Priority: 0.0001 SOL | CU: 204,800
Inner instructions: 4 (spl-token transfers, account updates)
Verdict: Standard Jupiter swap, no suspicious patterns.
```

## Data Sources

| Provider | Capabilities |
|----------|-------------|
| [Helius](https://helius.xyz) | Solana RPC, DAS API, enhanced transactions, wallet labels, webhooks |
| [Birdeye](https://birdeye.so) | Token prices, OHLCV candles, trending tokens, wallet P&L |
| [Jupiter v6](https://station.jup.ag) | Swap quotes, route planning, paper-trade / live execution |

## Architecture

```
┌─────────────────────────────────────────────┐
│                  Soldexter                   │
├──────────┬──────────┬───────────┬───────────┤
│   Agent  │  Tools   │ Providers │  Memory   │
│   Core   │  (6+)    │  (3)      │ (persist) │
├──────────┴──────────┴───────────┴───────────┤
│           Subagent Spawning Layer            │
├──────────────────────────────────────────────┤
│  Helius RPC │ Birdeye API │ Jupiter v6 API   │
└──────────────────────────────────────────────┘
```

Built on [Dexter](https://github.com/virattt/dexter)'s proven agent loop:
- **Plan → Execute → Validate → Refine** — Iterative research with self-correction
- **Parallel tool execution** — Multiple data sources queried simultaneously
- **Context window management** — Handles long sessions without degradation
- **JSONL scratchpad** — Full audit log of every agent decision and tool call

## Trading & Safety

Soldexter defaults to **paper-trade mode**. Swap quotes are fetched from Jupiter and displayed without executing any on-chain transaction.

To enable live trading (requires explicit double opt-in):

```bash
export EXECUTION_ENABLED=true     # opt-in 1
export MAINNET_ENABLED=true       # opt-in 2
export SOLANA_KEYPAIR=path/to/keypair.json
```

Both flags must be set. Paper mode is always the default.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `HELIUS_API_KEY` | Yes | Helius RPC and DAS API access |
| `BIRDEYE_API_KEY` | Yes | Birdeye price and market data |
| `OPENAI_API_KEY` | One LLM | OpenAI GPT models |
| `ANTHROPIC_API_KEY` | or | Anthropic Claude models |
| `GOOGLE_API_KEY` | or | Google Gemini models |
| `EXECUTION_ENABLED` | No | Enable swap execution (opt-in 1) |
| `MAINNET_ENABLED` | No | Enable mainnet transactions (opt-in 2) |
| `SOLANA_KEYPAIR` | No | Path to Solana keypair for execution |

## Tech Stack

- **Runtime**: [Bun](https://bun.sh)
- **Language**: TypeScript
- **Agent Framework**: [LangChain.js](https://js.langchain.com)
- **Terminal UI**: [Ink](https://github.com/vadimdemedes/ink) (React for CLI)
- **Browser**: [Playwright](https://playwright.dev)
- **Zod** schemas for structured tool I/O

## Contributing

Contributions are welcome. Open an issue or PR.

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit your changes
4. Open a pull request

## License

[MIT](LICENSE)

## Credits

- **Soldexter**: [Mattae Cooper (@aegntix)](https://x.com/aegntix) / [aegntic](https://github.com/aegntic)
- **Dexter** (original): [Virat Singh (@virattt)](https://x.com/virattt) / [Dexter Labs](https://github.com/virattt/dexter)

---

<p align="center">
  <sub>Built with ☉ by <a href="https://x.com/aegntix">@aegntix</a> · Powered by <a href="https://helius.xyz">Helius</a>, <a href="https://birdeye.so">Birdeye</a>, <a href="https://station.jup.ag">Jupiter</a></sub>
</p>
