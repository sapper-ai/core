import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import pkg from '../../package.json'

import { runPostinstall } from '../postinstall'
import { stripAnsi } from '../utils/format'

describe('postinstall', () => {
  it('creates ~/.sapper-ai and prints explicit setup guidance', () => {
    const previousHome = process.env.HOME
    const home = mkdtempSync(join(tmpdir(), 'sapper-ai-postinstall-home-'))
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      process.env.HOME = home
      runPostinstall()

      const sapperHome = join(home, '.sapper-ai')
      expect(existsSync(sapperHome)).toBe(true)
      expect(statSync(sapperHome).isDirectory()).toBe(true)
      expect(existsSync(join(home, '.claude'))).toBe(false)

      const output = stripAnsi(logSpy.mock.calls.map((c) => String(c[0])).join('\n'))
      expect(output).toMatch(/sapper-ai/)
      if (typeof pkg.version === 'string') {
        expect(output).toContain(`v${pkg.version}`)
      }
      expect(output).toContain('SapperAI 설치 완료. Skill Guard 활성화: sapper-ai setup')
      expect(output).not.toMatch(/npx sapper-ai scan/)
    } finally {
      process.env.HOME = previousHome
      rmSync(home, { recursive: true, force: true })
      logSpy.mockRestore()
    }
  })

  it('never throws outward on setup/logging failure', () => {
    const previousHome = process.env.HOME
    const tmp = mkdtempSync(join(tmpdir(), 'sapper-ai-postinstall-failure-'))
    const fakeHomeFile = join(tmp, 'not-a-directory')
    writeFileSync(fakeHomeFile, 'x', 'utf8')
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    try {
      process.env.HOME = fakeHomeFile
      expect(() => runPostinstall()).not.toThrow()
    } finally {
      process.env.HOME = previousHome
      rmSync(tmp, { recursive: true, force: true })
      logSpy.mockRestore()
    }
  })
})
