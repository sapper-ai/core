import { closeSync, existsSync, openSync, readFileSync, readSync, statSync } from 'node:fs'

import type { AuditLogEntry } from '@sapper-ai/types'

import { getAuditLogPath } from './paths'

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024

export function readAuditLog(): AuditLogEntry[] {
  const logPath = getAuditLogPath()
  if (!existsSync(logPath)) return []

  const stat = statSync(logPath)
  let content: string

  if (stat.size > MAX_FILE_SIZE_BYTES) {
    const tailSize = 10 * 1024 * 1024
    const buffer = Buffer.alloc(tailSize)
    const start = Math.max(0, stat.size - tailSize)

    const fd = openSync(logPath, 'r')
    try {
      const bytesRead = readSync(fd, buffer, 0, buffer.length, start)
      content = buffer.subarray(0, bytesRead).toString('utf8')
    } finally {
      closeSync(fd)
    }

    const firstNewline = content.indexOf('\n')
    if (firstNewline > 0) {
      content = content.slice(firstNewline + 1)
    }
  } else {
    content = readFileSync(logPath, 'utf8')
  }

  const lines = content.split('\n').filter((line) => line.trim().length > 0)
  const entries: AuditLogEntry[] = []

  for (const line of lines) {
    try {
      entries.push(JSON.parse(line) as AuditLogEntry)
    } catch {
      continue
    }
  }

  return entries.reverse()
}
