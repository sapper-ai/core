import { describe, expect, it, vi } from 'vitest'

import type { AssessmentContext, Detector, DetectorOutput, Policy } from '@sapperai/types'

import { DecisionEngine } from '../../engine/DecisionEngine'

const basePolicy: Policy = {
  mode: 'enforce',
  defaultAction: 'allow',
  failOpen: true,
}

function createContext(policy: Policy = basePolicy): AssessmentContext {
  return {
    kind: 'pre_tool_call',
    toolCall: {
      toolName: 'shell',
      arguments: {
        cmd: 'echo hi',
      },
    },
    policy,
  }
}

function createDetector(
  id: string,
  output: DetectorOutput | null,
  options?: { applies?: boolean }
): Detector {
  return {
    id,
    appliesTo: vi.fn(() => options?.applies ?? true),
    run: vi.fn(async () => output),
  }
}

describe('DecisionEngine', () => {
  it('aggregates risk as max and confidence as risk-weighted average', async () => {
    const detectorA = createDetector('a', {
      detectorId: 'a',
      risk: 0.8,
      confidence: 0.9,
      reasons: ['A'],
    })

    const detectorB = createDetector('b', {
      detectorId: 'b',
      risk: 0.4,
      confidence: 0.5,
      reasons: ['B'],
    })

    const engine = new DecisionEngine([detectorA, detectorB])
    const decision = await engine.assess(createContext())

    expect(decision.risk).toBe(0.8)
    expect(decision.confidence).toBeCloseTo((0.8 * 0.9 + 0.4 * 0.5) / (0.8 + 0.4), 4)
    expect(decision.action).toBe('block')
    expect(decision.evidence).toHaveLength(2)
    expect(decision.reasons).toEqual(['A', 'B'])
  })

  it('always allows in monitor mode', async () => {
    const detector = createDetector('rules', {
      detectorId: 'rules',
      risk: 0.95,
      confidence: 0.95,
      reasons: ['high risk'],
    })

    const engine = new DecisionEngine([detector])
    const decision = await engine.assess(
      createContext({
        ...basePolicy,
        mode: 'monitor',
      })
    )

    expect(decision.action).toBe('allow')
    expect(decision.risk).toBe(0.95)
  })

  it('blocks in enforce mode when risk and confidence exceed thresholds', async () => {
    const detector = createDetector('rules', {
      detectorId: 'rules',
      risk: 0.75,
      confidence: 0.7,
      reasons: ['inject prompt'],
    })

    const engine = new DecisionEngine([detector])
    const decision = await engine.assess(createContext())

    expect(decision.action).toBe('block')
  })

  it('allows in enforce mode when confidence is lower than blockMinConfidence', async () => {
    const detector = createDetector('rules', {
      detectorId: 'rules',
      risk: 0.9,
      confidence: 0.8,
      reasons: ['inject prompt'],
    })

    const engine = new DecisionEngine([detector])
    const policyWithThresholds = {
      ...basePolicy,
      thresholds: {
        blockMinConfidence: 0.95,
      },
    } as Policy & {
      thresholds: { blockMinConfidence: number }
    }

    const decision = await engine.assess(createContext(policyWithThresholds))

    expect(decision.action).toBe('allow')
  })

  it('skips detectors that do not apply and ignores null outputs', async () => {
    const skipped = createDetector('skipped', {
      detectorId: 'skipped',
      risk: 1,
      confidence: 1,
      reasons: ['should not run'],
    }, { applies: false })

    const nullDetector = createDetector('null-detector', null)
    const active = createDetector('active', {
      detectorId: 'active',
      risk: 0.2,
      confidence: 0.9,
      reasons: ['low risk'],
    })

    const engine = new DecisionEngine([skipped, nullDetector, active])
    const decision = await engine.assess(createContext())

    expect(vi.mocked(skipped.run)).not.toHaveBeenCalled()
    expect(decision.evidence).toEqual([
      {
        detectorId: 'active',
        risk: 0.2,
        confidence: 0.9,
        reasons: ['low risk'],
      },
    ])
  })

  it('fails open and allows when detector throws and failOpen is true', async () => {
    const faulty: Detector = {
      id: 'faulty',
      appliesTo: vi.fn(() => true),
      run: vi.fn(async () => {
        throw new Error('detector exploded')
      }),
    }

    const engine = new DecisionEngine([faulty])
    const decision = await engine.assess(createContext())

    expect(decision.action).toBe('allow')
    expect(decision.reasons.join(' ')).toContain('detector exploded')
  })

  it('rethrows detector errors when failOpen is false', async () => {
    const faulty: Detector = {
      id: 'faulty',
      appliesTo: vi.fn(() => true),
      run: vi.fn(async () => {
        throw new Error('boom')
      }),
    }

    const engine = new DecisionEngine([faulty])

    await expect(
      engine.assess(
        createContext({
          ...basePolicy,
          failOpen: false,
        })
      )
    ).rejects.toThrow('boom')
  })

  it('runs detectors sequentially and passes prior risk to later detectors', async () => {
    const runOrder: string[] = []

    const first: Detector = {
      id: 'rules',
      appliesTo: () => true,
      run: async () => {
        runOrder.push('rules')
        return {
          detectorId: 'rules',
          risk: 0.88,
          confidence: 0.9,
          reasons: ['rules hit'],
        }
      },
    }

    const second: Detector = {
      id: 'llm',
      appliesTo: (ctx) => {
        const meta = (ctx as AssessmentContext & { meta?: { priorRisk?: number } }).meta
        return (meta?.priorRisk ?? 0) > 0.5
      },
      run: async () => {
        runOrder.push('llm')
        return {
          detectorId: 'llm',
          risk: 0.92,
          confidence: 0.7,
          reasons: ['llm confirmed'],
        }
      },
    }

    const engine = new DecisionEngine([first, second])
    const decision = await engine.assess(createContext())

    expect(runOrder).toEqual(['rules', 'llm'])
    expect(decision.evidence.map((item) => item.detectorId)).toEqual(['rules', 'llm'])
  })
})
