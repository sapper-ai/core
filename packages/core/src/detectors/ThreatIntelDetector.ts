import type { AssessmentContext, Detector, DetectorOutput } from '@sapper-ai/types'

import type { ThreatIntelEntry } from '../intel/ThreatIntelStore'

function safeRegExp(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, 'i')
  } catch {
    return null
  }
}

function contextText(ctx: AssessmentContext): string {
  const ctxWithMeta = ctx as AssessmentContext & { meta?: Record<string, unknown> }
  const chunks: string[] = []
  if (ctx.toolCall) {
    chunks.push(JSON.stringify(ctx.toolCall.arguments ?? {}))
    if (ctx.toolCall.meta) {
      chunks.push(JSON.stringify(ctx.toolCall.meta))
    }
  }

  if (ctx.toolResult) {
    chunks.push(JSON.stringify(ctx.toolResult.content ?? {}))
    if (ctx.toolResult.meta) {
      chunks.push(JSON.stringify(ctx.toolResult.meta))
    }
  }

  if (ctxWithMeta.meta) {
    chunks.push(JSON.stringify(ctxWithMeta.meta))
  }

  return chunks.join('\n').toLowerCase()
}

function hasMatch(entry: ThreatIntelEntry, ctx: AssessmentContext): boolean {
  const toolName = ctx.toolCall?.toolName?.toLowerCase()
  const text = contextText(ctx)

  if (entry.type === 'toolName') {
    return toolName === entry.value.toLowerCase()
  }

  if (entry.type === 'packageName') {
    return text.includes(entry.value.toLowerCase())
  }

  if (entry.type === 'sha256') {
    return text.includes(entry.value.toLowerCase())
  }

  if (entry.type === 'urlPattern' || entry.type === 'contentPattern') {
    const regex = safeRegExp(entry.value)
    return regex ? regex.test(text) : false
  }

  return false
}

export class ThreatIntelDetector implements Detector {
  readonly id = 'threat-intel'
  private readonly entries: ThreatIntelEntry[]

  constructor(entries: ThreatIntelEntry[]) {
    this.entries = entries
  }

  appliesTo(): boolean {
    return this.entries.length > 0
  }

  async run(ctx: AssessmentContext): Promise<DetectorOutput | null> {
    const matched = this.entries.filter((entry) => hasMatch(entry, ctx))
    if (matched.length === 0) {
      return null
    }

    const maxSeverity = matched.some((entry) => entry.severity === 'critical')
      ? 1
      : matched.some((entry) => entry.severity === 'high')
        ? 0.95
        : matched.some((entry) => entry.severity === 'medium')
          ? 0.85
          : 0.75

    return {
      detectorId: this.id,
      risk: maxSeverity,
      confidence: 0.99,
      reasons: matched.slice(0, 5).map((entry) => `Threat intel match: ${entry.id} (${entry.reason})`),
      evidence: matched,
    }
  }
}
