import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  SESSION_START_COMMAND,
  USER_PROMPT_SUBMIT_COMMAND,
  getStatus,
  registerHooks,
  removeHooks,
} from '../../guard/setup'

function createHome(withClaudeDir: boolean = true): string {
  const homeDir = mkdtempSync(join(tmpdir(), 'sapper-ai-setup-'))
  if (withClaudeDir) {
    mkdirSync(join(homeDir, '.claude'), { recursive: true })
  }
  return homeDir
}

function settingsPathFor(homeDir: string): string {
  return join(homeDir, '.claude', 'settings.json')
}

function readSettings(homeDir: string): Record<string, unknown> {
  return JSON.parse(readFileSync(settingsPathFor(homeDir), 'utf8')) as Record<string, unknown>
}

describe('guard setup registration', () => {
  const homesToClean: string[] = []

  afterEach(() => {
    for (const homeDir of homesToClean) {
      rmSync(homeDir, { recursive: true, force: true })
    }
    homesToClean.length = 0
  })

  it('registers SessionStart/UserPromptSubmit hooks into settings.json', () => {
    const homeDir = createHome(true)
    homesToClean.push(homeDir)

    const result = registerHooks({ homeDir })

    expect(result.ok).toBe(true)
    expect(result.action).toBe('registered')
    expect(result.changed).toBe(true)
    expect(result.added).toEqual(['SessionStart', 'UserPromptSubmit'])
    expect(result.status.fullyRegistered).toBe(true)
    expect(result.status.settingsExists).toBe(true)

    const settings = readSettings(homeDir)
    const hooks = settings.hooks as Record<string, unknown>
    const sessionStart = hooks.SessionStart as Array<Record<string, unknown>>
    const userPromptSubmit = hooks.UserPromptSubmit as Array<Record<string, unknown>>

    expect(sessionStart).toHaveLength(1)
    expect((sessionStart[0]!.hooks as Array<Record<string, unknown>>)[0]).toMatchObject({
      type: 'command',
      command: SESSION_START_COMMAND,
      timeout: 30,
    })
    expect(userPromptSubmit).toHaveLength(1)
    expect((userPromptSubmit[0]!.hooks as Array<Record<string, unknown>>)[0]).toMatchObject({
      type: 'command',
      command: USER_PROMPT_SUBMIT_COMMAND,
      timeout: 5,
    })

    const tmpFiles = readdirSync(join(homeDir, '.claude')).filter((file) => file.includes('.tmp-'))
    expect(tmpFiles).toEqual([])
  })

  it('appends managed hooks and preserves existing hooks', () => {
    const homeDir = createHome(true)
    homesToClean.push(homeDir)

    writeFileSync(
      settingsPathFor(homeDir),
      JSON.stringify(
        {
          hooks: {
            SessionStart: [
              {
                matcher: 'existing-scope',
                hooks: [{ type: 'command', command: 'echo existing session', timeout: 1 }],
              },
            ],
            UserPromptSubmit: [
              {
                matcher: 'existing-scope',
                hooks: [{ type: 'command', command: 'echo existing prompt', timeout: 1 }],
              },
            ],
          },
        },
        null,
        2
      ),
      'utf8'
    )

    const result = registerHooks({ homeDir })
    expect(result.action).toBe('registered')
    expect(result.status.fullyRegistered).toBe(true)

    const settings = readSettings(homeDir)
    const hooks = settings.hooks as Record<string, unknown>
    const sessionStart = hooks.SessionStart as Array<Record<string, unknown>>
    const userPromptSubmit = hooks.UserPromptSubmit as Array<Record<string, unknown>>

    expect(sessionStart).toHaveLength(2)
    expect((sessionStart[0]!.hooks as Array<Record<string, unknown>>)[0]).toMatchObject({
      command: 'echo existing session',
    })
    expect(
      sessionStart.some(
        (entry) =>
          Array.isArray(entry.hooks) &&
          (entry.hooks as Array<Record<string, unknown>>).some((hook) => hook.command === SESSION_START_COMMAND)
      )
    ).toBe(true)

    expect(userPromptSubmit).toHaveLength(2)
    expect((userPromptSubmit[0]!.hooks as Array<Record<string, unknown>>)[0]).toMatchObject({
      command: 'echo existing prompt',
    })
    expect(
      userPromptSubmit.some(
        (entry) =>
          Array.isArray(entry.hooks) &&
          (entry.hooks as Array<Record<string, unknown>>).some(
            (hook) => hook.command === USER_PROMPT_SUBMIT_COMMAND
          )
      )
    ).toBe(true)
  })

  it('detects already-registered hooks and does not rewrite settings', () => {
    const homeDir = createHome(true)
    homesToClean.push(homeDir)

    const first = registerHooks({ homeDir })
    expect(first.action).toBe('registered')

    const before = readFileSync(settingsPathFor(homeDir), 'utf8')
    const second = registerHooks({ homeDir })
    const after = readFileSync(settingsPathFor(homeDir), 'utf8')

    expect(second.ok).toBe(true)
    expect(second.action).toBe('already_registered')
    expect(second.changed).toBe(false)
    expect(second.added).toEqual([])
    expect(after).toBe(before)
  })

  it('removes only sapper-ai managed hooks and preserves other hooks', () => {
    const homeDir = createHome(true)
    homesToClean.push(homeDir)

    writeFileSync(
      settingsPathFor(homeDir),
      JSON.stringify(
        {
          hooks: {
            SessionStart: [
              {
                matcher: '*',
                hooks: [
                  { type: 'command', command: SESSION_START_COMMAND, timeout: 30 },
                  { type: 'command', command: 'echo keep-session', timeout: 1 },
                ],
              },
              {
                matcher: '*',
                hooks: [{ type: 'command', command: 'echo keep-session-2', timeout: 1 }],
              },
            ],
            UserPromptSubmit: [
              {
                matcher: '*',
                hooks: [{ type: 'command', command: USER_PROMPT_SUBMIT_COMMAND, timeout: 5 }],
              },
              {
                matcher: '*',
                hooks: [{ type: 'command', command: 'echo keep-prompt', timeout: 1 }],
              },
            ],
          },
        },
        null,
        2
      ),
      'utf8'
    )

    const result = removeHooks({ homeDir })

    expect(result.ok).toBe(true)
    expect(result.action).toBe('removed')
    expect(result.changed).toBe(true)
    expect(result.removedCount).toBe(2)
    expect(result.removedByEvent).toEqual({
      SessionStart: 1,
      UserPromptSubmit: 1,
    })
    expect(result.status.fullyRegistered).toBe(false)

    const settings = readSettings(homeDir)
    const hooks = settings.hooks as Record<string, unknown>
    const sessionStart = hooks.SessionStart as Array<Record<string, unknown>>
    const userPromptSubmit = hooks.UserPromptSubmit as Array<Record<string, unknown>>

    expect(sessionStart).toHaveLength(2)
    expect((sessionStart[0]!.hooks as Array<Record<string, unknown>>)).toEqual([
      { type: 'command', command: 'echo keep-session', timeout: 1 },
    ])
    expect(userPromptSubmit).toHaveLength(1)
    expect((userPromptSubmit[0]!.hooks as Array<Record<string, unknown>>)).toEqual([
      { type: 'command', command: 'echo keep-prompt', timeout: 1 },
    ])
  })

  it('returns missing_claude_dir when ~/.claude is missing', () => {
    const homeDir = createHome(false)
    homesToClean.push(homeDir)

    const status = getStatus({ homeDir })
    expect(status.claudeDirExists).toBe(false)
    expect(status.settingsExists).toBe(false)
    expect(status.fullyRegistered).toBe(false)

    const registerResult = registerHooks({ homeDir })
    expect(registerResult.ok).toBe(false)
    expect(registerResult.action).toBe('missing_claude_dir')
    expect(registerResult.status.claudeDirExists).toBe(false)

    const removeResult = removeHooks({ homeDir })
    expect(removeResult.ok).toBe(false)
    expect(removeResult.action).toBe('missing_claude_dir')
    expect(removeResult.removedCount).toBe(0)
  })

  it('status reports partially-registered state', () => {
    const homeDir = createHome(true)
    homesToClean.push(homeDir)

    writeFileSync(
      settingsPathFor(homeDir),
      JSON.stringify(
        {
          hooks: {
            SessionStart: [
              {
                matcher: '*',
                hooks: [{ type: 'command', command: SESSION_START_COMMAND, timeout: 30 }],
              },
            ],
          },
        },
        null,
        2
      ),
      'utf8'
    )

    const status = getStatus({ homeDir })
    expect(status.claudeDirExists).toBe(true)
    expect(status.settingsExists).toBe(true)
    expect(status.fullyRegistered).toBe(false)
    expect(status.commands.find((entry) => entry.event === 'SessionStart')?.registered).toBe(true)
    expect(status.commands.find((entry) => entry.event === 'UserPromptSubmit')?.registered).toBe(false)
  })
})
