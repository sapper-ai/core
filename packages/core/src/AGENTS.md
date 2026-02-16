# CORE KNOWLEDGE

## OVERVIEW
`@sapper-ai/core` is the decision pipeline and shared security logic used by all integrations.

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Final allow/block decision logic | `engine/DecisionEngine.ts` | Risk/confidence aggregation + thresholding |
| Policy parsing and per-tool override merge | `engine/PolicyManager.ts` | YAML/JSON load and zod validation |
| Explicit allowlist/blocklist matching | `engine/PolicyMatcher.ts` | Fast match path before detector work |
| Detector composition | `engine/DetectorFactory.ts` | Rules/LLM/threat-intel creation |
| Threat feed ingest/cache | `intel/ThreatIntelStore.ts` | Fetch, timeout, dedupe, snapshot |
| Threat-intel to policy merge | `engine/ThreatIntelPolicy.ts` | Applies intel entries into blocklist |
| Guard APIs | `guards/Guard.ts`, `guards/Scanner.ts` | Runtime and install-scan entrypoints |
| Operational side effects | `quarantine/QuarantineManager.ts`, `logger/AuditLogger.ts` | Filesystem quarantine + audit output |

## CONVENTIONS
- Keep security semantics in core; integrations should call core APIs, not re-implement policy logic.
- `DecisionEngine` is the canonical action resolver; detector outputs feed it, not vice versa.
- Policy schema changes must start in `@sapper-ai/types` and be validated in `PolicyManager`.
- Cross-cutting helpers should be exported from `src/index.ts` for stable package boundaries.
- Tests live under `src/__tests__`, grouped by feature (`detectors`, `engine`, `intel`, `quarantine`, etc.).

## ANTI-PATTERNS
- Do not add detector logic directly in `mcp` or web/CLI integrations; implement detector in `core/detectors` and wire in factory.
- Do not bypass `PolicyManager.resolvePolicy` when tool overrides are relevant.
- Do not silently swallow security-critical failures without audit reason entries.
- Do not couple network/file I/O directly into unrelated modules; keep concerns separated.

## EXTENSION POINTS
- New detector: add `detectors/<Name>.ts` -> export in `index.ts` -> register in `DetectorFactory.ts`.
- New policy field: add type in `@sapper-ai/types` -> validate in `PolicyManager` -> consume in engine/guards.
- New threat indicator type: add in `ThreatIntelStore` normalization and mapping, then evaluate in detector/matcher.

## QUICK CHECKS
```bash
pnpm --filter @sapper-ai/core test
pnpm --filter @sapper-ai/core run test:smoke
pnpm --filter @sapper-ai/core run bench
```
