import type { AssessmentContext, Decision, Detector, DetectorOutput, Policy } from '@sapper-ai/types'

interface ThresholdConfig {
  riskThreshold: number
  blockMinConfidence: number
}

export class DecisionEngine {
  constructor(private readonly detectors: Detector[]) {}

  async assess(ctx: AssessmentContext): Promise<Decision> {
    const outputs: DetectorOutput[] = []
    const failOpenReasons: string[] = []

    for (const detector of this.detectors) {
      const contextForDetector = this.withPriorRisk(ctx, outputs)

      if (!detector.appliesTo(contextForDetector)) {
        continue
      }

      try {
        const output = await detector.run(contextForDetector)
        if (output) {
          outputs.push(output)
        }
      } catch (error) {
        if (!ctx.policy.failOpen) {
          throw error
        }

        const errorMessage = error instanceof Error ? error.message : String(error)
        failOpenReasons.push(`Detector ${detector.id} error: ${errorMessage}`)
        continue
      }
    }

    const decision = this.buildDecision(ctx.policy, outputs)

    if (failOpenReasons.length > 0) {
      return {
        ...decision,
        action: 'allow',
        reasons: [...decision.reasons, ...failOpenReasons],
      }
    }

    return decision
  }

  private withPriorRisk(ctx: AssessmentContext, outputs: DetectorOutput[]): AssessmentContext {
    const existingMeta = (ctx as AssessmentContext & { meta?: Record<string, unknown> }).meta ?? {}
    const priorRisk = this.aggregateRisk(outputs)

    return {
      ...ctx,
      meta: {
        ...existingMeta,
        priorRisk,
      },
    } as AssessmentContext
  }

  private buildDecision(policy: Policy, outputs: DetectorOutput[]): Decision {
    const aggregateRisk = this.aggregateRisk(outputs)
    const aggregateConfidence = this.aggregateConfidence(outputs)
    const reasons = outputs.flatMap((output) => output.reasons)
    const thresholds = this.getThresholds(policy)

    const action = this.resolveAction(policy, aggregateRisk, aggregateConfidence, thresholds)

    return {
      action,
      risk: aggregateRisk,
      confidence: aggregateConfidence,
      reasons,
      evidence: outputs,
    }
  }

  private aggregateRisk(outputs: DetectorOutput[]): number {
    return outputs.reduce((maxRisk, output) => Math.max(maxRisk, output.risk), 0)
  }

  private aggregateConfidence(outputs: DetectorOutput[]): number {
    if (outputs.length === 0) {
      return 0
    }

    const weightedConfidence = outputs.reduce((sum, output) => sum + output.confidence * output.risk, 0)
    const totalWeight = outputs.reduce((sum, output) => sum + output.risk, 0)

    if (totalWeight === 0) {
      return outputs.reduce((sum, output) => sum + output.confidence, 0) / outputs.length
    }

    return weightedConfidence / totalWeight
  }

  private resolveAction(
    policy: Policy,
    aggregateRisk: number,
    aggregateConfidence: number,
    thresholds: ThresholdConfig
  ): 'allow' | 'block' {
    if (policy.mode === 'monitor') {
      return 'allow'
    }

    if (
      aggregateRisk >= thresholds.riskThreshold &&
      aggregateConfidence >= thresholds.blockMinConfidence
    ) {
      return 'block'
    }

    return 'allow'
  }

  private getThresholds(policy: Policy): ThresholdConfig {
    const extendedPolicy = policy as Policy & {
      thresholds?: {
        riskThreshold?: unknown
        blockMinConfidence?: unknown
      }
    }

    const riskThreshold =
      typeof extendedPolicy.thresholds?.riskThreshold === 'number'
        ? extendedPolicy.thresholds.riskThreshold
        : 0.7
    const blockMinConfidence =
      typeof extendedPolicy.thresholds?.blockMinConfidence === 'number'
        ? extendedPolicy.thresholds.blockMinConfidence
        : 0.5

    return {
      riskThreshold,
      blockMinConfidence,
    }
  }
}
