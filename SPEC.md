# Soldexter — Autonomous Solana Research & Trading Agent

**Repository:** `aegntic/soldexter` (new project, MIT license)
**Stack:** TypeScript + Bun (same as Dexter), Python adapters for existing Solana tools
**Status:** Ready to build — complete spec, no ambiguity

---

## What Soldexter Is

Dexter is "Claude Code for finance." Soldexter is "Claude Code for Solana."

An autonomous CLI agent that takes complex Solana/crypto questions, decomposes them into research plans, executes them with live on-chain + off-chain data, validates results, and produces actionable trading intelligence. It can also execute trades via Jupiter when configured.

**First mover advantage:** No Solana-native autonomous research agent exists. Dexter has 7,200+ stars but only TradFi tools. Crypto forks (maximus, 0xDexter) are shallow — they swap the data source, not the intelligence layer. Soldexter builds deep Solana-native tooling on Dexter's proven agent loop.

---

## Architecture

Fork Dexter's core agent loop (`src/agent/`). Replace all TradFi tools with Solana-native tools. Keep Dexter's subagent spawning, memory, scratchpad, and CLI framework.

```
soldexter/
├── src/
│   ├── agent/              # From Dexter — agent loop, prompts, scratchpad, memory
│   │   ├── agent.ts        # Core loop: plan → execute → validate → refine
│   │   ├── prompts.ts      # System prompts (rewritten for Solana)
│   │   ├── scratchpad.ts   # JSONL research log
│   │   ├── compact.ts      # Context window management
│   │   └── token-counter.ts
│   │
│   ├── tools/
│   │   ├── solana/         # ALL NEW — Solana-native tools
│   │   │   ├── index.ts
│   │   │   ├── on-chain.ts       # RPC queries: balance, token accounts, TX history
│   │   │   ├── token-info.ts     # Token metadata, supply, holders, age
│   │   │   ├── dex-data.ts       # Jupiter quotes, Raydium pools, Birdeye OHLCV
│   │   │   ├── wallet-intel.ts   # Wallet profiling, P&L tracking, label lookup
│   │   │   ├── tx-parser.ts      # Decode swap/transfer/create instructions
│   │   │   ├── mempool.ts        # Pending TX monitoring via Helius webhooks
│   │   │   ├── nft-data.ts       # NFT floor, collection stats
│   │   │   └── program-analysis.ts # Anchor IDL fetch, account layout decode
│   │   │
│   │   ├── scanners/       # Alpha capture intelligence tools
│   │   │   ├── index.ts
│   │   │   ├── ghost-wallets.ts   # Detect coordinated wallet networks
│   │   │   ├── wallet-scorer.ts   # 5-layer behavioral scoring
│   │   │   ├── signal-bus.ts      # Redis pub/sub signal ingestion
│   │   │   └── x-velocity.ts      # Social momentum scoring
│   │   │
│   │   ├── execution/      # Trading execution tools (optional, gated)
│   │   │   ├── index.ts
│   │   │   ├── jupiter-swap.ts    # Quote + execute swap
│   │   │   ├── position-track.ts  # SQLite position management
│   │   │   ├── risk-gate.ts       # Pre-trade risk checks
│   │   │   └── exit-manager.ts    # TP/SL/trailing stop logic
│   │   │
│   │   ├── search/         # From Dexter — web search (Exa/Tavily)
│   │   ├── browser/        # From Dexter — Playwright browser
│   │   ├── filesystem/     # From Dexter — file read/write/edit
│   │   ├── memory/         # From Dexter — persistent memory
│   │   ├── subagent/       # From Dexter — spawn subagents
│   │   └── registry.ts     # Tool registration
│   │
│   ├── providers/          # API provider clients
│   │   ├── helius.ts       # Solana RPC + DAS API + webhooks
│   │   ├── jupiter.ts      # Jupiter v6 quote/swap API
│   │   ├── birdeye.ts      # Token prices, OHLCV, trending
│   │   ├── dexscreener.ts  # DEX pair data, liquidity
│   │   ├── moralis.ts      # Multi-chain wallet history
│   │   └── gbrain.ts       # Knowledge base search (local MCP)
│   │
│   ├── model/              # From Dexter — LLM abstraction
│   ├── cli.ts              # From Dexter — Ink CLI
│   ├── commands/           # From Dexter — CLI commands
│   ├── components/         # From Dexter — terminal UI
│   ├── controllers/        # From Dexter — agent runner
│   ├── memory/             # From Dexter — persistent memory
│   └── utils/              # From Dexter — shared utils
│
├── SOUL.md                 # Soldexter personality
├── AGENTS.md               # Agent instructions
├── configs/
│   ├── devnet.json
│   ├── mainnet.json
│   └── paper-trade.json    # Default safe mode
├── docker-compose.yml      # Redis + SQLite
└── package.json
```

---

## Tool Specifications

Every tool follows Dexter's pattern: `DynamicStructuredTool` with Zod schemas, returns `formatToolResult()`.

### 1. `get_token_info`
```
Input: { mint: string }  (Solana token mint address)
Output: {
  name, symbol, decimals, supply,
  holder_count, top_10_holders_pct,
  creation_date, creator_address,
  metadata_uri, logo_url,
  freeze_authority, mint_authority,
  is_mutable, pump_fun_flag
}
Sources: Helius DAS API + Metaplex metadata
```

### 2. `get_dex_data`
```
Input: { pair_address?: string, mint?: string, dex?: "raydium"|"orca"|"pumpfun" }
Output: {
  price_usd, price_sol,
  liquidity_usd, volume_24h,
  price_change_1h, 4h, 24h, 7d,
  tx_count_24h (buys/sells),
  pair_address, dex_name,
  pool_creation_date
}
Sources: Birdeye API + DexScreener API (fallback)
```

### 3. `get_wallet_activity`
```
Input: { address: string, limit?: number, type?: "all"|"swaps"|"transfers" }
Output: [{
  signature, block_time,
  type: "swap"|"transfer"|"create"|"stake",
  token_in, token_out, amount_in, amount_out,
  usd_value, fee_sol,
  program: "pumpfun"|"raydium"|"jupiter"|"orca"|...
}]
Sources: Helius enhanced transactions API
```

### 4. `get_wallet_pnl`
```
Input: { address: string, timeframe?: "7d"|"30d"|"all" }
Output: {
  total_pnl_usd, win_rate,
  total_trades, avg_trade_size,
  best_trade, worst_trade,
  most_traded_tokens: [{mint, count, pnl}],
  active_hours: number[] (UTC hours most active)
}
Sources: Helius + Birdeye historical pricing
```

### 5. `analyze_wallet_network`
```
Input: { addresses: string[], depth?: number }
Output: {
  clusters: [{ addresses, label, total_sol, overlap_score }],
  flow_graph: [{ from, to, total_sol, token, frequency }],
  coordinated_score: number (0-100),
  labels: { address: "known_fund"|"whale"|"bot"|"retail" }
}
Sources: Helius + on-chain analysis + label databases
```

### 6. `get_token_holders`
```
Input: { mint: string, top?: number }
Output: [{
  address, balance, pct_supply,
  first_tx_date, last_tx_date,
  unrealized_pnl, label
}]
Sources: Helius DAS API + RPC getProgramAccounts
```

### 7. `decode_transaction`
```
Input: { signature: string }
Output: {
  type, program,
  inner_instructions: [{program, parsed_data}],
  accounts: [{address, role, pre_balance, post_balance}],
  token_transfers: [{from, to, mint, amount}],
  fee_payer, compute_units, priority_fee
}
Sources: Helius parsed transactions
```

### 8. `get_trending_tokens`
```
Input: { chain?: "solana", timeframe?: "1h"|"4h"|"24h", min_liquidity?: number }
Output: [{
  mint, symbol, name,
  price_usd, market_cap,
  volume_24h, liquidity_usd,
  price_change, tx_count,
  social_mentions (if available)
}]
Sources: Birdeye trending + DexScreener boost
```

### 9. `search_wallet_labels`
```
Input: { address: string }
Output: {
  address,
  labels: string[],
  tags: string[],
  known_as: string | null,
  first_seen: string,
  total_volume_usd: number,
  risk_flags: string[]
}
Sources: Helius address labels + Birdeye + internal DB
```

### 10. `execute_swap` (execution tools — gated behind config)
```
Input: { input_mint, output_mint, amount_sol, slippage_bps?: number }
Output: {
  signature,
  input_amount, output_amount,
  price_impact, fee_sol,
  route: [{amm, pct}],
  status: "confirmed"|"failed"
}
Sources: Jupiter v6 API
Gate: Requires EXECUTION_ENABLED=true + MAINNET_ENABLED=true in env
Default: Paper-trade mode prints quote without executing
```

### 11. `get_signal_feed`
```
Input: { tier?: "PREC0GNITIVE"|"SOVEREIGN"|"EMERGING", limit?: number }
Output: [{
  wallet, tier, score,
  token_mint, token_symbol,
  action: "bought"|"sold",
  amount_sol, timestamp,
  conviction: number,
  supporting_layers: string[]
}]
Sources: Redis signal.events channel (from memecoin-automation-swarm)
Fallback: Direct Helius polling if Redis unavailable
```

### 12. `gbrain_search`
```
Input: { query: string }
Output: [{ slug, title, excerpt, score, source }]
Sources: Local gbrain MCP (nomic-embed-text via ollama)
Purpose: Cross-reference research against 15k+ indexed pages
```

---

## System Prompt (SOUL.md)

```markdown
# Soldexter Identity

You are Soldexter, an autonomous Solana research and trading intelligence agent.
You think like a crypto-native analyst who has been trading since 2019 — you
understand liquidity, MEV, tokenomics, wallet behavior, and market microstructure.

## Core Principles

1. **On-chain truth over narrative.** If the wallet data says a whale is
   accumulating, that matters more than any tweet. But if 47 wallets bought
   the same token in 3 minutes with dust amounts, that's coordination, not conviction.

2. **Every signal has a cost.** You quantify confidence before recommending action.
   A single large buy is interesting. A large buy from a historically profitable
   wallet with 73% win rate across 400+ trades is a signal.

3. **Risk is the edge.** You don't just find opportunities — you size them.
   Kelly criterion, correlation checks, and drawdown limits aren't optional.

4. **Transparency.** Show your work. Every conclusion links to the data that
   supports it. If you're uncertain, say so and explain what would change your mind.

5. **Speed matters.** Memecoin alpha decays in minutes, not days. Optimize for
   research velocity — parallel tool calls, concise summaries, actionable output.

## Research Rules

- Always check token age. New tokens (< 1 hour) have different risk profile.
- Always check liquidity. Under $1k liquidity = cannot exit safely.
- Always check top holders. > 50% in top 10 wallets = extreme concentration risk.
- Always cross-reference wallets. One wallet buying is noise. A network is signal.
- Always check for freeze authority. If the creator can freeze tokens, flag it.
- Never recommend a token without having checked at least: holders, liquidity, age, and creator.
```

---

## Environment Configuration

```bash
# Required
HELIUS_API_KEY=           # Solana RPC + enhanced transactions
BIRDEYE_API_KEY=          # Token prices, OHLCV, trending
OPENAI_API_KEY=           # LLM (or use ollama below)

# Optional — execution layer
JUPITER_API_KEY=          # Not required (public API), but for rate limits
EXECUTION_ENABLED=false   # Set to true for live swaps
MAINNET_ENABLED=false     # Paper-trade on devnet by default
SOLANA_KEYPAIR=           # Only if EXECUTION_ENABLED=true (encrypted)

# Optional — intelligence layer
REDIS_URL=                # Signal bus from memecoin-automation-swarm
DEXSCREENER_API_KEY=      # DEX pair data fallback
EXASEARCH_API_KEY=        # Web search (from Dexter)

# LLM providers (supports all Dexter providers)
OLLAMA_BASE_URL=http://127.0.0.1:11434  # Local LLM
OPENROUTER_API_KEY=       # Multi-model routing
ANTHROPIC_API_KEY=        # Claude models

# gbrain integration
GBRAIN_MCP_ENABLED=true   # Search local knowledge base from agent
```

---

## Implementation Phases

### Phase 1: Core Agent + Research Tools (Day 1-3)
1. Fork Dexter, strip TradFi tools
2. Implement 6 research tools: `get_token_info`, `get_dex_data`, `get_wallet_activity`, `get_wallet_pnl`, `decode_transaction`, `get_trending_tokens`
3. Wire Helius + Birdeye providers
4. Write SOUL.md + system prompts
5. Test: "What's the risk profile of token <mint>?"

### Phase 2: Wallet Intelligence (Day 4-6)
1. Implement `analyze_wallet_network`, `get_token_holders`, `search_wallet_labels`
2. Add wallet scoring logic (adapt from memecoin-automation-swarm's 5-layer model)
3. Test: "Who are the top 10 holders of <token> and are they coordinated?"

### Phase 3: Signal Integration (Day 7-8)
1. Implement `get_signal_feed` with Redis adapter
2. Connect to memecoin-automation-swarm's signal bus
3. Add gbrain search tool
4. Test: "What are the strongest signals in the last hour?"

### Phase 4: Execution Layer (Day 9-12)
1. Implement `execute_swap` (Jupiter v6)
2. Position tracker (SQLite)
3. Risk gate: max position, daily loss, correlation
4. Exit manager: TP/SL/trailing
5. Paper-trade by default, live requires double opt-in
6. Test: Full paper-trade cycle — signal → analyze → allocate → execute → exit

### Phase 5: Polish + Release (Day 13-14)
1. WhatsApp gateway (from Dexter)
2. Eval suite for Solana-specific questions
3. README + demo GIF
4. Publish to GitHub, post to X

---

## Key Dependencies

```json
{
  "dependencies": {
    "@langchain/core": "latest",
    "@langchain/openai": "latest",
    "@solana/web3.js": "^1.95",
    "@solana/spl-token": "^0.4",
    "ink": "^5",
    "react": "^18",
    "zod": "^3",
    "better-sqlite3": "^11",
    "ioredis": "^5",
    "playwright": "^1.48"
  }
}
```

Runtime: Bun v1.1+

---

## Provider Implementation

### Helius Client (`src/providers/helius.ts`)
```typescript
// Helius provides:
// - Enhanced Transactions API (parsed swap/transfer data)
// - DAS API (token metadata, holder info)
// - Webhooks (real-time wallet monitoring)
// - Address Labels (known entities)
// - Priority Fee API

const HELIUS_BASE = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;

async function getEnhancedTransaction(signature: string) { ... }
async function getTokenMetadata(mint: string) { ... }
async function getTokenHolders(mint: string, limit: number) { ... }
async function getAddressLabels(addresses: string[]) { ... }
async function getPriorityFeeEstimate() { ... }
```

### Birdeye Client (`src/providers/birdeye.ts`)
```typescript
// Birdeye provides:
// - Real-time and historical token prices
// - OHLCV data
// - Trending tokens
// - Token security info
// - Wallet P&L

const BIRDEYE_BASE = "https://public-api.birdeye.so";

async function getTokenPrice(mint: string) { ... }
async function getOHLCV(mint: string, timeframe: string) { ... }
async function getTrending() { ... }
async function getWalletPnl(address: string) { ... }
```

### Jupiter Client (`src/providers/jupiter.ts`)
```typescript
// Jupiter v6 provides:
// - Quote API (best swap route)
// - Swap API (build + execute swap TX)
// - Token list API

const JUPITER_QUOTE = "https://quote-api.jup.ag/v6";
const JUPITER_SWAP = "https://quote-api.jup.ag/v6/swap";

async function getQuote(inputMint, outputMint, amount) { ... }
async function getSwapTransaction(quote, userPublicKey) { ... }
```

---

## Example Sessions

### Session 1: Token Research
```
User: "Analyze BONK — should I buy?"

Soldexter: [Decomposes into research plan]
  1. get_token_info(mint: "DezXAZ8z...P99") → metadata, supply, holders
  2. get_dex_data(mint: "DezXAZ8z...P99") → price, liquidity, volume
  3. get_token_holders(mint: "DezXAZ8z...P99", top: 20) → concentration
  4. get_trending_tokens() → relative momentum
  5. gbrain_search("BONK analysis") → historical context

[Validates and synthesizes]
"## BONK (DezXAZ8z...P99)

  **Price:** $0.00002834 | **MCap:** $1.9B | **Liq:** $48M
  **Age:** 588 days | **Holders:** 672,000+

  **Concentration:** Top 10 hold 18.2% — moderate. Team wallet still holds 3%.
  **Liquidity:** $48M across Raydium/Orca — deep. Can exit $500k without 2% impact.
  **Trend:** Down 12% in 24h, volume declining 3rd consecutive day.
  **Risk flags:** None critical. Established token with distributed supply.

  **Verdict:** Not a buy signal right now. Declining volume + negative momentum.
  Better entry after volume stabilization. Set alert at $0.000024 support."
```

### Session 2: Wallet Tracking
```
User: "What is 7x4kX... doing right now?"

Soldexter:
  1. search_wallet_labels("7x4kX...") → known whale, "SolBlaze founder"
  2. get_wallet_activity("7x4kX...", limit: 50) → recent swaps
  3. get_wallet_pnl("7x4kX...", "30d") → profitability
  4. analyze_wallet_network(["7x4kX..."], depth: 1) → associated wallets

"## Wallet 7x4kX... Profile

  **Label:** Known whale — SolBlaze founder
  **30d P&L:** +$2.3M (+187%) | Win rate: 71% across 94 trades
  **Avg position:** $24k SOL | **Typical hold:** 4-18 hours

  **Last 6 actions (last 2h):**
  1. Bought 85 SOL of POPE (new, 3min ago)
  2. Sold 120 SOL of WIF (took profit at +42%)
  3. Bought 45 SOL of MEW (5 min earlier)

  **Pattern:** Loading up on new meme launches. POPE is 12 minutes old with
  $23k liquidity — his typical early-entry pattern. Correlated wallets
  (3x4kY..., 9x4kZ...) also bought POPE within 60 seconds.

  **Confidence:** High. This wallet has 71% win rate on new launches over 30 days.
  POPE entry is consistent with his pattern of buying within first 15 minutes."
```

### Session 3: Live Signal + Execution (paper-trade)
```
User: "Show me the strongest signals right now and paper-trade the best one"

Soldexter:
  1. get_signal_feed(tier: "PRECOGNITIVE", limit: 10) → top signals
  2. [For each signal] get_token_info + get_dex_data + get_token_holders
  3. Rank by conviction score × win rate × liquidity

"## Top Signals (last 30 min)

  | # | Token | Wallet | Tier | Conviction | Liquidity |
  |---|-------|--------|------|------------|-----------|
  | 1 | PEPE2 | 7x4kX | PRECOG | 0.87 | $340k |
  | 2 | DODO | 3kM... | SOVEREIGN | 0.72 | $89k |
  | 3 | WOJAK2 | Ax9... | PRECOG | 0.65 | $12k ⚠️ |

  **Best risk-adjusted:** PEPE2 — high conviction wallet, deep liquidity.

  [Paper trade execution]
  → Quote: 0.5 SOL → 12.4M PEPE2 (slippage: 0.3%)
  → Risk check: ✅ Liquidity OK, ✅ Position < 5% book, ✅ No correlation
  → Paper order placed at $0.00000004 per token
  → Stop-loss: -30% ($0.000000028) | Take-profit: +100% ($0.00000008)

  Track with: `soldexter positions`"
```

---

## What Makes Soldexter Different

| Feature | Dexter | maximus (crypto fork) | **Soldexter** |
|---------|--------|-----------------------|---------------|
| Solana RPC data | No | Basic | Deep (Helius enhanced TX, DAS, labels) |
| DEX data | TradFi only | Basic price | Jupiter + Birdeye + DexScreener |
| Wallet profiling | No | No | Full P&L, labels, network analysis |
| Signal intelligence | No | No | 5-layer scoring from alpha-capture engine |
| Trade execution | No | No | Jupiter swap (paper + live) |
| Position management | No | No | SQLite tracker with TP/SL/trailing |
| Risk management | No | No | Kelly sizing, circuit breakers, correlation |
| gbrain integration | No | No | 15k+ pages of crypto research searchable |
| On-chain forensics | No | No | TX decode, program analysis, holder maps |
| Social signals | No | No | X velocity, trending token correlation |

---

## Integration with Existing Stack

Soldexter is the **research + interface layer** for the existing memecoin-automation-swarm:

```
memecoin-automation-swarm (Rust)
  ├── Helius polling (wallet intelligence)
  ├── 5-layer scorer (signal generation)
  ├── Redis signal bus
  └── Execution engine (Jupiter + positions)
         │
         ▼
  Soldexter (TypeScript/Bun)
  ├── Interactive CLI for human traders
  ├── Autonomous research agent
  ├── Consumes signal bus
  ├── gbrain knowledge search
  └── Can execute trades (paper or live)
```

Soldexter makes the alpha-capture engine **interactive** — ask it questions, get answers backed by real on-chain data.

---

## File-by-File Build Order

### Batch 1 — Agent Shell (copy from Dexter, minimal changes)
- `src/agent/agent.ts` — keep as-is
- `src/agent/compact.ts` — keep as-is
- `src/agent/microcompact.ts` — keep as-is
- `src/agent/scratchpad.ts` — keep as-is
- `src/agent/token-counter.ts` — keep as-is
- `src/agent/types.ts` — keep as-is
- `src/agent/run-context.ts` — keep as-is
- `src/agent/tool-executor.ts` — keep as-is
- `src/agent/channels.ts` — keep as-is
- `src/agent/index.ts` — keep as-is
- `src/model/llm.ts` — keep as-is
- `src/utils/*` — keep as-is
- `src/cli.ts` — rename dexter→soldexter
- `src/components/*` — keep as-is, update branding
- `src/controllers/*` — keep as-is

### Batch 2 — Providers (new)
- `src/providers/helius.ts`
- `src/providers/jupiter.ts`
- `src/providers/birdeye.ts`
- `src/providers/dexscreener.ts`

### Batch 3 — Tools (new, core research)
- `src/tools/solana/on-chain.ts`
- `src/tools/solana/token-info.ts`
- `src/tools/solana/dex-data.ts`
- `src/tools/solana/wallet-intel.ts`
- `src/tools/solana/tx-parser.ts`
- `src/tools/solana/trending.ts`

### Batch 4 — Tools (intelligence + execution)
- `src/tools/scanners/wallet-scorer.ts`
- `src/tools/scanners/signal-bus.ts`
- `src/tools/execution/jupiter-swap.ts`
- `src/tools/execution/risk-gate.ts`

### Batch 5 — Identity + Config
- `SOUL.md`
- `AGENTS.md`
- `configs/mainnet.json`
- `configs/paper-trade.json`

### Batch 6 — Tool Registration
- `src/tools/registry.ts` — register all new tools
- `src/tools/index.ts` — export everything
- `src/agent/prompts.ts` — rewrite for Solana context

---

## Success Criteria

1. `bun start` → interactive CLI with Solana branding
2. "Analyze <token_mint>" → full risk profile in < 30 seconds
3. "What is <wallet> doing?" → activity + P&L + network in < 20 seconds
4. "Best signals right now" → ranked signal feed in < 15 seconds
5. "Paper trade the top signal" → end-to-end paper execution in < 10 seconds
6. All tools return structured data with source URLs
7. Scratchpad logs every tool call for audit
8. Memory persists across sessions
9. Zero TradFi tools remaining — pure Solana/crypto
10. README with install instructions, 3 example sessions, and demo GIF
