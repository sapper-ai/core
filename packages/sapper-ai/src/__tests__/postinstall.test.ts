import { describe, expect, it, vi } from 'vitest'

import pkg from '../../package.json'

import { runPostinstall } from '../postinstall'
import { stripAnsi } from '../utils/format'

describe('postinstall', () => {
  it('prints guidance message', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      runPostinstall()
      const output = stripAnsi(logSpy.mock.calls.map((c) => String(c[0])).join('\n'))
      expect(output).toMatch(/sapper-ai/)
      if (typeof pkg.version === 'string') {
        expect(output).toContain(`v${pkg.version}`)
      }
      expect(output).toMatch(/npx sapper-ai scan/)
    } finally {
      logSpy.mockRestore()
    }
  })

  it('never throws', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    expect(() => runPostinstall()).not.toThrow()
    logSpy.mockRestore()
  })
})
