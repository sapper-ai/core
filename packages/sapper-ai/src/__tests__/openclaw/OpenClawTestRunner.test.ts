import { describe, expect, it, vi } from 'vitest'

import type { DockerCommandRunResult, DockerCommandRunner } from '../../openclaw/docker/DockerSandbox'
import { OpenClawTestRunner, OPENCLAW_TEST_SCENARIOS } from '../../openclaw/docker/OpenClawTestRunner'

function ok(stdout = ''): DockerCommandRunResult {
  return {
    ok: true,
    exitCode: 0,
    stdout,
    stderr: '',
    timedOut: false,
  }
}

function fail(stderr: string, timedOut = false, exitCode: number | null = 1): DockerCommandRunResult {
  return {
    ok: false,
    exitCode,
    stdout: '',
    stderr,
    timedOut,
  }
}

describe('openclaw/docker/OpenClawTestRunner', () => {
  it('executes all eight scenarios via docker exec and collects tool calls', async () => {
    const commandRunner = vi.fn<DockerCommandRunner>(async (_command, args) => {
      const scenario = args[args.length - 1] ?? ''

      if (scenario.includes('configuration')) {
        return ok('Calling tool read_config\nassistant: here is your configuration')
      }

      if (scenario.includes('tools do you have')) {
        return ok('tool_calls: list_tools, run_tool\nassistant: listed tools')
      }

      return ok('assistant: completed')
    })

    const runner = new OpenClawTestRunner({ commandRunner })
    const result = await runner.run('openclaw-container-id')

    expect(result.scenarioResults).toHaveLength(OPENCLAW_TEST_SCENARIOS.length)
    expect(commandRunner).toHaveBeenCalledTimes(OPENCLAW_TEST_SCENARIOS.length)

    const configScenario = result.scenarioResults.find((entry) => entry.scenario.includes('configuration'))
    expect(configScenario?.toolCalls).toContain('read_config')

    const toolsScenario = result.scenarioResults.find((entry) => entry.scenario.includes('tools do you have'))
    expect(toolsScenario?.toolCalls).toContain('list_tools')
    expect(toolsScenario?.toolCalls).toContain('run_tool')
  })

  it('captures per-scenario command failures and timeout errors', async () => {
    const scenarios = ['first scenario', 'second scenario']
    const commandRunner = vi.fn<DockerCommandRunner>(async (_command, args) => {
      const scenario = args[args.length - 1] ?? ''

      if (scenario === 'first scenario') {
        return fail('', true, null)
      }

      return fail('Calling tool exfiltrate_data\npermission denied')
    })

    const runner = new OpenClawTestRunner({
      commandRunner,
      scenarios,
      scenarioTimeoutMs: 1234,
    })

    const result = await runner.run('openclaw-container-id')
    expect(result.scenarioResults).toHaveLength(2)

    expect(result.scenarioResults[0]?.error).toContain('timed out after 1234ms')
    expect(result.scenarioResults[1]?.error).toContain('permission denied')
    expect(result.scenarioResults[1]?.toolCalls).toContain('exfiltrate_data')
  })

  it('throws when container id is empty', async () => {
    const runner = new OpenClawTestRunner({
      commandRunner: vi.fn<DockerCommandRunner>(async () => ok()),
    })

    await expect(runner.run('  ')).rejects.toThrow('container id is required')
  })
})
