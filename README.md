# SapperAI

Lightweight, rules-based security framework for AI systems. Detect and block prompt injection, command injection, and other threats in real-time.

AI agents with tool-calling capabilities face critical security risks:
- **Prompt injection**: Malicious instructions in user input override system behavior
- **Command injection**: Dangerous commands executed through tools (rm -rf, SQL injection, etc.)
- **Data exfiltration**: Secrets leaked through tool arguments or LLM outputs

SapperAI provides **zero-dependency threat detection** with:
- ✅ **96% detection rate** (48/50 malicious samples blocked)
- ✅ **Zero false positives** (0/100 benign samples blocked)
- ✅ **Sub-millisecond latency** (p99: 0.0018ms for rules-only)
- ✅ **Fail-open design** (availability over security)

## Quick Start

```bash
npm install sapper-ai
# or
pnpm install sapper-ai
```

```ts
import { createGuard } from 'sapper-ai'

const guard = createGuard()
const decision = await guard.check({ toolName: 'shell', arguments: { cmd: 'ls' } })
```

## CLI: Scan -> Harden (Recommended)

```bash
# 1) Scan your repo (interactive in a TTY)
npx sapper-ai scan

# 2) If you skipped prompts, you can harden explicitly:
npx sapper-ai harden --apply

# 3) To include system-level protection (writes to your home directory):
npx sapper-ai harden --apply --include-system
```

CI-friendly scan (deterministic, no prompts):

```bash
npx -y sapper-ai@0.6.0 scan --policy ./sapperai.config.yaml --no-prompt --no-open --no-save
```

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        SapperAI Stack                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  @sapper-ai/types (11 types, no deps)                        │
│      │                                                       │
│      └─► @sapper-ai/core (60+ rules, policy engine)          │
│              │                                               │
│              ├─► @sapper-ai/mcp (stdio proxy + CLI)          │
│              │                                               │
│                                                              │
└──────────────────────────────────────────────────────────────┘

Detection Pipeline:
  ToolCall → RulesDetector → DecisionEngine → Guard → Block/Allow
```

## Packages

| Package | Description | Use Case |
|---------|-------------|----------|
| **[sapper-ai](./packages/sapper-ai)** | Single-install wrapper (createGuard + presets + CLI) | Default entry point |
| **[@sapper-ai/types](./packages/types)** | TypeScript type definitions | Custom detectors, integrations |
| **[@sapper-ai/core](./packages/core)** | Core detection engine (RulesDetector, DecisionEngine, Guard) | Direct integration |
| **[@sapper-ai/mcp](./packages/mcp)** | MCP security proxy | Wrap any MCP server |

## Direct Integration (Advanced)

```ts
import { AuditLogger, DecisionEngine, Guard, RulesDetector } from '@sapper-ai/core'
import type { Policy } from '@sapper-ai/types'

const policy: Policy = {
  mode: 'enforce',
  defaultAction: 'allow',
  failOpen: true,
}

const detector = new RulesDetector()
const engine = new DecisionEngine([detector])
const auditLogger = new AuditLogger()
const guard = new Guard(engine, auditLogger, policy)

const decision = await guard.preTool({
  toolName: 'executeCommand',
  arguments: { command: 'rm -rf /' },
})

if (decision.action === 'block') {
  throw new Error(`Blocked: ${decision.reasons.join(', ')}`)
}
```

## Detection Capabilities

### Threat Categories (60+ Patterns)
- **Prompt Injection**: "ignore previous", "system prompt", "jailbreak", "bypass"
- **Command Injection**: `rm -rf /`, SQL injection (`' OR '1'='1`), XXE
- **Path Traversal**: `../`, `/etc/passwd`, `/etc/shadow`
- **Data Exfiltration**: API keys, secrets, `process.env`
- **Code Injection**: `eval()`, `__import__()`, `system()`, template injection

### Educational Context Suppression
False positive reduction for documentation/tutorials containing security keywords.

## Performance

Benchmark results (Rules-only pipeline, vitest bench):

```
RulesDetector.run - small (50B)     737,726 ops/sec  p99: 0.0018ms
DecisionEngine.assess - small       391,201 ops/sec  p99: 0.0030ms
DecisionEngine.assess - large (5KB)  30,785 ops/sec  p99: 0.0424ms
```

## Verified Metrics (MVP)

- **Test Coverage**: 80 tests (19 types + 50 core + 11 mcp)
- **Detection Rate**: 96% (48/50 malicious samples)
- **False Positives**: 0% (0/100 benign samples)
- **Edge Cases**: 0% false positives (0/20 edge case samples)
- **Latency**: p99 < 10ms (Rules-only)

## Installation

```bash
# Full monorepo (for development)
git clone https://github.com/sapper-ai/sapperai.git
cd sapperai
pnpm install
pnpm build
```

## Development

```bash
# Build all packages
pnpm build

# Run tests (80 tests across 3 packages)
pnpm test

# Run deterministic security smoke tests
pnpm --filter @sapper-ai/core run test:smoke

# Type checking
pnpm exec tsc -b --noEmit

# Benchmarks
pnpm --filter @sapper-ai/core run bench
```

## Operations Docs

- Runbook index: `docs/ops/README.md`
- Watch + quarantine: `docs/ops/watch-quarantine.md`
- Threat intel + blocklist: `docs/ops/threat-intel.md`
- Adversary campaigns: `docs/ops/adversary.md`

## License

MIT
