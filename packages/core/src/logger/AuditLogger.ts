import { appendFileSync } from 'node:fs'

import type { AuditLogEntry } from '@sapperai/types'

interface AuditLoggerOptions {
  filePath?: string
}

export class AuditLogger {
  constructor(private readonly options: AuditLoggerOptions = {}) {}

  log(entry: AuditLogEntry): void {
    const payload: AuditLogEntry = {
      ...entry,
      timestamp: entry.timestamp || new Date().toISOString(),
    }

    const line = JSON.stringify(payload)

    if (this.options.filePath) {
      appendFileSync(this.options.filePath, `${line}\n`, 'utf8')
      return
    }

    console.log(line)
  }
}
