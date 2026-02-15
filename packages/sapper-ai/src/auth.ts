import { homedir } from 'node:os'
import { join } from 'node:path'

import password from '@inquirer/password'

import { atomicWriteFile, readFileIfExists } from './utils/fs'

interface AuthFile {
  openai?: {
    apiKey?: string
    savedAt?: string
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function getAuthPath(): string {
  return join(homedir(), '.sapperai', 'auth.json')
}

export async function loadOpenAiApiKey(options: { env?: NodeJS.ProcessEnv; authPath?: string } = {}): Promise<string | null> {
  const env = options.env ?? process.env
  const fromEnv = env.OPENAI_API_KEY
  if (isNonEmptyString(fromEnv)) {
    return fromEnv.trim()
  }

  const authPath = options.authPath ?? getAuthPath()
  const raw = await readFileIfExists(authPath)
  if (raw === null) return null

  try {
    const parsed = JSON.parse(raw) as AuthFile
    const key = parsed.openai?.apiKey
    return isNonEmptyString(key) ? key.trim() : null
  } catch {
    return null
  }
}

export function maskApiKey(apiKey: string): string {
  const trimmed = apiKey.trim()
  if (trimmed.length <= 3) return '***'
  return `${trimmed.slice(0, 3)}${'█'.repeat(Math.min(24, Math.max(6, trimmed.length - 3)))}`
}

export async function promptAndSaveOpenAiApiKey(options: { authPath?: string; mask?: string } = {}): Promise<string | null> {
  const key = await password({
    message: 'Enter your API key:',
    mask: options.mask ?? '█',
  })

  if (!isNonEmptyString(key)) return null

  const authPath = options.authPath ?? getAuthPath()
  const payload: AuthFile = {
    openai: {
      apiKey: key.trim(),
      savedAt: new Date().toISOString(),
    },
  }

  await atomicWriteFile(authPath, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 })

  // Best-effort: ensure perms even if the file already existed with broader mode.
  // On Windows this is typically a no-op; prefer env vars there.
  try {
    const { chmod } = await import('node:fs/promises')
    await chmod(authPath, 0o600)
  } catch {
  }

  return payload.openai!.apiKey!
}
