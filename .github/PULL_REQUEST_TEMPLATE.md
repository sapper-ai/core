## Summary

- What changed?
- Why was this change needed?

## Type Of Change

- [ ] feat (new capability)
- [ ] fix (bug or reliability issue)
- [ ] refactor (internal structure, no behavior change)
- [ ] docs (documentation only)
- [ ] ci/chore (build, tooling, or repo operations)

## Scope

- [ ] `@sapper-ai/types`
- [ ] `@sapper-ai/core`
- [ ] `@sapper-ai/mcp`
- [ ] docs/ops
- [ ] ci/workflows

## Security Impact

- Threat model impact:
  - [ ] none
  - [ ] detection rules updated
  - [ ] policy behavior changed
  - [ ] enforcement path changed
  - [ ] threat intel ingestion changed
- New risk if merged incorrectly:

## Verification

Commands run locally:

```bash
pnpm build
pnpm test
pnpm exec tsc -b --noEmit
```

Additional checks (if relevant):

```bash
pnpm --filter @sapper-ai/core run test:smoke
pnpm --filter @sapper-ai/mcp test
```

## Release Notes Draft

- User-facing behavior:
- Breaking changes:
- Migration steps:

## Checklist

- [ ] Tests added/updated for new behavior
- [ ] No type suppression (`as any`, `@ts-ignore`, `@ts-expect-error`)
- [ ] Docs updated (README and/or `docs/ops/*`)
- [ ] CI workflow impact reviewed
- [ ] Changelog entries prepared if user-facing
