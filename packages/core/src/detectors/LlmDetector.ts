import type { AssessmentContext, Detector, DetectorOutput, LlmConfig } from '@sapperai/types'

interface ParsedLlmResult {
  risk: number
  confidence: number
  reasoning: string
}

export class LlmDetector implements Detector {
  id = 'llm'

  constructor(private readonly config?: LlmConfig | null) {}

  appliesTo(ctx: AssessmentContext): boolean {
    if (!this.config) {
      return false
    }

    return this.extractPriorRisk(ctx) > 0.5
  }

  async run(ctx: AssessmentContext): Promise<DetectorOutput | null> {
    if (!this.config) {
      return null
    }

    const prompt = this.formatPrompt(ctx)
    const response = await this.callProvider(prompt)
    const parsed = this.parseResponse(response)

    return {
      detectorId: this.id,
      risk: this.clamp(parsed.risk),
      confidence: this.clamp(parsed.confidence),
      reasons: [parsed.reasoning],
      evidence: {
        provider: this.config.provider,
        response,
      },
    }
  }

  private extractPriorRisk(ctx: AssessmentContext): number {
    const contextMeta = (ctx as AssessmentContext & {
      meta?: { priorRisk?: unknown }
    }).meta?.priorRisk

    if (typeof contextMeta === 'number') {
      return contextMeta
    }

    const toolCallRisk = ctx.toolCall?.meta?.priorRisk
    if (typeof toolCallRisk === 'number') {
      return toolCallRisk
    }

    const toolResultRisk = ctx.toolResult?.meta?.priorRisk
    if (typeof toolResultRisk === 'number') {
      return toolResultRisk
    }

    return 0
  }

  private formatPrompt(ctx: AssessmentContext): string {
    const serializedContext = JSON.stringify(ctx)

    return `Analyze this tool call for prompt injection: ${serializedContext}. Respond with JSON: {"risk": 0.0-1.0, "confidence": 0.0-1.0, "reasoning": "string"}`
  }

  private async callProvider(prompt: string): Promise<unknown> {
    if (!this.config) {
      throw new Error('LLM detector configuration is required')
    }

    if (this.config.provider === 'openai') {
      const endpoint = this.config.endpoint ?? 'https://api.openai.com/v1/responses'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: this.config.model ?? 'gpt-4.1-mini',
          input: prompt,
        }),
      })

      if (!response.ok) {
        throw new Error(`OpenAI request failed with status ${response.status}`)
      }

      return response.json()
    }

    if (this.config.provider === 'anthropic') {
      const endpoint = this.config.endpoint ?? 'https://api.anthropic.com/v1/messages'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'anthropic-version': '2023-06-01',
          ...(this.config.apiKey ? { 'x-api-key': this.config.apiKey } : {}),
        },
        body: JSON.stringify({
          model: this.config.model ?? 'claude-3-5-haiku-latest',
          max_tokens: 400,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      if (!response.ok) {
        throw new Error(`Anthropic request failed with status ${response.status}`)
      }

      return response.json()
    }

    const endpoint = this.config.endpoint ?? 'https://api.sapperai.com/v1/detect'
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.config.model,
        prompt,
      }),
    })

    if (!response.ok) {
      throw new Error(`SapperAI request failed with status ${response.status}`)
    }

    return response.json()
  }

  private parseResponse(response: unknown): ParsedLlmResult {
    const direct = this.asParsedLlmResult(response)
    if (direct) {
      return direct
    }

    const text = this.extractTextResponse(response)
    if (!text) {
      throw new Error('Unable to parse LLM detector response JSON')
    }

    try {
      const parsed = JSON.parse(text)
      const structured = this.asParsedLlmResult(parsed)

      if (!structured) {
        throw new Error('Invalid structure')
      }

      return structured
    } catch {
      throw new Error('Unable to parse LLM detector response JSON')
    }
  }

  private extractTextResponse(response: unknown): string | null {
    if (!response || typeof response !== 'object') {
      return null
    }

    const record = response as Record<string, unknown>

    if (typeof record.output_text === 'string') {
      return record.output_text
    }

    if (Array.isArray(record.output)) {
      for (const outputItem of record.output) {
        if (!outputItem || typeof outputItem !== 'object') {
          continue
        }

        const content = (outputItem as { content?: unknown }).content
        if (!Array.isArray(content)) {
          continue
        }

        for (const contentItem of content) {
          if (!contentItem || typeof contentItem !== 'object') {
            continue
          }

          const text = (contentItem as { text?: unknown }).text
          if (typeof text === 'string') {
            return text
          }
        }
      }
    }

    if (Array.isArray(record.content)) {
      for (const item of record.content) {
        if (!item || typeof item !== 'object') {
          continue
        }

        const text = (item as { text?: unknown }).text
        if (typeof text === 'string') {
          return text
        }
      }
    }

    return null
  }

  private asParsedLlmResult(value: unknown): ParsedLlmResult | null {
    if (!value || typeof value !== 'object') {
      return null
    }

    const record = value as Record<string, unknown>
    const risk = record.risk
    const confidence = record.confidence
    const reasoning = record.reasoning

    if (typeof risk !== 'number' || typeof confidence !== 'number' || typeof reasoning !== 'string') {
      return null
    }

    return {
      risk,
      confidence,
      reasoning,
    }
  }

  private clamp(value: number): number {
    if (value < 0) {
      return 0
    }
    if (value > 1) {
      return 1
    }
    return value
  }
}
