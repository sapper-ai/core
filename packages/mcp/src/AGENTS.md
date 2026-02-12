# MCP INTEGRATION KNOWLEDGE

## OVERVIEW
`@sapper-ai/mcp` is the runtime enforcement adapter: stdio proxy, CLI, watcher/quarantine, and adversary campaign operations.

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Main MCP interception flow | `StdioSecurityProxy.ts` | tools/list and tools/call pre/post handling |
| CLI parse and dispatch | `cli.ts` | subcommands + env fallbacks + policy resolution |
| Watch/install scan pipeline | `services/FileWatcher.ts` | file add/change -> scan -> quarantine |
| Threat feed load helper | `services/threatIntel.ts` | shared load/sync semantics for services |
| Adversary simulation | `services/AdversaryCampaignRunner.ts` | run/replay + artifact output |
| Command handlers | `commands/*.ts` | thin wrappers with JSON output contracts |
| Public exports | `index.ts` | stable package API surface |

## CONVENTIONS
- Keep command modules thin (`commands/*`) and delegate heavy logic to `services/*`.
- CLI parsing stays explicit and deterministic; every flag must validate value presence.
- Reuse core abstractions (`PolicyManager`, `DecisionEngine`, `createDetectors`, `applyThreatIntelBlocklist`) instead of re-implementing policy/detector logic.
- Prefer constructor injection for testability (`auditLogger`, `scanner`, `threatIntelStore`, transports).
- Command outputs are JSON-friendly and testable via injectable `write` callbacks.

## ANTI-PATTERNS
- Do not add new security decisions directly inside CLI parser branches.
- Do not duplicate threat-intel merge/load logic across services; use shared helper.
- Do not bypass `resolvePolicy` in runtime command flows.
- Do not introduce non-deterministic smoke behavior in core security command paths.

## EXTENSION POINTS
- New CLI subcommand: add parser branch in `cli.ts`, implement `commands/<name>.ts`, optionally add service under `services/`.
- New proxy behavior: extend `StdioSecurityProxy` with focused helpers, keep transport boundary stable.
- New watch behavior: extend `FileWatcher` target extraction/evaluation path and ensure audit+quarantine behavior is preserved.

## QUICK CHECKS
```bash
pnpm --filter @sapper-ai/mcp test
pnpm --filter @sapper-ai/core run test:smoke
pnpm build
```
