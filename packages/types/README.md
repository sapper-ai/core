# @sapperai/types

TypeScript type definitions for the SapperAI security framework.

## Installation

```bash
pnpm add @sapperai/types
```

## Usage

Import shared types for building custom detectors, integrations, or policies:

```typescript
import type {
  AssessmentContext,
  Detector,
  DetectorOutput,
  Decision,
  Policy,
  GuardAction,
} from '@sapperai/types'

// Example: Custom detector implementation
export class CustomDetector implements Detector {
  id = 'custom'

  appliesTo(ctx: AssessmentContext): boolean {
    return ctx.kind === 'pre_tool_call'
  }

  async run(ctx: AssessmentContext): Promise<DetectorOutput | null> {
    // Your detection logic
    return {
      detectorId: this.id,
      risk: 0.5,
      confidence: 0.8,
      reasons: ['Detected pattern X'],
    }
  }
}
```

## Exported Types

### Core Types
- **`GuardAction`** - `'allow' | 'block'` - Action to take on tool execution
- **`AssessmentContext`** - Context for security evaluation (tool call, result, policy)
- **`Decision`** - Final security decision with risk score, confidence, and reasons

### Detection Types
- **`Detector`** - Interface for implementing custom threat detectors
- **`DetectorOutput`** - Output from detector runs (risk, confidence, evidence)

### Policy Types
- **`Policy`** - Guard configuration (mode, thresholds, detectors)
- **`ToolPolicy`** - Per-tool policy overrides
- **`LlmConfig`** - LLM provider configuration for LlmDetector

### Audit Types
- **`AuditLogEntry`** - Structured log entry for decision tracking

## License

MIT
