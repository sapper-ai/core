# SapperAI Operations Runbooks

This directory contains operator-focused runbooks for production workflows.

## Contents

- `watch-quarantine.md`: Real-time file monitoring and quarantine operations.
- `threat-intel.md`: Threat feed and blocklist lifecycle operations.
- `adversary.md`: Adversary campaign execution and replay workflows.

## Standard Validation Commands

```bash
pnpm build
pnpm test
pnpm exec tsc -b --noEmit
pnpm --filter @sapper-ai/core run test:smoke
```

## Incident-Response Defaults

1. Confirm current policy mode (`enforce` vs `monitor`).
2. Preserve artifacts (`trace.jsonl`, `summary.json`, `proposals.json`).
3. Validate expected block decisions in audit logs.
4. Use quarantine restore only with documented justification.
