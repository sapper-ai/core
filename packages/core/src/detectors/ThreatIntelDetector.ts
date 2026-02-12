import type { AssessmentContext, Detector, DetectorOutput } from '@sapper-ai/types'

import type { ThreatIntelEntry } from '../intel/ThreatIntelStore'
import { safeRegExp } from '../utils/safeRegExp'

function contextText(ctx: AssessmentContext): string {
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

  if (ctx.meta) {
    chunks.push(JSON.stringify(ctx.meta))
  }

  return chunks.join('\n').toLowerCase()
}

function hasMatch(entry: ThreatIntelEntry, text: string, toolName: string | undefined): boolean {

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
    const text = contextText(ctx)
    const toolName = ctx.toolCall?.toolName?.toLowerCase()
    const matched = this.entries.filter((entry) => hasMatch(entry, text, toolName))
    if (matched.length === 0) {
      return null
    }

    const severityScores: Record<string, number> = { critical: 1, high: 0.95, medium: 0.85, low: 0.75 }
    const maxSeverity = Math.max(...matched.map((e) => severityScores[e.severity] ?? 0.75))

    return {
      detectorId: this.id,
      risk: maxSeverity,
      confidence: 0.99,
      reasons: matched.slice(0, 5).map((entry) => `Threat intel match: ${entry.id} (${entry.reason})`),
      evidence: matched,
    }
  }
}
