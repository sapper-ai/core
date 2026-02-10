export type FindingOutcome = 'blocked' | 'allowed'

export interface FindingScoreInput {
  outcome: FindingOutcome
  risk: number
  confidence: number
  reproductionRate: number
  impact: 'low' | 'medium' | 'high' | 'critical'
}

export interface FindingScore {
  severity10: number
  exposure10: number
}

function impactWeight(impact: FindingScoreInput['impact']): number {
  if (impact === 'critical') {
    return 1
  }

  if (impact === 'high') {
    return 0.8
  }

  if (impact === 'medium') {
    return 0.55
  }

  return 0.3
}

function clamp10(value: number): number {
  return Math.max(0, Math.min(10, Number(value.toFixed(2))))
}

export class FindingScorer {
  score(input: FindingScoreInput): FindingScore {
    const severityBase = (input.risk * 0.5 + input.confidence * 0.3 + impactWeight(input.impact) * 0.2) * 10
    const severity10 = clamp10(severityBase * input.reproductionRate)
    const mitigationFactor = input.outcome === 'blocked' ? 0.35 : 1

    return {
      severity10,
      exposure10: clamp10(severity10 * mitigationFactor),
    }
  }
}
