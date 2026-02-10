import { describe, expect, it } from 'vitest'

import type { AssessmentContext, Policy } from '@sapper-ai/types'

import { ThreatIntelDetector } from '../../detectors/ThreatIntelDetector'

const policy: Policy = {
  mode: 'enforce',
  defaultAction: 'allow',
  failOpen: true,
}

describe('ThreatIntelDetector', () => {
  it('returns output when intel entry matches tool name', async () => {
    const detector = new ThreatIntelDetector([
      {
        id: 'intel-tool-1',
        type: 'toolName',
        value: 'dangerous_tool',
        reason: 'Known malicious tool',
        severity: 'high',
        source: 'unit-test',
        addedAt: new Date().toISOString(),
      },
    ])

    const context: AssessmentContext = {
      kind: 'pre_tool_call',
      policy,
      toolCall: {
        toolName: 'dangerous_tool',
        arguments: {},
      },
    }

    const output = await detector.run(context)
    expect(output).not.toBeNull()
    expect(output?.risk).toBeGreaterThan(0.9)
  })

  it('returns null when no intel indicator matches', async () => {
    const detector = new ThreatIntelDetector([
      {
        id: 'intel-url-1',
        type: 'urlPattern',
        value: 'evil\\.example',
        reason: 'Known malicious host',
        severity: 'critical',
        source: 'unit-test',
        addedAt: new Date().toISOString(),
      },
    ])

    const context: AssessmentContext = {
      kind: 'pre_tool_call',
      policy,
      toolCall: {
        toolName: 'safe_tool',
        arguments: {
          input: 'hello world',
        },
      },
    }

    const output = await detector.run(context)
    expect(output).toBeNull()
  })
})
