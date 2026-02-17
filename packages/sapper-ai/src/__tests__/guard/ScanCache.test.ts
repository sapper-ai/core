import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { ScanCache } from '../../guard/ScanCache'

function createFixture(): { dir: string; filePath: string; keyPath: string } {
  const dir = mkdtempSync(join(tmpdir(), 'sapper-ai-scan-cache-'))
  const filePath = join(dir, 'scan-cache.json')
  const keyPath = join(dir, 'hmac-key')
  return { dir, filePath, keyPath }
}

describe('guard/ScanCache', () => {
  it('supports has/get/set/list/clear and defaults to empty when file is missing', async () => {
    const fixture = createFixture()

    try {
      const cache = new ScanCache({
        filePath: fixture.filePath,
        homeDir: fixture.dir,
        keyPath: fixture.keyPath,
        hostName: 'host-a',
        userId: '1000',
      })

      expect(await cache.has('abc')).toBe(false)
      expect(await cache.get('abc')).toBeNull()
      expect(await cache.list()).toEqual([])

      await cache.set('abc', {
        path: '/tmp/skill.md',
        skillName: 'skill-a',
        decision: 'safe',
        risk: 0.1,
        reasons: [],
        scannedAt: '2026-02-17T00:00:00.000Z',
      })

      expect(await cache.has('abc')).toBe(true)
      expect(await cache.get('abc')).toMatchObject({
        skillName: 'skill-a',
        decision: 'safe',
      })
      expect(await cache.list()).toHaveLength(1)

      await cache.clear()
      expect(await cache.list()).toEqual([])
    } finally {
      rmSync(fixture.dir, { recursive: true, force: true })
    }
  })

  it('verifies HMAC for intact cache data', async () => {
    const fixture = createFixture()

    try {
      const cache = new ScanCache({
        filePath: fixture.filePath,
        homeDir: fixture.dir,
        keyPath: fixture.keyPath,
        hostName: 'host-b',
        userId: '1001',
      })

      await cache.set('hash-1', {
        path: '/tmp/skill.md',
        skillName: 'skill-b',
        decision: 'suspicious',
        risk: 0.9,
        reasons: ['Detected pattern: ignore previous'],
        scannedAt: '2026-02-17T00:00:00.000Z',
      })

      const verification = await cache.verify()
      expect(verification.valid).toBe(true)
      expect(await cache.list()).toHaveLength(1)
    } finally {
      rmSync(fixture.dir, { recursive: true, force: true })
    }
  })

  it('invalidates tampered entries when HMAC does not match', async () => {
    const fixture = createFixture()

    try {
      const cache = new ScanCache({
        filePath: fixture.filePath,
        homeDir: fixture.dir,
        keyPath: fixture.keyPath,
        hostName: 'host-c',
        userId: '1002',
      })

      await cache.set('hash-1', {
        path: '/tmp/skill.md',
        skillName: 'skill-c',
        decision: 'safe',
        risk: 0.1,
        reasons: [],
        scannedAt: '2026-02-17T00:00:00.000Z',
      })

      const tamperedRaw = JSON.parse(readFileSync(fixture.filePath, 'utf8')) as {
        version: number
        hmac: string
        entries: Record<string, unknown>
      }
      tamperedRaw.entries['hash-2'] = {
        path: '/tmp/evil.md',
        skillName: 'evil',
        decision: 'safe',
        risk: 0.01,
        reasons: [],
        scannedAt: '2026-02-17T00:01:00.000Z',
      }
      writeFileSync(fixture.filePath, `${JSON.stringify(tamperedRaw, null, 2)}\n`, 'utf8')

      const reloaded = new ScanCache({
        filePath: fixture.filePath,
        homeDir: fixture.dir,
        keyPath: fixture.keyPath,
        hostName: 'host-c',
        userId: '1002',
      })
      const verification = await reloaded.verify()

      expect(verification.valid).toBe(false)
      expect(await reloaded.list()).toEqual([])
    } finally {
      rmSync(fixture.dir, { recursive: true, force: true })
    }
  })

  it('creates and reuses random HMAC key file', async () => {
    const fixture = createFixture()

    try {
      const cache = new ScanCache({
        filePath: fixture.filePath,
        homeDir: fixture.dir,
        keyPath: fixture.keyPath,
      })

      await cache.set('hash-1', {
        path: '/tmp/skill.md',
        skillName: 'alpha',
        decision: 'safe',
        risk: 0.1,
        reasons: [],
        scannedAt: '2026-02-17T00:00:00.000Z',
      })

      expect(existsSync(fixture.keyPath)).toBe(true)
      const firstKey = readFileSync(fixture.keyPath)
      expect(firstKey).toHaveLength(32)

      const reloaded = new ScanCache({
        filePath: fixture.filePath,
        homeDir: fixture.dir,
        keyPath: fixture.keyPath,
      })
      await reloaded.set('hash-2', {
        path: '/tmp/skill2.md',
        skillName: 'beta',
        decision: 'safe',
        risk: 0.1,
        reasons: [],
        scannedAt: '2026-02-17T00:00:01.000Z',
      })

      const secondKey = readFileSync(fixture.keyPath)
      expect(Buffer.compare(firstKey, secondKey)).toBe(0)
    } finally {
      rmSync(fixture.dir, { recursive: true, force: true })
    }
  })

  it('regenerates HMAC key when key file is corrupted', async () => {
    const fixture = createFixture()

    try {
      writeFileSync(fixture.keyPath, Buffer.from('bad-key', 'utf8'))

      const cache = new ScanCache({
        filePath: fixture.filePath,
        homeDir: fixture.dir,
        keyPath: fixture.keyPath,
      })
      await cache.set('hash-1', {
        path: '/tmp/skill.md',
        skillName: 'gamma',
        decision: 'safe',
        risk: 0.1,
        reasons: [],
        scannedAt: '2026-02-17T00:00:00.000Z',
      })

      const key = readFileSync(fixture.keyPath)
      expect(key).toHaveLength(32)
    } finally {
      rmSync(fixture.dir, { recursive: true, force: true })
    }
  })

  it('filters dangerous entry keys such as __proto__', async () => {
    const fixture = createFixture()

    try {
      const cache = new ScanCache({
        filePath: fixture.filePath,
        homeDir: fixture.dir,
        keyPath: fixture.keyPath,
      })
      await cache.set('hash-1', {
        path: '/tmp/skill.md',
        skillName: 'safe',
        decision: 'safe',
        risk: 0.1,
        reasons: [],
        scannedAt: '2026-02-17T00:00:00.000Z',
      })

      const current = JSON.parse(readFileSync(fixture.filePath, 'utf8')) as {
        version: number
        hmac: string
        entries: Record<string, unknown>
      }
      const safeEntry = current.entries['hash-1']
      const tamperedEntries: Record<string, unknown> = {
        'hash-1': safeEntry,
      }
      Object.defineProperty(tamperedEntries, '__proto__', {
        value: {
          polluted: true,
        },
        enumerable: true,
      })

      writeFileSync(
        fixture.filePath,
        `${JSON.stringify(
          {
            version: current.version,
            hmac: current.hmac,
            entries: tamperedEntries,
          },
          null,
          2
        )}\n`,
        'utf8'
      )

      const reloaded = new ScanCache({
        filePath: fixture.filePath,
        homeDir: fixture.dir,
        keyPath: fixture.keyPath,
      })
      const list = await reloaded.list()

      expect(list).toHaveLength(1)
      expect(list[0]?.contentHash).toBe('hash-1')
      expect(({} as { polluted?: boolean }).polluted).toBeUndefined()
    } finally {
      rmSync(fixture.dir, { recursive: true, force: true })
    }
  })
})
