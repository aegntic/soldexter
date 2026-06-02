# soldexter Roadmap

Terminal AI agent for Solana research & trading intelligence. Bun/TS harness, delegates to rektdexter Rust engine for heavy/core.

See SPEC.md for full agent spec.

## Phases

### Current: DCF/Valuation Integration (high-level edge)
- Valuation skill (dcf/valuation/SKILL.md) for fair value.
- Bridge to rektdexter REKT-DCF (fundamentals complement to alpha signals).
- Integrate ValuationSignal into agent flows/confluence.
- Paper trade with valuation checks.

### Agent Features
- Expand tools (more Solana, web, memory).
- Subagent delegation (2-3 layers, use ECC specialized agents).
- Persistent memory, evals, gateway (whatsapp etc.).
- Themed CLI output.

### Polish & Scale
- Rust core where perf needed (via rektdexter).
- Live execution.
- More LLM backends.
- Community: tasks in this repo.

## Milestones
- v0.1.0: Core agent + tools.
- v0.2.0: DCF valuation + rektdexter integration (current).
- Tags, PRs.

See TASKS.md. Update README/this on changes.

Tech: Rust > TS for core, bun, uv.
