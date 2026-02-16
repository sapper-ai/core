# TYPES CONTRACT KNOWLEDGE

## OVERVIEW
`@sapper-ai/types` defines the shared security contracts consumed by `core`, `mcp`, `sapper-ai`, and web integrations.

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Guard/detector contracts | `index.ts` | `Detector`, `DetectorOutput`, `Decision`, `AssessmentContext` |
| Policy shape and overrides | `index.ts` | `Policy`, `ToolPolicy`, `MatchList`, `ThreatFeedConfig` |
| Tool IO model | `index.ts` | `ToolCall`, `ToolResult`, `ToolMetadata` |
| Type regression tests | `__tests__/types.test.ts` | `expectTypeOf` checks for public contract stability |

## CONVENTIONS
- Treat this package as the source of truth for cross-package interface compatibility.
- Any policy field added here must be validated and consumed in `@sapper-ai/core` before release.
- Keep runtime exports minimal; prioritize stable type contracts and backward compatibility.
- Update type tests when changing public interfaces.

## ANTI-PATTERNS
- Do not add package-specific semantics that only one consumer understands.
- Do not change union literals or interface fields without updating dependent package behavior/tests.
- Do not rely on implicit `any`-like widening for security-critical fields.

## QUICK CHECKS
```bash
pnpm --filter @sapper-ai/types test
pnpm exec tsc -b --noEmit
```
