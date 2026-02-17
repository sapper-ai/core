import { describe, expect, it, vi } from 'vitest'

async function loadCliWithOpenClawMocks() {
  vi.resetModules()

  const detectOpenClawEnvironment = vi.fn(async () => ({
    installed: true,
    version: '2026.2.8',
    skillsPaths: ['/tmp/openclaw/skills'],
    skillCount: 1,
    dockerAvailable: false,
    dockerComposeAvailable: false,
  }))

  const resolveOpenClawPolicy = vi.fn(() => ({
    mode: 'enforce' as const,
    defaultAction: 'allow' as const,
    failOpen: true,
  }))

  const scanSkills = vi.fn(async () => ({
    results: [
      {
        skillName: 'summarizer',
        skillPath: '/tmp/openclaw/skills/summarizer.md',
        staticResult: {
          risk: 0,
          confidence: 0,
          reasons: [],
        },
        dynamicResult: null,
        decision: 'safe' as const,
      },
    ],
    staticCount: 1,
    suspiciousCount: 0,
    dynamicCount: 0,
    dynamicStatus: 'not_requested' as const,
  }))

  vi.doMock('../../openclaw/detect', () => ({
    detectOpenClawEnvironment,
  }))

  vi.doMock('../../openclaw/scanner', () => ({
    resolveOpenClawPolicy,
    scanSkills,
  }))

  const module = await import('../../cli')

  return {
    runCli: module.runCli,
    detectOpenClawEnvironment,
    resolveOpenClawPolicy,
    scanSkills,
  }
}

describe('openclaw CLI integration', () => {
  it('routes `openclaw` subcommand into OpenClaw scan flow', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      const { runCli, detectOpenClawEnvironment, resolveOpenClawPolicy, scanSkills } = await loadCliWithOpenClawMocks()

      const code = await runCli(['openclaw'])

      expect(code).toBe(0)
      expect(detectOpenClawEnvironment).toHaveBeenCalledTimes(1)
      expect(resolveOpenClawPolicy).toHaveBeenCalledTimes(1)
      expect(scanSkills).toHaveBeenCalledTimes(1)

      expect(scanSkills).toHaveBeenCalledWith(
        ['/tmp/openclaw/skills'],
        expect.objectContaining({ mode: 'enforce' }),
        expect.objectContaining({ dynamicAnalysis: false })
      )
    } finally {
      logSpy.mockRestore()
    }
  })
})
