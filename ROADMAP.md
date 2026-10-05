# Roadmap

The split between core and Soldextra is not final. Flip a row in `src/soldextra/registry.ts` when the owner decides. Do not treat the list below as a pricing decision.

## In the tree

- Official GMGN OpenAPI read-only client (token, market, wallet stats, kol, smartmoney). Free-tier 5/5 bucket, sequential, one backoff on a short 429. Swap, order, and cooking are not callable
- Five-layer wallet scan with the owner weights, tiers, minimums, and red-flag disqualifiers. Unmeasured layers stay unverifiable and are left out of the score
- Risk auditor: mint and freeze authority, Token-2022 extensions, LP when RugCheck answers, funding-graph bundler detection, loud honeypot / drainer / fake-airdrop flags (including the CypherAid / ALREADY CLAIMED pattern)
- Append-only paper ledger scored at 1h, 24h, and 72h after fees and slippage. The existing live-trade double opt-in is unchanged
- Model roles so gather turns can use Ollama or a fast model while synthesis stays on the session model

## Not built yet

- A full 14-day public-RPC parse. The live scan samples at most 8 transactions because the public RPC 429s under load. A free Helius key is the optional speed path; paid Helius volume stays a soldextra row
- Historical entry market cap. Live buys do not carry a pool-time price, so irrational conviction and liquidity ghost stay unverifiable until that series is stored
- Loser cohort, community-takeover claim times, and a peer cohort for inverse loss, CTO meta-reader, and consensus deviation. The scorer accepts them when a caller has measured them
- LP lock re-check about 10 minutes after pool creation
- An X signal join. The X API is soldextra and stays off until that row is enabled
- A new-mint listener. Program ids in `src/intel/programs.ts` use the corrected Meteora DLMM id, but this change does not subscribe to logs
