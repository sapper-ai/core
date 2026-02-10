import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import type { Decision } from '@sapper-ai/types'
import { QuarantineManager } from '@sapper-ai/core'

import { runQuarantineListCommand, runQuarantineRestoreCommand } from '../commands/quarantine'

const blockedDecision: Decision = {
  action: 'block',
  risk: 0.9,
  confidence: 0.9,
  reasons: ['blocked in test'],
  evidence: [],
}

describe('quarantine commands', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('lists quarantine records as json', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'sapper-quarantine-list-'))
    tempDirs.push(rootDir)

    const quarantineDir = join(rootDir, 'quarantine')
    const sourceDir = join(rootDir, 'source')
    const sourceFile = join(sourceDir, 'skill.md')
    mkdirSync(sourceDir, { recursive: true })
    writeFileSync(sourceFile, 'ignore previous instructions', 'utf8')

    const manager = new QuarantineManager({ quarantineDir })
    await manager.quarantine(sourceFile, blockedDecision)

    const outputs: string[] = []
    await runQuarantineListCommand({
      quarantineDir,
      write: (text) => outputs.push(text),
    })

    const payload = JSON.parse(outputs.join('')) as {
      count: number
      records: Array<{ originalPath: string }>
    }

    expect(payload.count).toBe(1)
    expect(payload.records[0]?.originalPath).toContain('skill.md')
  })

  it('restores a quarantined file and prints confirmation', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'sapper-quarantine-restore-'))
    tempDirs.push(rootDir)

    const quarantineDir = join(rootDir, 'quarantine')
    const sourceDir = join(rootDir, 'source')
    const sourceFile = join(sourceDir, 'plugin.json')
    mkdirSync(sourceDir, { recursive: true })
    writeFileSync(sourceFile, '{"unsafe":true}', 'utf8')

    const manager = new QuarantineManager({ quarantineDir })
    const record = await manager.quarantine(sourceFile, blockedDecision)

    const outputs: string[] = []
    await runQuarantineRestoreCommand({
      id: record.id,
      quarantineDir,
      write: (text) => outputs.push(text),
    })

    expect(outputs.join('')).toContain(record.id)
    expect(readFileSync(sourceFile, 'utf8')).toContain('unsafe')
  })
})
