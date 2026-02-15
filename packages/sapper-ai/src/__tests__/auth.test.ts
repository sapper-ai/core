import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

async function loadAuthWithHomedir(home: string) {
  vi.resetModules()

  vi.doMock('node:os', async () => {
    const actual = await vi.importActual<typeof import('node:os')>('node:os')
    return { ...actual, homedir: () => home }
  })

  return import('../auth')
}

describe('auth', () => {
  it('loadOpenAiApiKey prefers env var over auth.json', async () => {
    const home = join(tmpdir(), `sapper-ai-auth-env-${Date.now()}`)
    mkdirSync(home, { recursive: true })

    const original = process.env.OPENAI_API_KEY
    process.env.OPENAI_API_KEY = 'sk-env'

    try {
      const authDir = join(home, '.sapperai')
      mkdirSync(authDir, { recursive: true })
      writeFileSync(
        join(authDir, 'auth.json'),
        JSON.stringify({ openai: { apiKey: 'sk-file', savedAt: new Date().toISOString() } }, null, 2),
        'utf8'
      )

      const { loadOpenAiApiKey } = await loadAuthWithHomedir(home)
      await expect(loadOpenAiApiKey()).resolves.toBe('sk-env')
    } finally {
      process.env.OPENAI_API_KEY = original
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('loadOpenAiApiKey falls back to auth.json', async () => {
    const home = join(tmpdir(), `sapper-ai-auth-file-${Date.now()}`)
    mkdirSync(home, { recursive: true })

    const original = process.env.OPENAI_API_KEY
    delete process.env.OPENAI_API_KEY

    try {
      const authDir = join(home, '.sapperai')
      mkdirSync(authDir, { recursive: true })
      writeFileSync(
        join(authDir, 'auth.json'),
        JSON.stringify({ openai: { apiKey: 'sk-file', savedAt: new Date().toISOString() } }, null, 2),
        'utf8'
      )

      const { loadOpenAiApiKey } = await loadAuthWithHomedir(home)
      await expect(loadOpenAiApiKey()).resolves.toBe('sk-file')
    } finally {
      process.env.OPENAI_API_KEY = original
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('promptAndSaveOpenAiApiKey writes auth.json with restrictive permissions', async () => {
    const home = join(tmpdir(), `sapper-ai-auth-prompt-${Date.now()}`)
    mkdirSync(home, { recursive: true })

    const original = process.env.OPENAI_API_KEY
    delete process.env.OPENAI_API_KEY

    try {
      vi.resetModules()
      vi.doMock('@inquirer/password', () => {
        return { default: async () => 'sk-test' }
      })
      vi.doMock('node:os', async () => {
        const actual = await vi.importActual<typeof import('node:os')>('node:os')
        return { ...actual, homedir: () => home }
      })

      const auth = await import('../auth')
      const key = await auth.promptAndSaveOpenAiApiKey()
      expect(key).toBe('sk-test')

      const authPath = auth.getAuthPath()
      const raw = readFileSync(authPath, 'utf8')
      const parsed = JSON.parse(raw) as { openai?: { apiKey?: string; savedAt?: string } }
      expect(parsed.openai?.apiKey).toBe('sk-test')
      expect(typeof parsed.openai?.savedAt).toBe('string')

      if (process.platform !== 'win32') {
        const mode = statSync(authPath).mode & 0o777
        expect(mode).toBe(0o600)
      }
    } finally {
      process.env.OPENAI_API_KEY = original
      rmSync(home, { recursive: true, force: true })
    }
  })
})
