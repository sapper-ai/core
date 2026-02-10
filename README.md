# SapperAI

Lightweight, rules-based security framework for AI systems. Detect and block prompt injection, command injection, and other threats in real-time.

## Motivation

AI agents with tool-calling capabilities face critical security risks:
- **Prompt injection**: Malicious instructions in user input override system behavior
- **Command injection**: Dangerous commands executed through tools (rm -rf, SQL injection, etc.)
- **Data exfiltration**: Secrets leaked through tool arguments or LLM outputs

SapperAI provides **zero-dependency threat detection** with:
- ✅ **96% detection rate** (48/50 malicious samples blocked)
- ✅ **Zero false positives** (0/100 benign samples blocked)
- ✅ **Sub-millisecond latency** (p99: 0.0018ms for rules-only)
- ✅ **Fail-open design** (availability over security)

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        SapperAI Stack                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  @sapperai/types (11 types, no deps)                        │
│      │                                                       │
│      └─► @sapperai/core (60+ rules, policy engine)          │
│              │                                               │
│              ├─► @sapperai/mcp (stdio proxy + CLI)          │
│              │                                               │
│              └─► @sapperai/openai (Agents SDK guardrails)   │
│                                                              │
└──────────────────────────────────────────────────────────────┘

Detection Pipeline:
  ToolCall → RulesDetector → DecisionEngine → Guard → Block/Allow
```

## Packages

| Package | Description | Use Case |
|---------|-------------|----------|
| **[@sapperai/types](./packages/types)** | TypeScript type definitions | Custom detectors, integrations |
| **[@sapperai/core](./packages/core)** | Core detection engine (RulesDetector, DecisionEngine, Guard) | Direct integration |
| **[@sapperai/mcp](./packages/mcp)** | MCP security proxy | Wrap any MCP server |
| **[@sapperai/openai](./packages/openai)** | OpenAI Agents SDK guardrails | Drop-in for @openai/agents |

## Quick Start

### Option 1: MCP Proxy (No Code)

```bash
pnpm add @sapperai/mcp

# Wrap any MCP server
sapperai-proxy --target "npx @modelcontextprotocol/server-example"
```

### Option 2: OpenAI Agents Integration

```typescript
import { createToolInputGuardrail } from '@sapperai/openai'
import { RulesDetector, DecisionEngine } from '@sapperai/core'
import { Agent } from '@openai/agents'

const detector = new RulesDetector()
const engine = new DecisionEngine([detector])
const inputGuardrail = createToolInputGuardrail(engine, {
  mode: 'enforce',
  defaultAction: 'allow',
  failOpen: true,
})

const agent = new Agent({
  model: 'gpt-4',
  tools: [myTool],
  inputGuardrail,
})
```

### Option 3: Direct Integration

```typescript
import { Guard, RulesDetector, DecisionEngine } from '@sapperai/core'

const detector = new RulesDetector()
const engine = new DecisionEngine([detector])
const guard = new Guard(engine, { mode: 'enforce', defaultAction: 'allow', failOpen: true })

const decision = await guard.assessToolCall('executeCommand', { command: 'rm -rf /' }, {})
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

## Installation

```bash
# Full monorepo (for development)
git clone https://github.com/sapperai/sapperai.git
cd sapperai
pnpm install
pnpm build

# Individual packages (for usage)
pnpm add @sapperai/core
pnpm add @sapperai/mcp
pnpm add @sapperai/openai
```

## Development

```bash
# Build all packages
pnpm build

# Run tests (90 tests across 4 packages)
pnpm test

# Type checking
pnpm exec tsc -b --noEmit

# Benchmarks
pnpm --filter @sapperai/core run bench
```

## Verified Metrics (MVP)

- **Test Coverage**: 90 tests (19 types + 50 core + 11 mcp + 10 openai)
- **Detection Rate**: 96% (48/50 malicious samples)
- **False Positives**: 0% (0/100 benign samples)
- **Edge Cases**: 0% false positives (0/20 edge case samples)
- **Latency**: p99 < 10ms (Rules-only)

## License

MIT
