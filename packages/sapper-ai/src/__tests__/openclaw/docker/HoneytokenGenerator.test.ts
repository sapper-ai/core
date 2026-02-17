import { describe, expect, it } from 'vitest'

import { generateHoneytokens } from '../../../openclaw/docker/HoneytokenGenerator'

const DISALLOWED_WORDS = ['canary', 'test', 'fake', 'dummy', 'example']

describe('openclaw/docker/HoneytokenGenerator', () => {
  it('generates deterministic output for the same seed', () => {
    const first = generateHoneytokens({ seed: 'scan-seed-2026' })
    const second = generateHoneytokens({ seed: 'scan-seed-2026' })
    const third = generateHoneytokens({ seed: 'scan-seed-2027' })

    expect(first).toEqual(second)
    expect(third).not.toEqual(first)
  })

  it('embeds unique 16-char search patterns and avoids disallowed marker words in values', () => {
    const result = generateHoneytokens({ seed: 'quality-check' })
    const patterns = result.honeytokens.map((token) => token.searchPattern)

    expect(result.honeytokens.length).toBeGreaterThanOrEqual(5)
    expect(new Set(patterns).size).toBe(result.honeytokens.length)

    for (const token of result.honeytokens) {
      expect(token.searchPattern).toHaveLength(16)
      expect(token.value.includes(token.searchPattern)).toBe(true)

      const lowered = token.value.toLowerCase()
      for (const disallowed of DISALLOWED_WORDS) {
        expect(lowered.includes(disallowed)).toBe(false)
      }

      expect(result.envVars[token.envVar]).toBe(token.value)
    }
  })

  it('returns realistic credential formats and file payloads', () => {
    const result = generateHoneytokens({ seed: 'format-check' })
    const env = result.envVars

    expect(env.OPENAI_API_KEY).toMatch(/^sk-proj-[A-Za-z0-9]{48}$/)
    expect(env.AWS_ACCESS_KEY_ID).toMatch(/^AKIA[A-Z0-9]{16}$/)
    expect(env.AWS_SECRET_ACCESS_KEY).toMatch(/^[A-Za-z0-9/+=]{40}$/)
    expect(env.GITHUB_TOKEN).toMatch(/^ghp_[A-Za-z0-9]{36}$/)

    expect(env.DB_PASSWORD.length).toBeGreaterThanOrEqual(12)
    expect(env.DB_PASSWORD.length).toBeLessThanOrEqual(20)
    expect(/[A-Z]/.test(env.DB_PASSWORD)).toBe(true)
    expect(/[a-z]/.test(env.DB_PASSWORD)).toBe(true)
    expect(/[0-9]/.test(env.DB_PASSWORD)).toBe(true)
    expect(/[!@#$%^&*()_\-+=\[\]{}:;,.?/]/.test(env.DB_PASSWORD)).toBe(true)

    expect(env.SSH_PRIVATE_KEY.startsWith('-----BEGIN OPENSSH PRIVATE KEY-----\n')).toBe(true)
    expect(env.SSH_PRIVATE_KEY.endsWith('\n-----END OPENSSH PRIVATE KEY-----')).toBe(true)

    const sshFile = result.files.find((file) => file.path === '/home/users/.ssh/id_ed25519')
    const envFile = result.files.find((file) => file.path === '/home/users/.env')

    expect(sshFile?.content).toBe(env.SSH_PRIVATE_KEY)
    expect(envFile?.content).toContain(`OPENAI_API_KEY=${env.OPENAI_API_KEY}`)
    expect(envFile?.content).toContain(`AWS_ACCESS_KEY_ID=${env.AWS_ACCESS_KEY_ID}`)
    expect(envFile?.content).toContain(`GITHUB_TOKEN=${env.GITHUB_TOKEN}`)
  })
})
