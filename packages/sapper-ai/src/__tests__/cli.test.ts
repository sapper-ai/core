import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { PolicyManager } from '@sapper-ai/core'

function defaultSetupStatus() {
  return {
    claudeDirPath: '/tmp/.claude',
    settingsPath: '/tmp/.claude/settings.json',
    claudeDirExists: true,
    settingsExists: true,
    fullyRegistered: true,
    commands: [],
  }
}

async function loadCliWithAnswers(
  answers: string[],
  options?: {
    setupMock?: {
      registerHooks?: () => unknown
      removeHooks?: () => unknown
      getStatus?: () => unknown
    }
    guardLoader?: (modulePath: string) => Promise<Record<string, unknown>>
  }
) {
  vi.resetModules()

  vi.doMock('node:readline', () => {
    return {
      createInterface: () => {
        return {
          question: (_q: string, cb: (answer: string) => void) => {
            cb(answers.shift() ?? '')
          },
          close: () => {},
        }
      },
    }
  })

  if (options?.setupMock) {
    const registerHooks =
      options.setupMock.registerHooks ??
      vi.fn(() => ({
        ok: true,
        action: 'registered',
        changed: true,
        added: ['SessionStart', 'UserPromptSubmit'],
        status: defaultSetupStatus(),
      }))
    const removeHooks =
      options.setupMock.removeHooks ??
      vi.fn(() => ({
        ok: true,
        action: 'removed',
        changed: true,
        removedCount: 2,
        removedByEvent: { SessionStart: 1, UserPromptSubmit: 1 },
        status: defaultSetupStatus(),
      }))
    const getStatus = options.setupMock.getStatus ?? vi.fn(() => defaultSetupStatus())

    vi.doMock('../guard/setup', () => ({
      registerHooks,
      removeHooks,
      getStatus,
    }))
  } else {
    vi.doUnmock('../guard/setup')
  }

  const module = await import('../cli')
  if (options?.guardLoader) {
    module.__setGuardModuleLoaderForTests(options.guardLoader)
  }

  return module
}

describe('sapper-ai cli', () => {
  it('--help prints usage and returns exit code 0', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      const { runCli } = await loadCliWithAnswers([])
      const code = await runCli(['--help'])
      expect(code).toBe(0)
      const output = logSpy.mock.calls.map((c) => String(c[0])).join('\n')
      expect(output).toMatch(/Usage:/)
      expect(output).toMatch(/sapper-ai init/)
    } finally {
      logSpy.mockRestore()
    }
  })

  it('no args returns exit code 1', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      const { runCli } = await loadCliWithAnswers([])
      const code = await runCli([])
      expect(code).toBe(1)
      const output = logSpy.mock.calls.map((c) => String(c[0])).join('\n')
      expect(output).toMatch(/Usage:/)
    } finally {
      logSpy.mockRestore()
    }
  })

  it('init generates sapperai.config.yaml and it loads via PolicyManager', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sapper-ai-cli-'))
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir)
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      const { runCli } = await loadCliWithAnswers(['2', ''])
      const code = await runCli(['init'])
      expect(code).toBe(0)

      const yamlPath = join(dir, 'sapperai.config.yaml')
      const yaml = readFileSync(yamlPath, 'utf8')
      expect(yaml).toMatch(/mode: enforce/)
      expect(yaml).toMatch(/defaultAction: allow/)

      const policy = new PolicyManager().loadFromFile(yamlPath)
      expect(policy.mode).toBe('enforce')
    } finally {
      logSpy.mockRestore()
      cwdSpy.mockRestore()
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('init overwrite prompt abort does not modify file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sapper-ai-cli-overwrite-'))
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir)
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      const yamlPath = join(dir, 'sapperai.config.yaml')
      const original = 'mode: enforce\ndefaultAction: allow\nfailOpen: true\n'
      writeFileSync(yamlPath, original, 'utf8')

      const { runCli } = await loadCliWithAnswers(['2', '', 'n'])
      const code = await runCli(['init'])
      expect(code).toBe(0)
      const after = readFileSync(yamlPath, 'utf8')
      expect(after).toBe(original)
    } finally {
      logSpy.mockRestore()
      cwdSpy.mockRestore()
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('selected preset values appear in generated YAML', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sapper-ai-cli-preset-'))
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(dir)
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      const { runCli } = await loadCliWithAnswers(['3', ''])
      const code = await runCli(['init'])
      expect(code).toBe(0)

      const yamlPath = join(dir, 'sapperai.config.yaml')
      const yaml = readFileSync(yamlPath, 'utf8')
      expect(yaml).toMatch(/riskThreshold: 0.5/)
      expect(yaml).toMatch(/blockMinConfidence: 0.3/)
    } finally {
      logSpy.mockRestore()
      cwdSpy.mockRestore()
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('sapper-ai cli setup command', () => {
  it('routes `setup` to registerHooks()', async () => {
    const registerHooks = vi.fn(() => ({
      ok: true,
      action: 'registered',
      changed: true,
      added: ['SessionStart', 'UserPromptSubmit'],
      status: defaultSetupStatus(),
    }))
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      const { runCli } = await loadCliWithAnswers([], {
        setupMock: {
          registerHooks,
        },
      })

      const code = await runCli(['setup'])
      expect(code).toBe(0)
      expect(registerHooks).toHaveBeenCalledTimes(1)
    } finally {
      logSpy.mockRestore()
    }
  })

  it('routes `setup --remove` to removeHooks()', async () => {
    const removeHooks = vi.fn(() => ({
      ok: true,
      action: 'removed',
      changed: true,
      removedCount: 2,
      removedByEvent: { SessionStart: 1, UserPromptSubmit: 1 },
      status: defaultSetupStatus(),
    }))
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      const { runCli } = await loadCliWithAnswers([], {
        setupMock: {
          removeHooks,
        },
      })

      const code = await runCli(['setup', '--remove'])
      expect(code).toBe(0)
      expect(removeHooks).toHaveBeenCalledTimes(1)
    } finally {
      logSpy.mockRestore()
    }
  })

  it('routes `setup --status` to getStatus()', async () => {
    const getStatus = vi.fn(() => defaultSetupStatus())
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      const { runCli } = await loadCliWithAnswers([], {
        setupMock: {
          getStatus,
        },
      })

      const code = await runCli(['setup', '--status'])
      expect(code).toBe(0)
      expect(getStatus).toHaveBeenCalledTimes(1)
    } finally {
      logSpy.mockRestore()
    }
  })
})

describe('sapper-ai cli guard command', () => {
  it('routes `guard scan` and `guard check` to hook handlers', async () => {
    const guardScan = vi.fn(async () => 0)
    const guardCheck = vi.fn(async () => ({ exitCode: 0 }))
    const guardLoader = vi.fn(async (modulePath: string) => {
      if (modulePath === 'hooks/guardScan') return { guardScan }
      if (modulePath === 'hooks/guardCheck') return { guardCheck }
      throw new Error(`Unknown module: ${modulePath}`)
    })
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      const { runCli } = await loadCliWithAnswers([], { guardLoader })
      const scanCode = await runCli(['guard', 'scan'])
      const checkCode = await runCli(['guard', 'check'])

      expect(scanCode).toBe(0)
      expect(checkCode).toBe(0)
      expect(guardScan).toHaveBeenCalledTimes(1)
      expect(guardCheck).toHaveBeenCalledTimes(1)
    } finally {
      logSpy.mockRestore()
    }
  })

  it('routes `guard dismiss <name>` to WarningStore.dismiss()', async () => {
    const dismiss = vi.fn(async () => undefined)

    class WarningStore {
      dismiss(name: string): Promise<void> {
        return dismiss(name)
      }
    }

    const guardLoader = vi.fn(async (modulePath: string) => {
      if (modulePath === 'WarningStore') return { WarningStore }
      throw new Error(`Unknown module: ${modulePath}`)
    })
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      const { runCli } = await loadCliWithAnswers([], { guardLoader })
      const code = await runCli(['guard', 'dismiss', 'suspicious-skill'])
      expect(code).toBe(0)
      expect(dismiss).toHaveBeenCalledWith('suspicious-skill')
    } finally {
      logSpy.mockRestore()
    }
  })

  it('routes `guard rescan` to ScanCache.clear() then guard scan hook', async () => {
    const clear = vi.fn(async () => undefined)
    const guardScan = vi.fn(async () => 0)

    class ScanCache {
      clear(): Promise<void> {
        return clear()
      }
    }

    const guardLoader = vi.fn(async (modulePath: string) => {
      if (modulePath === 'ScanCache') return { ScanCache }
      if (modulePath === 'hooks/guardScan') return { guardScan }
      throw new Error(`Unknown module: ${modulePath}`)
    })
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      const { runCli } = await loadCliWithAnswers([], { guardLoader })
      const code = await runCli(['guard', 'rescan'])
      expect(code).toBe(0)
      expect(clear).toHaveBeenCalledTimes(1)
      expect(guardScan).toHaveBeenCalledTimes(1)
    } finally {
      logSpy.mockRestore()
    }
  })

  it('routes `guard cache list` and `guard cache clear` to ScanCache methods', async () => {
    const list = vi.fn(async () => [{ skillName: 'alpha', path: '/tmp/alpha.md', contentHash: 'abcd' }])
    const clear = vi.fn(async () => undefined)

    class ScanCache {
      list(): Promise<Array<Record<string, string>>> {
        return list()
      }

      clear(): Promise<void> {
        return clear()
      }
    }

    const guardLoader = vi.fn(async (modulePath: string) => {
      if (modulePath === 'ScanCache') return { ScanCache }
      throw new Error(`Unknown module: ${modulePath}`)
    })
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      const { runCli } = await loadCliWithAnswers([], { guardLoader })
      const listCode = await runCli(['guard', 'cache', 'list'])
      const clearCode = await runCli(['guard', 'cache', 'clear'])
      expect(listCode).toBe(0)
      expect(clearCode).toBe(0)
      expect(list).toHaveBeenCalledTimes(1)
      expect(clear).toHaveBeenCalledTimes(1)
    } finally {
      logSpy.mockRestore()
    }
  })
})
