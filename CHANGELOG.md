# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2026.6.2] - 2026-06-03

### Added
- Rich intuitive initial setup walkthrough full of attention and value hooks during setup (Helius: "THE on-chain foundation... 80% of what makes Soldexter feel like having a full research desk"; Birdeye live prices/volume; LLM; howToGet links; "✅ ${name} connected — capability unlocked"; "Core setup complete. High-value mode activated." + 3 copy-paste example queries).
- Precise SOLDEXTER banner: SOL lighter purple (#c084fc) solids for first 3 chars + purple (#b47aff) non-solid double-line shadows (╔╗╚╝═║ cast at +1 row +1 col offset in single 7-row block, main solids first); DEXTER white + #258bff blue shadows; subtitle/model in light blue. Comments updated to exact spec.
- Health Stack in AGENTS.md (typecheck: bun run typecheck, test: bun test, deadcode: npx knip, shell: shellcheck, gbrain: gbrain doctor --json).
- Valuation/DCF skill + rektdexter bridge layer (distinct from soldexter: valuation signal, wallet-score, redis pub/sub for alpha signals).
- Ringmaster pipelines sustain + self-mod docs (ALPHA_CAPTURE_PLAN.md, RINGMASTER_STATUS.md, TASKS/ROADMAP with list).

### Changed
- Providers (helius/birdeye): keys read live from process.env at call time (hot-reload after walkthrough saveApiKeyToEnv; no top-level const capture).
- Model: 'gpt-4o-mini' first in PROVIDER_MODELS with displayName, DEPRECATED map for gpt-5.x, ctor guard in model-selection; banner shows sensible model.
- TUI: cli runInitialSetupWalkthrough on !isCoreSetupComplete, banner in intro, env utils CORE_SETUP_ITEMS with valueHooks, main view after.
- Docs at milestones: ROADMAP (TUI + next DCF/bridge), TASKS (Done sections + Next ringmaster list via ~/.grok/skills), README/LICENSE (tech prefs Rust>TS/bun/uv, license personal free / commercial $99+ack).
- Version: reconciled to 2026.6.2 (calendar in pkg + VERSION); ALREADY_BUMPED state.

### Fixed
- gpt-5.5 404 and ugly display (guard + good defaults).
- Stale keys post-setup (live process.env + save override dotenv).
- Banner shadow (only S purple before; now first 3 purple solids + exact non-solid doubles shadow).
- Missing chalk direct dep.
- Pre-existing typecheck errs in bridge/redis.ts (ioredis) noted, no regression.

### Verified (forced per rules)
- bun test: 49 pass, 0 fail, 92 expect (fresh runs).
- Full real e2e dogfood (Helios key 72764c06-ecd6-458e-bf12-6b567504eff6): setup sim save, "✅ Helius connected — capability unlocked... The agent can immediately use real on-chain.", curl to helius-rpc with key returns real slot (423942848), no auth/stale/404.
- bun run typecheck: clean except pre-existing redis 6 errs.
- Hygiene: git status first, phased <=5 files, re-read pre/post, conventional commits (no Co-Authored-By), trees clean.
- Pipelines: live-sync, indexer, gbrain-alt, mon-raw + RINGMASTER REPORT deltas.

See TASKS.md, ROADMAP.md, ALPHA_CAPTURE_PLAN.md (RINGMASTER WHATS NEXT LIST persisted), RINGMASTER_STATUS.md. Used ~/.grok/skills exclusively (terminal-ops for e2e prove, ship for this).

## [Unreleased]

