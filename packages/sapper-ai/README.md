# sapper-ai

Single-install AI security guardrails for tool-calling systems.

## Quick start

```bash
pnpm add sapper-ai
npx sapper-ai init
```

```ts
import { createGuard } from 'sapper-ai'

const guard = createGuard()
const decision = await guard.check({ toolName: 'shell', arguments: { cmd: 'ls' } })
```

## Presets

| Preset | Description |
|---|---|
| monitor | Monitor only - logs threats but never blocks |
| standard | Balanced protection with sensible defaults |
| strict | Strict enforcement with lower thresholds |
| paranoid | Maximum security - aggressive blocking, fail closed, LLM analysis |
| ci | CI/CD pipeline - deterministic, fail closed, no LLM |
| development | Development mode - permissive, monitor only |

More details: https://github.com/sapper-ai/core#readme
