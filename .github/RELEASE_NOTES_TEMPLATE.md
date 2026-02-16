## Release Summary

- Short description of this release.
- Primary value to users/operators.

## Highlights

- Feature:
- Security:
- Reliability:
- DX/Docs:

## Package Changes

| Package | Version | Notes |
|---|---:|---|
| `@sapper-ai/types` |  |  |
| `@sapper-ai/core` |  |  |
| `@sapper-ai/mcp` |  |  |

## Notable Security Changes

- Detection patterns:
- Enforcement behavior:
- Threat intel/blocklist behavior:
- Watch/quarantine behavior:
- Adversary tooling behavior:

## Breaking Changes

- [ ] None
- [ ] Yes (describe below)

If breaking, include migration:

```bash
# old

# new
```

## Verification

Release validation commands:

```bash
pnpm build
pnpm test
pnpm exec tsc -b --noEmit
pnpm --filter @sapper-ai/core run test:smoke
```

## Known Limitations

-

## Rollback Plan

1. Revert release PR commit(s).
2. Re-publish fixed version.
3. Communicate impact and remediation.
