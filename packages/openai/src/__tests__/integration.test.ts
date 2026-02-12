import { describe, expect, it } from 'vitest'
import type { Policy } from '@sapper-ai/types'
import { performance } from 'node:perf_hooks'

import {
  createSapperInputGuardrail,
  createSapperToolInputGuardrail,
  createSapperToolOutputGuardrail,
} from '../guardrails'

const policy: Policy = {
  mode: 'enforce',
  defaultAction: 'allow',
  failOpen: true,
}

function makeFunctionCallItem(name: string, args: unknown, callId: string) {
  return {
    type: 'function_call' as const,
    callId,
    name,
    arguments: typeof args === 'string' ? args : JSON.stringify(args),
  }
}

describe('OpenAI adapter integration edge cases', () => {
  it('allows empty / null-ish tool arguments', async () => {
    const guardrail = createSapperToolInputGuardrail('integration-tool-input', policy)
    type RunInput = Parameters<typeof guardrail.run>[0]
    const context = {} as unknown as RunInput['context']
    const agent = {} as unknown as RunInput['agent']

    const emptyArgs = await guardrail.run({
      context,
      agent,
      toolCall: {
        type: 'function_call' as const,
        callId: 'call_empty',
        name: 'noop',
        arguments: '',
      },
    })
    expect(emptyArgs.behavior.type).toBe('allow')

    const nullArgsJson = await guardrail.run({
      context,
      agent,
      toolCall: {
        type: 'function_call' as const,
        callId: 'call_null',
        name: 'noop',
        arguments: 'null',
      },
    })
    expect(nullArgsJson.behavior.type).toBe('allow')
  })

  it('handles malformed JSON arguments without crashing (allow)', async () => {
    const guardrail = createSapperToolInputGuardrail('integration-tool-input', policy)
    type RunInput = Parameters<typeof guardrail.run>[0]
    const context = {} as unknown as RunInput['context']
    const agent = {} as unknown as RunInput['agent']

    const result = await guardrail.run({
      context,
      agent,
      toolCall: {
        type: 'function_call' as const,
        callId: 'call_malformed',
        name: 'test_tool',
        arguments: '{not valid json',
      },
    })

    expect(result.behavior.type).toBe('allow')
    expect(result.outputInfo).toMatchObject({
      risk: expect.any(Number),
      confidence: expect.any(Number),
      reasons: expect.any(Array),
      evidence: expect.any(Array),
    })
  })

  it('supports very large payloads (>10KB) without error', async () => {
    const guardrail = createSapperToolInputGuardrail('integration-tool-input', policy)
    type RunInput = Parameters<typeof guardrail.run>[0]
    const context = {} as unknown as RunInput['context']
    const agent = {} as unknown as RunInput['agent']

    const largeText = 'a'.repeat(12 * 1024)
    const result = await guardrail.run({
      context,
      agent,
      toolCall: makeFunctionCallItem(
        'upload',
        {
          filename: 'payload.txt',
          content: largeText,
        },
        'call_large',
      ),
    })

    expect(result.behavior.type).toBe('allow')
    expect(result.outputInfo.evidence).toBeDefined()
  })

  it('resolves concurrent guardrail evaluations (10x) reliably', async () => {
    const guardrail = createSapperToolInputGuardrail('integration-tool-input', policy)
    type RunInput = Parameters<typeof guardrail.run>[0]
    const context = {} as unknown as RunInput['context']
    const agent = {} as unknown as RunInput['agent']

    const results = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        guardrail.run({
          context,
          agent,
          toolCall: makeFunctionCallItem(
            'read_file',
            {
              path: `/tmp/test-${index}.txt`,
            },
            `call_concurrent_${index}`,
          ),
        }),
      ),
    )

    expect(results).toHaveLength(10)
    for (const result of results) {
      expect(result.behavior.type).toBe('allow')
    }
  })

  it('completes a single evaluation in < 50ms', async () => {
    const guardrail = createSapperToolInputGuardrail('integration-tool-input', policy)
    type RunInput = Parameters<typeof guardrail.run>[0]
    const context = {} as unknown as RunInput['context']
    const agent = {} as unknown as RunInput['agent']
    const startedAt = performance.now()

    const result = await guardrail.run({
      context,
      agent,
      toolCall: makeFunctionCallItem('search', { query: 'hello world' }, 'call_perf'),
    })

    const durationMs = performance.now() - startedAt
    expect(result.behavior.type).toBe('allow')
    expect(durationMs).toBeLessThan(50)
  })

  it('always includes decision metadata in outputInfo for all SDK guardrails', async () => {
    const inputGuardrail = createSapperInputGuardrail('integration-input', policy)
    const toolInputGuardrail = createSapperToolInputGuardrail('integration-tool-input', policy)
    const toolOutputGuardrail = createSapperToolOutputGuardrail('integration-tool-output', policy)

    type InputExecute = Parameters<typeof inputGuardrail.execute>[0]
    const inputAgent = {} as unknown as InputExecute['agent']
    const inputContext = {} as unknown as InputExecute['context']

    type ToolInputRun = Parameters<typeof toolInputGuardrail.run>[0]
    const toolInputAgent = {} as unknown as ToolInputRun['agent']
    const toolInputContext = {} as unknown as ToolInputRun['context']

    type ToolOutputRun = Parameters<typeof toolOutputGuardrail.run>[0]
    const toolOutputAgent = {} as unknown as ToolOutputRun['agent']
    const toolOutputContext = {} as unknown as ToolOutputRun['context']

    const inputResult = await inputGuardrail.execute({
      agent: inputAgent,
      input: 'Schedule a meeting for next week',
      context: inputContext,
    })

    expect(inputResult.outputInfo).toMatchObject({
      risk: expect.any(Number),
      confidence: expect.any(Number),
      reasons: expect.any(Array),
      evidence: expect.any(Array),
    })

    const toolInputResult = await toolInputGuardrail.run({
      context: toolInputContext,
      agent: toolInputAgent,
      toolCall: makeFunctionCallItem('calendar.create', { title: 'demo', date: '2026-02-20' }, 'call_meta_in'),
    })

    expect(toolInputResult.outputInfo).toMatchObject({
      risk: expect.any(Number),
      confidence: expect.any(Number),
      reasons: expect.any(Array),
      evidence: expect.any(Array),
    })

    const toolOutputResult = await toolOutputGuardrail.run({
      context: toolOutputContext,
      agent: toolOutputAgent,
      toolCall: makeFunctionCallItem('calendar.create', { title: 'demo', date: '2026-02-20' }, 'call_meta_out'),
      output: 'Created.',
    })

    expect(toolOutputResult.outputInfo).toMatchObject({
      risk: expect.any(Number),
      confidence: expect.any(Number),
      reasons: expect.any(Array),
      evidence: expect.any(Array),
    })
  })
})
