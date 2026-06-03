# soldexter Tasks

See ROADMAP.md, SPEC.md, skills/*.

## Active
- [ ] Valuation skill + rektdexter bridge (DCF as fundamentals edge).
- [ ] Subagent delegation examples (2-3 layers, ECC agents).
- [ ] Themed CLI (prefixes, boxes, colors for diff).
- Expand tools, memory, evals.

## Done (2026-06 via gstack investigate + phased)
- [x] Basic TUI functional: rich value-hook setup walkthrough, correct model in banner (guard + good defaults), keys hot-reload for tools, no gpt-5.5 404, chalk direct dep, launch to main interactive. Commits c2730ca,4b4732f,f45dee1. Used investigate skill, gbrain, pipelines, terminal verification. (Phases <=5 files each, forced checks.)
- [x] Polish + e2e verify: added gpt-4o-mini / gpt-4o to PROVIDER_MODELS for nice display "GPT 4o mini" + correct getDefault. Verified real Helius tool call with provided live key (key accepted, RPC reached; no auth err). Health Stack persisted to AGENTS.md. Live-sync captured. 

## Tech
- Prefer delegate heavy to rektdexter Rust.
- bun run, uv for py.
- Paper default.

## License
Personal/dev free. Commercial $99 + ack.

Contribute: PRs to roadmap/tasks.
