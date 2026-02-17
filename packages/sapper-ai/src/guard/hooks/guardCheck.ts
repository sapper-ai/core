import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

import { WarningStore } from '../WarningStore'
import { scanSingleSkill } from '../scanSingleSkill'
import type { GuardHookOutput, OutputWriter, SingleSkillScanResult, SkillWarning } from '../types'

export interface GuardCheckOptions {
  warningStore?: WarningStore
  scanSkillFn?: (filePath: string) => Promise<SingleSkillScanResult>
  stdout?: OutputWriter
  stderr?: OutputWriter
  readFileFn?: (filePath: string, encoding: BufferEncoding) => Promise<string>
  now?: () => number
}

interface GuardCheckSummary {
  pending: number
  delivered: number
  acknowledged: number
  removed: number
  errors: number
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

function writeJson(writer: OutputWriter, payload: GuardHookOutput): void {
  writer.write(`${JSON.stringify(payload)}\n`)
}

function writeError(stderr: OutputWriter, message: string): void {
  stderr.write(`[sapper-ai] ${message}\n`)
}

function toWarningMessage(warnings: SkillWarning[]): string {
  const lines = ['⚠ SapperAI: suspicious skills detected']

  for (const warning of warnings) {
    lines.push(`- ${warning.skillName} (risk: ${warning.risk.toFixed(2)})`)
    for (const reason of warning.reasons.slice(0, 3)) {
      lines.push(`  -> ${reason}`)
    }
    lines.push(`  path: ${warning.skillPath}`)
  }

  return lines.join('\n')
}

export async function guardCheck(options: GuardCheckOptions = {}): Promise<GuardHookOutput> {
  const stdout = options.stdout ?? process.stdout
  const stderr = options.stderr ?? process.stderr
  const warningStore = options.warningStore ?? new WarningStore()
  const scanSkill = options.scanSkillFn ?? ((path: string) => scanSingleSkill(path))
  const read = options.readFileFn ?? readFile
  const now = options.now ?? Date.now

  const summary: GuardCheckSummary = {
    pending: 0,
    delivered: 0,
    acknowledged: 0,
    removed: 0,
    errors: 0,
  }

  try {
    const pendingWarnings = await warningStore.getPending()
    summary.pending = pendingWarnings.length

    if (pendingWarnings.length === 0) {
      const payload: GuardHookOutput = {
        suppressPrompt: false,
        message: '',
        warnings: [],
        summary: { ...summary },
      }
      writeJson(stdout, payload)
      return payload
    }

    const nextPending: SkillWarning[] = []
    const deliverWarnings: SkillWarning[] = []

    for (const warning of pendingWarnings) {
      if (await warningStore.isDismissed(warning.skillName, warning.contentHash)) {
        summary.removed += 1
        continue
      }

      try {
        const content = await read(warning.skillPath, 'utf8')
        const currentHash = sha256(content)

        if (currentHash === warning.contentHash) {
          deliverWarnings.push(warning)
          continue
        }

        const rescanned = await scanSkill(warning.skillPath)
        const postScanContent = await read(warning.skillPath, 'utf8')
        const postScanHash = sha256(postScanContent)
        if (postScanHash !== rescanned.contentHash) {
          deliverWarnings.push({
            ...warning,
            contentHash: postScanHash,
            risk: Math.max(warning.risk, rescanned.risk),
            reasons: [...warning.reasons, 'File changed during re-scan (possible TOCTOU)'],
            detectedAt: new Date(now()).toISOString(),
          })
          continue
        }

        if (rescanned.decision === 'suspicious') {
          const rescannedWarning: SkillWarning = {
            skillName: rescanned.skillName,
            skillPath: rescanned.skillPath,
            contentHash: rescanned.contentHash,
            risk: rescanned.risk,
            reasons: [...rescanned.reasons],
            detectedAt: new Date(now()).toISOString(),
          }

          if (await warningStore.isDismissed(rescannedWarning.skillName, rescannedWarning.contentHash)) {
            summary.removed += 1
            continue
          }

          deliverWarnings.push(rescannedWarning)
          continue
        }

        summary.removed += 1
      } catch (error) {
        const nodeError = error as NodeJS.ErrnoException
        if (nodeError?.code === 'ENOENT') {
          summary.removed += 1
          continue
        }

        summary.errors += 1
        const reason = error instanceof Error ? error.message : String(error)
        writeError(stderr, `guard check failed for ${warning.skillPath}: ${reason}`)
        nextPending.push(warning)
      }
    }

    await warningStore.replacePending([...nextPending, ...deliverWarnings])
    summary.acknowledged = await warningStore.acknowledgeAll(deliverWarnings)

    summary.delivered = deliverWarnings.length

    const payload: GuardHookOutput = {
      suppressPrompt: false,
      message: deliverWarnings.length > 0 ? toWarningMessage(deliverWarnings) : '',
      warnings: deliverWarnings,
      summary: { ...summary },
    }
    writeJson(stdout, payload)
    return payload
  } catch (error) {
    summary.errors += 1
    const reason = error instanceof Error ? error.message : String(error)
    writeError(stderr, `guard check failed: ${reason}`)

    const payload: GuardHookOutput = {
      suppressPrompt: false,
      message: '',
      warnings: [],
      summary: { ...summary },
    }
    writeJson(stdout, payload)
    return payload
  }
}
