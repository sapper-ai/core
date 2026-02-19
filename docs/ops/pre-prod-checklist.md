# Pre-Production Checklist Runbook

## Purpose

Block release until security and reliability blockers are closed, verified, and documented.

## Release Gate Policy

1. Do not publish if any Release Blocker is open.
2. Every blocker must have a linked test or verification artifact.
3. Use explicit runtime paths in production (`SAPPERAI_AUDIT_LOG_PATH`, `SAPPERAI_QUARANTINE_DIR`, `SAPPERAI_THREAT_FEED_CACHE`).
4. Use explicit policy mode in production (`enforce` vs `monitor`) and keep the selected mode documented in rollout notes.

## Release Blockers (Must Fix)

1. `[ ]` `Critical` Audit logging must be safe-by-default.
Accept if: default runtime path never emits full decision context to stdout, and sensitive fields are redacted in logs.
Evidence files: `packages/sapper-ai/src/createGuard.ts:31`, `packages/core/src/logger/AuditLogger.ts:25`, `packages/core/src/guards/Guard.ts:24`

2. `[ ]` `Critical` Audit write failures must not break or bypass enforcement.
Accept if: logger write errors are handled in guard/proxy paths with deterministic behavior and explicit telemetry.
Evidence files: `packages/core/src/guards/Guard.ts:24`, `packages/core/src/guards/Guard.ts:46`, `packages/mcp/src/StdioSecurityProxy.ts:629`, `packages/mcp/src/services/FileWatcher.ts:275`

3. `[ ]` `Critical` Close MCP notification bypass for `tools/call` without `id`.
Accept if: missing-id `tools/call` is rejected or fully guarded before forwarding.
Evidence files: `packages/mcp/src/StdioSecurityProxy.ts:217`, `packages/mcp/src/StdioSecurityProxy.ts:218`

4. `[ ]` `High` Fix fail-open semantics in `DecisionEngine`.
Accept if: detector error does not unconditionally force `allow` when successful detectors already indicate block.
Evidence files: `packages/core/src/engine/DecisionEngine.ts:40`, `packages/core/src/engine/DecisionEngine.ts:43`

5. `[ ]` `High` Standardize runtime state directory (`~/.sapperai` vs `~/.sapper-ai`).
Accept if: one canonical directory is used with backward-compatible migration.
Evidence files: `packages/sapper-ai/src/postinstall.ts:12`, `packages/sapper-ai/src/guard/ScanCache.ts:11`, `packages/sapper-ai/src/guard/WarningStore.ts:10`, `packages/sapper-ai/src/auth.ts:20`, `packages/sapper-ai/src/scan.ts:694`

6. `[ ]` `High` Harden threat intel transport and freshness.
Accept if: insecure feed transport is disallowed by default, and `ttlMinutes` has enforced behavior in load/sync flow.
Evidence files: `packages/core/src/intel/ThreatIntelStore.ts:189`, `packages/core/src/engine/PolicyManager.ts:43`, `packages/mcp/src/services/threatIntel.ts:23`

7. `[ ]` `High` Resolve policy contract mismatch for `auditLogPath`.
Accept if: `auditLogPath` is either formally supported across schema/load paths or removed from generated policy output.
Evidence files: `packages/sapper-ai/src/cli.ts:1179`, `packages/sapper-ai/src/policyYaml.ts:27`, `packages/core/src/engine/PolicyManager.ts:56`

8. `[ ]` `High` Quarantine failure must be explicit in enforce path.
Accept if: quarantine failure no longer silently passes and surfaces clear operator-visible failure signals.
Evidence files: `packages/sapper-ai/src/scan.ts:328`, `packages/sapper-ai/src/scan.ts:332`, `packages/mcp/src/services/FileWatcher.ts:280`, `packages/mcp/src/services/FileWatcher.ts:364`

9. `[ ]` `High` Bound proxy pending state.
Accept if: pending request structures have duplicate-id handling, TTL cleanup, and upper bounds.
Evidence files: `packages/mcp/src/StdioSecurityProxy.ts:124`, `packages/mcp/src/StdioSecurityProxy.ts:125`

10. `[ ]` `Medium` Clarify `defaultAction` policy contract.
Accept if: `defaultAction` is actively enforced in decision logic, or removed/deprecated consistently in types/schema/docs.
Evidence files: `packages/types/src/index.ts:165`, `packages/core/src/engine/PolicyManager.ts:58`, `packages/core/src/engine/DecisionEngine.ts`

## Standard Operating Procedure

1. Freeze candidate commit and record SHA in release notes.
2. Close all Release Blockers and attach proof (test results, logs, diff links).
3. Run validation commands:

```bash
pnpm exec tsc -b --noEmit
pnpm --filter @sapper-ai/types build
pnpm --filter @sapper-ai/core build
pnpm --filter @sapper-ai/mcp build
pnpm --filter sapper-ai build
pnpm --filter @sapper-ai/types test
pnpm --filter @sapper-ai/core test
pnpm --filter @sapper-ai/mcp test
pnpm --filter sapper-ai test
pnpm --filter @sapper-ai/core run test:smoke
```

4. Confirm CI workflows pass on the same commit (`release.yml`, `security-smoke.yml`).
5. Execute canary rollout with rollback triggers pre-declared.

## Troubleshooting

- `pnpm build` fails locally with environment-specific Turbo/keychain errors:
Use package-level `build` commands above to validate TypeScript artifacts, then confirm CI workflow status.
- Threat intel unexpectedly empty:
Verify feed source configuration and cache path, then run `sapperai-proxy blocklist status` and `sapperai-proxy blocklist list`.
- Watch mode did not quarantine:
Confirm policy mode is `enforce` and quarantine path is writable.

## Common Commands

```bash
# Deterministic smoke gate
pnpm --filter @sapper-ai/core run test:smoke

# Threat intel status check
sapperai-proxy blocklist status

# Watch path protection
sapperai-proxy watch --policy ./policy.yaml
```
