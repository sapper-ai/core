# OpenClaw Skill Scanner — Code Review Fix Plan (v2.1, Must-Only)

> Date: 2026-02-17
> Status: Revalidated — keep only mandatory fixes
> Source: 6-agent parallel code reviews + current code re-check
> Baseline: `pnpm build`/`pnpm test` (root) currently fail due Turbo TLS keychain issue, `pnpm exec tsc -b --noEmit` passes

---

## Summary

This document was revalidated against the current repository state.
Only fixes that are necessary for correctness/security signal quality are kept as active TODOs.
Style-only or low-impact hardening items are deferred.

### Revalidation Result

| Category | Count |
|---|---:|
| Must fix now | 5 |
| Defer (not mandatory now) | 16 |
| Not needed with current code path | 4 |

---

## Must-Fix TODOs

### 1) TODO-P1.1 — YAML Size Limits (Billion Laughs / memory pressure)
- File: `packages/core/src/parsers/SkillParser.ts`
- Why required: no file/frontmatter size limit before `parseYaml(raw)`.
- Required change:
  - add `MAX_SKILL_FILE_SIZE` and `MAX_FRONTMATTER_SIZE`
  - reject oversized content before YAML parsing
- Verify: `pnpm --filter @sapper-ai/core run test`

### 2) TODO-P1.3 — Error Message Sanitization
- File: `packages/sapper-ai/src/openclaw/scanner.ts`
- Why required: raw exception messages are copied into `reasons`, which can expose absolute local paths.
- Required change:
  - sanitize/truncate error strings before appending to `reasons`
  - apply for parse/dynamic/quarantine error paths
- Verify: `pnpm --filter sapper-ai run test`

### 3) TODO-P1.7 — read_only + CA Install Conflict
- Files:
  - `packages/sapper-ai/src/openclaw/docker/docker-compose.yml`
  - `packages/sapper-ai/src/openclaw/docker/install-ca.sh`
- Why required: `openclaw` service is `read_only: true` while CA install writes under `/usr/local/share/ca-certificates`.
- Required change:
  - prefer `NODE_EXTRA_CA_CERTS=/proxy-ca/mitmproxy-ca-cert.pem` to avoid root FS writes
  - align runtime so HTTPS MITM trust actually works under read-only mode
- Verify: Docker run path with mitmproxy certificate trusted

### 4) TODO-P1.8 — unknownHosts False Positive Handling
- File: `packages/sapper-ai/src/openclaw/scanner.ts`
- Why required: current logic treats `unknownHosts.length > 0` as confirmed exfiltration.
- Required change:
  - keep `exfiltrationDetected` tied to honeytoken findings only
  - treat unknown hosts as suspicious signal, not automatic quarantine
- Verify: mock traffic with unknown host and no honeytoken => not `quarantined`

### 5) TODO-P1.10 — Cleanup Failure Visibility
- File: `packages/sapper-ai/src/openclaw/scanner.ts`
- Why required: sandbox cleanup failure is silently swallowed (`.catch(() => undefined)`).
- Required change:
  - surface cleanup errors via warning/logging while keeping scan flow alive
- Verify: mocked cleanup failure produces visible warning

---

## Deferred / Not Mandatory Now

### Deferred (keep for later)
- TODO-P1.2 Path traversal defense in `detect.ts` (needs product decision: strict root restriction may break legitimate `extraDirs` usage)
- TODO-P1.4 Nested ternary -> if/else (readability only)
- TODO-P1.5 Remove policy type casts (style/typing cleanup)
- TODO-P1.6 Image rename anti-sandbox rule (cosmetic hardening)
- TODO-P1.9 Docker resource limits (worth doing, but not blocking for immediate correctness)
- TODO-P1.11 subtle-skill edge-case test (coverage improvement)
- P2.1 ~ P2.10 (unchanged: low severity / refactor scope)

### Not needed now (current code path)
- TODO-P0.1 YAML prototype pollution defense: parser currently normalizes to fixed metadata fields and does not merge untrusted YAML objects into shared objects.
- TODO-P0.2 execFile binary allowlist: binary names in `detect.ts` are fixed literals, not user-controlled.
- TODO-P0.3 shell injection claim on `run_scenario "$*"`: with current `OpenClawTestRunner` invocation and quoted usage, no shell eval path is present.
- TODO-P0.4 scenario/container-id validation: additional hardening possible, but current values are not from direct user shell input in this flow.

---

## Verification Checklist (Must-Fix Scope)

After applying only the 5 must-fix items:

- [ ] `pnpm --filter @sapper-ai/core run test`
- [ ] `pnpm --filter sapper-ai run test`
- [ ] `pnpm --filter sapper-ai run build`
- [ ] `pnpm exec tsc -b --noEmit`
- [ ] YAML oversize input is rejected
- [ ] scan reasons do not leak absolute paths
- [ ] CA trust works in read-only container runtime path
- [ ] unknownHosts-only case is suspicious, not quarantined
- [ ] cleanup failure is visible to operator

---

## Execution Order (Must-Fix Only)

1. `SkillParser.ts`: TODO-P1.1
2. `scanner.ts`: TODO-P1.3 + TODO-P1.8 + TODO-P1.10
3. Docker runtime files: TODO-P1.7
4. Targeted tests + typecheck/build verification

---

## Revision History

- **v2.1 (2026-02-17)**: Revalidated against current code. Reduced plan to 5 mandatory items; moved non-blocking items to deferred/not-needed.
- **v2 (2026-02-17)**: Merged Phase 3 Docker review findings.
- **v1 (2026-02-17)**: Initial plan from Phase 1-2 review.
