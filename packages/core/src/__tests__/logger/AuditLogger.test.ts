import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AuditLogEntry, Policy } from '@sapperai/types'

import { AuditLogger } from '../../logger/AuditLogger'

const policy: Policy = {
  mode: 'enforce',
  defaultAction: 'allow',
  failOpen: true,
}

function createEntry(): AuditLogEntry {
  return {
    timestamp: new Date().toISOString(),
    context: {
      kind: 'pre_tool_call',
      toolCall: {
        toolName: 'shell',
        arguments: { cmd: 'ls' },
      },
      policy,
    },
    decision: {
      action: 'allow',
      risk: 0.2,
      confidence: 0.9,
      reasons: ['benign'],
      evidence: [],
    },
    durationMs: 3,
  }
}

describe('AuditLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs structured json to console by default', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const logger = new AuditLogger()

    logger.log(createEntry())

    expect(consoleSpy).toHaveBeenCalledTimes(1)
    const payload = JSON.parse(String(consoleSpy.mock.calls[0][0])) as AuditLogEntry

    expect(payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(payload.context.kind).toBe('pre_tool_call')
    expect(payload.decision.action).toBe('allow')
    expect(payload.durationMs).toBe(3)
  })

  it('appends json line to file when file path is provided', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'audit-log-'))
    const filePath = join(tempDir, 'audit.log')
    const logger = new AuditLogger({ filePath })

    logger.log(createEntry())

    const loggedText = readFileSync(filePath, 'utf8').trim()
    const payload = JSON.parse(loggedText) as AuditLogEntry

    expect(payload.context.toolCall?.toolName).toBe('shell')
    expect(payload.decision.reasons).toEqual(['benign'])

    rmSync(tempDir, { recursive: true, force: true })
  })
})
