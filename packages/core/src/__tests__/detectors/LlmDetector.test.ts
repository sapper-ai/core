import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssessmentContext, LlmConfig, Policy } from '@sapperai/types'

import { LlmDetector } from '../../detectors/LlmDetector'

const basePolicy: Policy = {
  mode: 'enforce',
  defaultAction: 'allow',
  failOpen: true,
}

const openAiConfig: LlmConfig = {
  provider: 'openai',
  apiKey: 'test-key',
  model: 'gpt-4.1-mini',
}

function createContext(priorRisk: number): AssessmentContext & { meta: { priorRisk: number } } {
  return {
    kind: 'pre_tool_call',
    toolCall: {
      toolName: 'shell',
      arguments: {
        cmd: 'print environment variables',
      },
    },
    policy: basePolicy,
    meta: {
      priorRisk,
    },
  }
}

describe('LlmDetector', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('is disabled when llm config is not provided', () => {
    const detector = new LlmDetector(undefined)

    expect(detector.appliesTo(createContext(0.9))).toBe(false)
  })

  it('applies only when prior detector risk is higher than 0.5', () => {
    const detector = new LlmDetector(openAiConfig)

    expect(detector.appliesTo(createContext(0.3))).toBe(false)
    expect(detector.appliesTo(createContext(0.5))).toBe(false)
    expect(detector.appliesTo(createContext(0.7))).toBe(true)
  })

  it('calls OpenAI endpoint and parses detector output', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        output: [
          {
            content: [
              {
                type: 'output_text',
                text: '{"risk":0.81,"confidence":0.72,"reasoning":"Likely prompt injection"}',
              },
            ],
          },
        ],
      }),
    } as Response)

    const detector = new LlmDetector(openAiConfig)
    const ctx = createContext(0.9)

    const result = await detector.run(ctx)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, request] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/v1/responses')
    expect(request?.method).toBe('POST')
    const body = String(request?.body)
    expect(body).toContain('Analyze this tool call for prompt injection')

    expect(result).toEqual({
      detectorId: 'llm',
      risk: 0.81,
      confidence: 0.72,
      reasons: ['Likely prompt injection'],
      evidence: expect.any(Object),
    })
  })

  it('calls Anthropic endpoint when provider is anthropic', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          {
            type: 'text',
            text: '{"risk":0.64,"confidence":0.66,"reasoning":"Suspicious instruction override"}',
          },
        ],
      }),
    } as Response)

    const detector = new LlmDetector({
      provider: 'anthropic',
      apiKey: 'anthropic-key',
      model: 'claude-3-5-haiku-latest',
    })

    const result = await detector.run(createContext(0.8))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toContain('/v1/messages')
    expect(result).toEqual({
      detectorId: 'llm',
      risk: 0.64,
      confidence: 0.66,
      reasons: ['Suspicious instruction override'],
      evidence: expect.any(Object),
    })
  })

  it('supports sapperai endpoint and direct JSON response', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        risk: 0.77,
        confidence: 0.88,
        reasoning: 'Matched attack profile',
      }),
    } as Response)

    const detector = new LlmDetector({
      provider: 'sapperai',
      endpoint: 'https://api.sapperai.dev/v1/detect',
      model: 'sapperai-guard-v1',
    })

    const result = await detector.run(createContext(0.9))

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.sapperai.dev/v1/detect')
    expect(result).toEqual({
      detectorId: 'llm',
      risk: 0.77,
      confidence: 0.88,
      reasons: ['Matched attack profile'],
      evidence: expect.any(Object),
    })
  })

  it('throws when response does not contain parseable JSON payload', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        output: [
          {
            content: [
              {
                type: 'output_text',
                text: 'not-json',
              },
            ],
          },
        ],
      }),
    } as Response)

    const detector = new LlmDetector(openAiConfig)

    await expect(detector.run(createContext(0.9))).rejects.toThrow(
      /Unable to parse LLM detector response JSON/
    )
  })
})
