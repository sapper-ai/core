# OPS RUNBOOK KNOWLEDGE

## OVERVIEW
`docs/ops` contains operator runbooks for production usage of watch/quarantine, threat intel, and adversary campaigns.

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Runbook index | `README.md` | validation commands + incident defaults |
| File watch operations | `watch-quarantine.md` | startup, restore, troubleshooting |
| Threat feed operations | `threat-intel.md` | sync/status/list/check workflows |
| Adversary operations | `adversary.md` | run/replay + artifact handling |

## CONVENTIONS
- Keep commands copy-pastable and aligned with current CLI behavior.
- Every runbook should include purpose, SOP, troubleshooting, and quick commands.
- Document operational caveats (`enforce` vs `monitor`, fail-open semantics, artifact paths).
- Update runbooks whenever command flags or policy semantics change.

## ANTI-PATTERNS
- Do not document commands not present in `packages/mcp/src/cli.ts`.
- Do not leave policy defaults ambiguous in incident procedures.
- Do not add workflow steps that require external SaaS unless explicitly optional.

## QUICK CHECKS
```bash
pnpm build
pnpm test
pnpm --filter @sapper-ai/core run test:smoke
```
