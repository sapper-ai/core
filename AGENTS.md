# PROJECT KNOWLEDGE BASE

**Generated:** 2026-02-11
**Commit:** e67c2d9
**Branch:** main

## OVERVIEW
SapperAI is a TypeScript pnpm/turbo monorepo for AI security guardrails. It provides core detection, MCP proxy/CLI, and a unified user-facing CLI package.

## STRUCTURE
```text
SapperAI/
├── packages/
│   ├── core/      # detection engine, policy, detectors, scanner/guard
│   ├── mcp/       # stdio proxy, CLI commands, watcher/quarantine, adversary runner
│   ├── sapper-ai/ # single-install CLI/SDK wrapper package
│   └── types/     # shared policy/decision interfaces used by all packages
├── docs/ops/      # operational runbooks
├── .github/workflows/  # release + security-smoke CI
└── scripts/       # one-off utilities
```

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Policy schema, thresholds, overrides | `packages/types/src/index.ts` | Canonical types used everywhere |
| Decision logic and risk aggregation | `packages/core/src/engine/DecisionEngine.ts` | Block/allow core |
| Pattern matching, allow/block lists | `packages/core/src/engine/PolicyMatcher.ts` | Regex and exact-match behavior |
| Threat feed cache/sync | `packages/core/src/intel/ThreatIntelStore.ts` | Timeout + dedupe + cache persistence |
| MCP runtime enforcement | `packages/mcp/src/StdioSecurityProxy.ts` | tools/list and tools/call interception |
| File install scanning/quarantine | `packages/mcp/src/services/FileWatcher.ts` | add/change watcher pipeline |
| CLI command routing | `packages/mcp/src/cli.ts` | parse + dispatch |
| Adversarial simulation | `packages/mcp/src/services/AdversaryCampaignRunner.ts` | run/replay + artifact generation |
| Operational usage | `docs/ops/*.md` | runbook procedures |

## CODE MAP
| Symbol | Type | Location | Role |
|---|---|---|---|
| `DecisionEngine` | class | `packages/core/src/engine/DecisionEngine.ts` | Computes final decision from detector outputs |
| `PolicyManager` | class | `packages/core/src/engine/PolicyManager.ts` | Loads/merges policy and tool overrides |
| `createDetectors` | function | `packages/core/src/engine/DetectorFactory.ts` | Central detector composition |
| `ThreatIntelStore` | class | `packages/core/src/intel/ThreatIntelStore.ts` | Feed ingest + cache |
| `StdioSecurityProxy` | class | `packages/mcp/src/StdioSecurityProxy.ts` | MCP transport security boundary |
| `FileWatcher` | class | `packages/mcp/src/services/FileWatcher.ts` | Local config watcher + quarantine |
| `AdversaryCampaignRunner` | class | `packages/mcp/src/services/AdversaryCampaignRunner.ts` | Sandbox red-team campaigns |

## CONVENTIONS
- TypeScript strict mode and per-package composite builds (`tsc`, `tsc -b`).
- Package public APIs re-export from `packages/*/src/index.ts`.
- Tests live in `src/__tests__` and run with Vitest (`pnpm test`).
- Security-sensitive behavior must be audited via explicit decision reasons and artifact files.

## ANTI-PATTERNS (THIS PROJECT)
- Bypassing core policy path; always use `PolicyManager` + `DecisionEngine` flow.
- Adding new detector logic directly in MCP layer when core abstraction exists.
- Silent fallback for security-sensitive failures without audit entry.
- Expanding CLI parsing with ad-hoc value handling; use shared option validation style.

## UNIQUE STYLES
- Monorepo package boundaries are strict: `types -> core -> (mcp, sapper-ai, web)`.
- Threat intel behavior is fail-open/fail-closed configurable per policy feed config.
- Adversary runner stores deterministic artifacts (`summary.json`, `trace.jsonl`, `proposals.json`).

## COMMANDS
```bash
pnpm build
pnpm test
pnpm --filter @sapper-ai/core run test:smoke
pnpm exec tsc -b --noEmit
```

## NOTES
- CI workflows: `release.yml` for publish path, `security-smoke.yml` for deterministic smoke checks.
- Keep docs in `docs/ops` updated whenever CLI/flow semantics change.
