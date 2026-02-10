# @sapperai/core

Core security engine for SapperAI - rules-based threat detection and policy enforcement for AI systems.

## Installation

```bash
pnpm add @sapperai/core
```

## Quick Start

```typescript
import { RulesDetector, DecisionEngine, Guard } from '@sapperai/core'
import type { Policy } from '@sapperai/types'

// 1. Configure policy
const policy: Policy = {
  mode: 'enforce',
  defaultAction: 'allow',
  failOpen: true,
}

// 2. Set up detection pipeline
const detector = new RulesDetector()
const engine = new DecisionEngine([detector])

// 3. Create guard
const guard = new Guard(engine, policy)

// 4. Scan tool calls
const decision = await guard.assessToolCall(
  'executeCommand',
  { command: 'rm -rf /' },
  {}
)

console.log(decision.action) // 'block'
console.log(decision.risk)   // 0.95
console.log(decision.reasons) // ['Detected pattern: rm rf root']
```

## API Summary

### Detectors
- **`RulesDetector`** - Pattern-based threat detection (60+ patterns)
- **`LlmDetector`** - LLM-based detection interface (requires LlmConfig)

### Engine
- **`DecisionEngine`** - Runs detectors and produces final decision
- **`PolicyManager`** - Manages policy configuration and validation
- **`validatePolicy(policy)`** - Validates policy structure with Zod

### Guards
- **`Guard`** - High-level API for tool call/result scanning
- **`Scanner`** - Low-level API for custom assessment contexts

### Audit
- **`AuditLogger`** - Structured logging of security decisions

## Performance

Rules-only pipeline benchmarks (vitest bench):

```
RulesDetector.run - small payload (50 bytes)    737,726 ops/sec  p99: 0.0018ms
DecisionEngine.assess - small payload           391,201 ops/sec  p99: 0.0030ms
```

Run benchmarks:
```bash
pnpm run bench
```

## License

MIT
