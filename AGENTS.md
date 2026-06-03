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

## Health Stack
- typecheck: bun run typecheck
- test: bun test
- deadcode: npx knip
- shell: shellcheck scripts/release.sh
- gbrain: gbrain doctor --json (wrapped in timeout 5s)

(Lint: none configured/detected. Update this section or re-run /health to adjust.)
