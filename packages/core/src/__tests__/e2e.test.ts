import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import type { Policy } from '@sapperai/types'

import { DecisionEngine, RulesDetector } from '../index'

interface Fixture {
  kind: 'pre_tool_call' | 'post_tool_result'
  toolCall: {
    toolName: string
    arguments: unknown
  }
  toolResult?: {
    content: unknown
    meta?: Record<string, unknown>
  }
  expected: 'allow' | 'block'
  label: string
}

function loadFixtures(filename: string): Fixture[] {
  const fixturePath = join(__dirname, '../../test-fixtures', filename)

  return readFileSync(fixturePath, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Fixture)
}

describe('Core E2E: Fixture-based Pipeline', () => {
  const policy: Policy = { mode: 'enforce', defaultAction: 'allow', failOpen: true }
  const engine = new DecisionEngine([new RulesDetector()])

  it('benign-100: zero false positives', async () => {
    const fixtures = loadFixtures('benign-100.jsonl')
    let blocked = 0

    for (const fixture of fixtures) {
      const decision = await engine.assess({
        kind: fixture.kind,
        toolCall: fixture.toolCall,
        toolResult: fixture.toolResult,
        policy,
      })

      if (decision.action === 'block') {
        blocked += 1
      }
    }

    expect(blocked).toBe(0)
  })

  it('malicious-50: >=80% detection rate', async () => {
    const fixtures = loadFixtures('malicious-50.jsonl')
    let blocked = 0

    for (const fixture of fixtures) {
      const decision = await engine.assess({
        kind: fixture.kind,
        toolCall: fixture.toolCall,
        toolResult: fixture.toolResult,
        policy,
      })

      if (decision.action === 'block') {
        blocked += 1
      }
    }

    const detectionRate = blocked / fixtures.length
    expect(detectionRate).toBeGreaterThanOrEqual(0.8)
  })

  it('edge-cases-20: zero false positives for allow fixtures', async () => {
    const fixtures = loadFixtures('edge-cases-20.jsonl')
    let blocked = 0

    for (const fixture of fixtures) {
      if (fixture.expected !== 'allow') {
        continue
      }

      const decision = await engine.assess({
        kind: fixture.kind,
        toolCall: fixture.toolCall,
        toolResult: fixture.toolResult,
        policy,
      })

      if (decision.action === 'block') {
        blocked += 1
      }
    }

    expect(blocked).toBe(0)
  })
})
