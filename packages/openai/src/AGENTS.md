# OPENAI ADAPTER KNOWLEDGE

## OVERVIEW
`@sapper-ai/openai` adapts core guardrails to the `@openai/agents` runtime via input/output guardrail factories.

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Public package API | `index.ts` | Stable exports for integration users |
| Guardrail implementation | `guardrails.ts` | Input/output hook creation and error behavior |
| Runtime behavior tests | `__tests__/guardrails.test.ts` | enforce/monitor + blocking assertions |
| End-to-end adapter test | `__tests__/e2e.test.ts` | integration-level usage contract |

## CONVENTIONS
- Keep this package as an adapter layer; security logic belongs in `@sapper-ai/core`.
- Use `Policy` and detector contracts from `@sapper-ai/types` directly.
- Keep exported API minimal and stable (`createToolInputGuardrail`, `createToolOutputGuardrail`).
- Ensure thrown errors remain actionable for caller-side handling.

## ANTI-PATTERNS
- Do not duplicate rules/policy matching logic already implemented in core.
- Do not introduce package-local policy schema variants.
- Do not add transport/process management concerns here (belongs to `@sapper-ai/mcp`).

## EXTENSION POINTS
- New guardrail behavior should be implemented by composing core APIs (DecisionEngine/Guard) rather than bypassing them.
- If new policy fields are required, update `@sapper-ai/types` and `@sapper-ai/core` first, then adapt this package.

## QUICK CHECKS
```bash
pnpm --filter @sapper-ai/openai test
pnpm exec tsc -b --noEmit
```
