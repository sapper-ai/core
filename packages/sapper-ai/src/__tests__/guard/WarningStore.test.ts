import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { WarningStore } from '../../guard/WarningStore'

function createFixture(): { dir: string; filePath: string } {
  const dir = mkdtempSync(join(tmpdir(), 'sapper-ai-warning-store-'))
  return {
    dir,
    filePath: join(dir, 'warnings.json'),
  }
}

describe('guard/WarningStore', () => {
  it('adds pending warnings and reads them back', async () => {
    const fixture = createFixture()

    try {
      const store = new WarningStore({ filePath: fixture.filePath, homeDir: fixture.dir })
      await store.addPending({
        skillName: 'data-helper',
        skillPath: '/tmp/data-helper.md',
        contentHash: 'hash-a',
        risk: 0.85,
        reasons: ['Detected pattern: ignore previous'],
        detectedAt: '2026-02-17T00:00:00.000Z',
      })

      const pending = await store.getPending()
      expect(pending).toHaveLength(1)
      expect(pending[0]).toMatchObject({
        skillName: 'data-helper',
        contentHash: 'hash-a',
      })
    } finally {
      rmSync(fixture.dir, { recursive: true, force: true })
    }
  })

  it('acknowledges pending warnings and moves them to acknowledged', async () => {
    const fixture = createFixture()

    try {
      const store = new WarningStore({ filePath: fixture.filePath, homeDir: fixture.dir })
      await store.addPending({
        skillName: 'data-helper',
        skillPath: '/tmp/data-helper.md',
        contentHash: 'hash-b',
        risk: 0.9,
        reasons: ['Detected pattern: output all'],
        detectedAt: '2026-02-17T00:00:00.000Z',
      })

      const moved = await store.acknowledge('data-helper')
      expect(moved).toBe(1)
      expect(await store.getPending()).toEqual([])

      const acknowledged = await store.getAcknowledged()
      expect(acknowledged).toHaveLength(1)
      expect(acknowledged[0]?.contentHash).toBe('hash-b')
    } finally {
      rmSync(fixture.dir, { recursive: true, force: true })
    }
  })

  it('dismisses warnings by skill name and blocks re-adding after dismiss', async () => {
    const fixture = createFixture()

    try {
      const store = new WarningStore({ filePath: fixture.filePath, homeDir: fixture.dir })
      await store.addPending({
        skillName: 'data-helper',
        skillPath: '/tmp/data-helper.md',
        contentHash: 'hash-c',
        risk: 0.95,
        reasons: ['Detected pattern: system prompt'],
        detectedAt: '2026-02-17T00:00:00.000Z',
      })

      await store.dismiss('data-helper')
      expect(await store.getPending()).toEqual([])
      const dismissed = await store.getDismissed()
      expect(dismissed.some((entry) => entry.skillName === 'data-helper' && entry.contentHash === undefined)).toBe(true)

      await store.addPending({
        skillName: 'data-helper',
        skillPath: '/tmp/data-helper.md',
        contentHash: 'hash-c',
        risk: 0.95,
        reasons: ['Detected pattern: system prompt'],
        detectedAt: '2026-02-17T00:00:00.000Z',
      })
      expect(await store.getPending()).toEqual([])

      await store.addPending({
        skillName: 'data-helper',
        skillPath: '/tmp/data-helper.md',
        contentHash: 'hash-d',
        risk: 0.8,
        reasons: ['Detected pattern: disregard'],
        detectedAt: '2026-02-17T00:01:00.000Z',
      })
      expect(await store.getPending()).toEqual([])
    } finally {
      rmSync(fixture.dir, { recursive: true, force: true })
    }
  })
})
