# @sapperai/openai

OpenAI Agents SDK integration for SapperAI - drop-in tool input/output guardrails.

## Installation

```bash
pnpm add @sapperai/openai
```

## Quick Start

```typescript
import { createToolInputGuardrail, createToolOutputGuardrail } from '@sapperai/openai'
import { RulesDetector, DecisionEngine } from '@sapperai/core'
import { Agent } from '@openai/agents'

// 1. Set up detection pipeline
const detector = new RulesDetector()
const engine = new DecisionEngine([detector])

// 2. Create guardrails
const inputGuardrail = createToolInputGuardrail(engine, {
  mode: 'enforce',
  defaultAction: 'allow',
  failOpen: true,
})

const outputGuardrail = createToolOutputGuardrail(engine, {
  mode: 'monitor',
  defaultAction: 'allow',
  failOpen: true,
})

// 3. Attach to OpenAI Agent
const agent = new Agent({
  model: 'gpt-4',
  tools: [myTool],
  inputGuardrail,
  outputGuardrail,
})

// Tool calls are now automatically scanned
const response = await agent.run('Execute command: rm -rf /')
```

## API Summary

- **`createToolInputGuardrail(engine, policy)`** - Creates input guardrail for OpenAI Agents
- **`createToolOutputGuardrail(engine, policy)`** - Creates output guardrail for OpenAI Agents

Both functions return guardrail functions compatible with `@openai/agents` SDK.

## How It Works

1. **Input Guardrail**: Scans tool arguments before execution
2. **Output Guardrail**: Scans tool results before returning to LLM
3. **Action**: Blocks malicious calls in `enforce` mode, logs in `monitor` mode
4. **Fail-Open**: On detector errors, allows execution to maintain availability

## License

MIT
