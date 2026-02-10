import type { AssessmentContext, Decision, Detector, Policy } from '@sapperai/types'

import { DecisionEngine } from '../engine/DecisionEngine'

export class Scanner {
  async scanTool(
    toolName: string,
    description: string,
    policy: Policy,
    detectors: Detector[]
  ): Promise<Decision> {
    const engine = new DecisionEngine(detectors)

    const ctx = {
      kind: 'install_scan',
      policy,
      meta: {
        toolName,
        scanText: description,
      },
    } as AssessmentContext

    return engine.assess(ctx)
  }
}
