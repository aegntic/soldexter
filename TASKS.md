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

## Next (RINGMASTER "ok continue with whats next list" 2026-06 via ~/.grok/skills + compound skills)
Use exclusively Grok-native skills from ~/.grok/skills/* (symlinks surface compound/ecc/gstack: terminal-ops, ship, health, verification-loop, agent-native-audit, compound-refresh, ubiquitous-language, workflows-*, gstack review/ship etc.). Evidence-first. Phased <=5 files. Re-read pre/post edit. Forced bun typecheck + bun test + fix ALL before claim. Immutability, hygiene, pipelines (live-sync/indexer/vault/gbrain-alt/REPORT), caveman for rate, prompt-fail sacred.

- [ ] 1. Full real e2e dogfood with live Helios key (72764c06-ecd6-458e-bf12-6b567504eff6): rich value-hook setup walkthrough (attention + concrete outcomes) + post-save immediate real on-chain Helius data (no stale/auth/404). Execute via terminal-ops skill (resolve surface soldexter/feat clean, read, narrow proving cmds, report exact "inspected/verified locally/committed" + SURFACE/EVIDENCE/ACTION/STATUS format). Live-sync capture + vault.
- [ ] 2. Invoke /ship skill (read ~/.grok/skills/ship/SKILL.md): detect platform/branch/status/diff/log, pre-flight, tests, review, version/changelog, commit, push, create PR for TUI polish + rich setup + health baseline + docs milestone. (Hygiene: consistently commits/PRs/tags at milestones.)
- [ ] 3. agent-native-audit skill on soldexter (TUI/agentic: setup walkthrough value hooks, ApiKeyInput, providers hot-reload, cli loop, banner/shadow, model guard) + ringmaster meta (hermes/COORD/droids/pipelines). Read SKILL from ~/.grok, announce, load agent-native-architecture ref, parallel 8-principle scored tracks (Action Parity etc.), compile summary report with X/Y + top recs. Persist to vault/ALPHA.
- [ ] 4. compound-refresh skill: refresh stale or drifting learnings/pattern docs in docs/solutions/ (or soldexter/rektdexter) against current codebase post TUI changes.
- [ ] 5. ubiquitous-language skill: extract DDD-style ubiquitous language glossary from current conversation (soldexter/rektdexter/alpha capture/REKT-DCF/bridge/valuation signal/ringmaster/meta-delegation/prompt-fail sacred etc), flag ambiguities, propose canonical terms. Saves to UBIQUITOUS_LANGUAGE.md (alpha root or soldexter).
- [ ] 6. Update/persist docs at milestone: TASKS.md + ROADMAP.md + ALPHA_CAPTURE_PLAN.md (self-mod single-source insert RINGMASTER WHATS NEXT + evidence) + RINGMASTER_STATUS.md. Conventional commit. Re-health.
- [ ] 7. Re-run /health skill (now Health Stack persisted in AGENTS.md enables without re-detect): trend scores post TUI (target deadcode/gbrain). Persist dashboard.
- [ ] 8. Sustain ringmaster pipelines: live-sync.sh once/loop (guarded tail || true, if-elif), python indexer --write on parents/.hermes/vault/alpha-logs/02+soldexter for tag/dedup/MOC/Gbrain-Parallel, gbrain timeline/put/sync/export alt (MCP disconnect use bg/local), mon-raw tmux capture + "RINGMASTER REPORT ... delta block" to vault (0-REKT-DCF/2-SOLDEXTER.md). Insert Evidence/Last updated by RINGMASTER in ALPHA/RINGMASTER.
- [ ] 9. Pivot parallel to rektdexter (P0-P4 per ALPHA, REKT-DCF high-edge revenue/Metcalfe/scorer distinct from soldexter bridge-only valuation, Rust book.rs NAV/attribution/edge_decay feedback, Jupiter paper + Redis bus, gbrain, soldexter bridges ONLY no muddle). Use /plan or workflows-plan or plan-eng-review + agent-native-audit on Rust/agentic. Maintain 6-pane/tilix visible, meta-delegator, /missions, caveman, heartbeat/REPORT.
- [ ] 10. Hygiene always (CLAUDE/AGENTS/gstack/ECC): git status --porcelain -b first before any work/commits; conventional <type>: <desc> commits (no Co-Authored-By ever); tags + PRs at milestones; README/ROADMAP/TASKS/ALPHA/RINGMASTER updated; 80%+ TDD (unit/int/e2e); security-first; phased execution; re-read before edit (esp >500LOC or 10+ msgs); forced verify before "done" claim; todo_write for complex; self-mod plans; records (live/gbrain/vault); MCP resilience via alts; caveman 75% on rate; prompt-fail sacred (never touch).

See ROADMAP.md, ALPHA_CAPTURE_PLAN.md (self-mod), RINGMASTER_STATUS.md. "USE THE SKILLS" — rolls royce, not cardboard.
