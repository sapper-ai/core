import { bench, describe } from 'vitest'
import { RulesDetector } from '../src/detectors/RulesDetector'
import { DecisionEngine } from '../src/engine/DecisionEngine'
import type { AssessmentContext, Policy } from '@sapperai/types'

describe('Rules-only Pipeline Benchmark', () => {
  const detector = new RulesDetector()
  const engine = new DecisionEngine([detector])
  const policy: Policy = {
    mode: 'enforce',
    failOpen: true,
  }

  const smallPayload: AssessmentContext = {
    toolCall: {
      name: 'search',
      arguments: { query: 'test query' },
      meta: {},
    },
    policy,
  }

  const mediumPayload: AssessmentContext = {
    toolCall: {
      name: 'getData',
      arguments: {
        query: 'fetch user data',
        filters: { status: 'active', limit: 100 },
        options: { includeMetadata: true },
      },
      meta: { requestId: 'req-12345', timestamp: '2026-02-10T00:00:00Z' },
    },
    policy,
  }

  const largePayload: AssessmentContext = {
    toolCall: {
      name: 'processDocument',
      arguments: {
        document: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(20),
        config: {
          parseMode: 'strict',
          includeMetadata: true,
          filters: ['content', 'metadata', 'structure'],
          options: {
            validateSchema: true,
            extractKeywords: true,
            generateSummary: true,
          },
        },
      },
      meta: {
        userId: 'user-789',
        sessionId: 'session-abc',
        requestId: 'req-xyz',
        timestamp: '2026-02-10T00:00:00Z',
      },
    },
    policy,
  }

  bench('RulesDetector.run - small payload (50 bytes)', async () => {
    await detector.run(smallPayload)
  })

  bench('RulesDetector.run - medium payload (500 bytes)', async () => {
    await detector.run(mediumPayload)
  })

  bench('RulesDetector.run - large payload (5000 bytes)', async () => {
    await detector.run(largePayload)
  })

  bench('DecisionEngine.assess - small payload (50 bytes)', async () => {
    await engine.assess(smallPayload)
  })

  bench('DecisionEngine.assess - medium payload (500 bytes)', async () => {
    await engine.assess(mediumPayload)
  })

  bench('DecisionEngine.assess - large payload (5000 bytes)', async () => {
    await engine.assess(largePayload)
  })
})
