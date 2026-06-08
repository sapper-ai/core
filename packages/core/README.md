# @sapper-ai/core

Core security engine for SapperAI - rules-based threat detection and policy enforcement for AI systems.

## Installation

```bash
pnpm add @sapper-ai/core
```

## Quick Start

```typescript
import { AuditLogger, DecisionEngine, Guard, RulesDetector } from '@sapper-ai/core'
import type { Policy } from '@sapper-ai/types'

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
const auditLogger = new AuditLogger()
const guard = new Guard(engine, auditLogger, policy)

// 4. Scan tool calls before execution
const decision = await guard.preTool({
  toolName: 'executeCommand',
  arguments: { command: 'rm -rf /' },
})

console.log(decision.action) // 'block'
console.log(decision.risk)   // 0.95
console.log(decision.reasons) // ['Detected pattern: rm rf root']
```

## API Summary

### Detectors
- **`RulesDetector`** - Pattern-based threat detection (50+ rules)
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

## Verification

The rules-only pipeline is designed to stay dependency-light and easy to test. Run the package checks before changing detector or policy behavior:

```bash
pnpm test
pnpm run test:smoke
pnpm run bench
```

## License

MIT
