# Soldexter Agents

This project is an autonomous Solana research agent forked from Dexter (virattt/dexter).

Credits:
- Original Dexter: virattt/dexter (Dexter Labs)
- Soldexter: @aegntix / Mattae Cooper (aegntic/soldexter)

## Architecture

- Agent loop: plan -> execute tools -> validate -> refine
- Tools: Solana-native (Helius, Birdeye, Jupiter, DexScreener)
- Memory: Persistent via gbrain + SQLite
- Execution: Optional Jupiter swaps (paper-trade default)

## Build
```
bun install
bun run dev
```
