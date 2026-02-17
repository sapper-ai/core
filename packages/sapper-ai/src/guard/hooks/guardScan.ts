import { type Dirent } from 'node:fs'
import { readFile, readdir, realpath, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { cwd } from 'node:process'
import { homedir } from 'node:os'
import { join, relative, resolve, sep } from 'node:path'

import { ScanCache } from '../ScanCache'
import { WarningStore } from '../WarningStore'
import { scanSingleSkill } from '../scanSingleSkill'
import type { GuardHookOutput, OutputWriter, SingleSkillScanResult } from '../types'

interface GuardScanSummary {
  watchPathCount: number
  totalSkills: number
  scanned: number
  cached: number
  suspicious: number
  errors: number
  cacheValid: boolean
}

type ReaddirWithFileTypes = (
  filePath: string,
  options: {
    withFileTypes: true
    encoding: BufferEncoding
  }
) => Promise<Dirent[]>

export interface GuardScanOptions {
  watchPaths?: string[]
  currentWorkingDirectory?: string
  homeDir?: string
  stdout?: OutputWriter
  stderr?: OutputWriter
  scanCache?: ScanCache
  warningStore?: WarningStore
  scanSkillFn?: (filePath: string) => Promise<SingleSkillScanResult>
  readFileFn?: (filePath: string, encoding: BufferEncoding) => Promise<string>
  realpathFn?: (filePath: string) => Promise<string>
  readdirFn?: ReaddirWithFileTypes
  statFn?: typeof stat
  now?: () => number
}

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

function normalizeWatchPaths(options: GuardScanOptions): string[] {
  if (Array.isArray(options.watchPaths) && options.watchPaths.length > 0) {
    return Array.from(new Set(options.watchPaths.map((path) => resolve(path))))
  }

  const currentHomeDir = options.homeDir ?? homedir()
  const currentWorkingDirectory = options.currentWorkingDirectory ?? cwd()

  return [
    join(currentHomeDir, '.claude', 'plugins'),
    join(currentHomeDir, '.claude', 'skills'),
    join(currentWorkingDirectory, '.claude', 'skills'),
  ]
}

async function isDirectory(path: string, statFn: typeof stat): Promise<boolean> {
  try {
    const info = await statFn(path)
    return info.isDirectory()
  } catch {
    return false
  }
}

function isSubpath(parent: string, candidate: string): boolean {
  const rel = relative(parent, candidate)
  if (rel === '') {
    return true
  }
  if (rel === '..' || rel.startsWith(`..${sep}`)) {
    return false
  }
  if (rel.includes(':')) {
    return false
  }
  return true
}

async function collectMarkdownFiles(
  rootPath: string,
  readDirFn: ReaddirWithFileTypes,
  statFn: typeof stat,
  resolvePath: (filePath: string) => Promise<string>
): Promise<string[]> {
  const files = new Set<string>()
  const seenDirectories = new Set<string>()
  const resolvedRootPath = await resolvePath(rootPath).catch(() => rootPath)
  const stack = [rootPath]

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) {
      continue
    }

    let resolvedCurrent: string
    try {
      resolvedCurrent = await resolvePath(current)
    } catch {
      resolvedCurrent = current
    }

    if (!isSubpath(resolvedRootPath, resolvedCurrent)) {
      continue
    }

    if (seenDirectories.has(resolvedCurrent)) {
      continue
    }
    seenDirectories.add(resolvedCurrent)

    let entries: Dirent[]
    try {
      entries = await readDirFn(current, { withFileTypes: true, encoding: 'utf8' })
    } catch {
      continue
    }

    for (const entry of entries) {
      const fullPath = join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(fullPath)
        continue
      }

      if (entry.isSymbolicLink()) {
        try {
          const resolvedSymlinkPath = await resolvePath(fullPath)
          if (!isSubpath(resolvedRootPath, resolvedSymlinkPath)) {
            continue
          }

          const info = await statFn(fullPath)
          if (info.isDirectory()) {
            stack.push(fullPath)
            continue
          }
          if (info.isFile() && entry.name.toLowerCase().endsWith('.md')) {
            files.add(fullPath)
          }
        } catch {
          continue
        }
        continue
      }

      if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        files.add(fullPath)
      }
    }
  }

  return Array.from(files).sort()
}

function renderSummary(summary: GuardScanSummary): string {
  if (summary.totalSkills === 0) {
    return 'SapperAI: no skill files found.'
  }

  if (summary.scanned === 0 && summary.errors === 0) {
    return `SapperAI: checked ${summary.totalSkills} skill files, no content changes.`
  }

  const parts = [
    `SapperAI: checked ${summary.totalSkills} skill files`,
    `${summary.scanned} scanned`,
    `${summary.cached} cached`,
  ]
  if (summary.suspicious > 0) {
    parts.push(`${summary.suspicious} suspicious`)
  }
  if (summary.errors > 0) {
    parts.push(`${summary.errors} errors`)
  }

  return parts.join(', ') + '.'
}

function writeJson(writer: OutputWriter, payload: GuardHookOutput): void {
  writer.write(`${JSON.stringify(payload)}\n`)
}

function writeError(stderr: OutputWriter, message: string): void {
  stderr.write(`[sapper-ai] ${message}\n`)
}

export async function guardScan(options: GuardScanOptions = {}): Promise<GuardHookOutput> {
  const stdout = options.stdout ?? process.stdout
  const stderr = options.stderr ?? process.stderr
  const scanCache = options.scanCache ?? new ScanCache({ homeDir: options.homeDir })
  const warningStore = options.warningStore ?? new WarningStore({ homeDir: options.homeDir })
  const scanSkill = options.scanSkillFn ?? ((path: string) => scanSingleSkill(path))
  const read = options.readFileFn ?? readFile
  const resolvePath = options.realpathFn ?? realpath
  const readDir: ReaddirWithFileTypes =
    options.readdirFn ??
    ((filePath, readOptions) => readdir(filePath, readOptions))
  const statPath = options.statFn ?? stat
  const now = options.now ?? Date.now

  const summary: GuardScanSummary = {
    watchPathCount: 0,
    totalSkills: 0,
    scanned: 0,
    cached: 0,
    suspicious: 0,
    errors: 0,
    cacheValid: true,
  }

  try {
    const verifyResult = await scanCache.verify()
    summary.cacheValid = verifyResult.valid

    const watchPaths = normalizeWatchPaths(options)
    const seenSkills = new Set<string>()

    for (const watchPath of watchPaths) {
      const exists = await isDirectory(watchPath, statPath)
      if (!exists) {
        continue
      }

      summary.watchPathCount += 1
      const files = await collectMarkdownFiles(watchPath, readDir, statPath, resolvePath)

      for (const filePath of files) {
        let resolvedFilePath = filePath
        try {
          resolvedFilePath = await resolvePath(filePath)
        } catch {
          resolvedFilePath = filePath
        }

        if (seenSkills.has(resolvedFilePath)) {
          continue
        }
        seenSkills.add(resolvedFilePath)
        summary.totalSkills += 1

        try {
          const content = await read(resolvedFilePath, 'utf8')
          const contentHash = hashContent(content)

          if (await scanCache.has(contentHash)) {
            summary.cached += 1
            continue
          }

          const scanResult = await scanSkill(resolvedFilePath)
          summary.scanned += 1

          await scanCache.set(scanResult.contentHash, {
            path: scanResult.skillPath,
            skillName: scanResult.skillName,
            decision: scanResult.decision,
            risk: scanResult.risk,
            reasons: [...scanResult.reasons],
            scannedAt: new Date(now()).toISOString(),
          })

          if (scanResult.decision === 'suspicious') {
            summary.suspicious += 1
            await warningStore.addPending({
              skillName: scanResult.skillName,
              skillPath: scanResult.skillPath,
              contentHash: scanResult.contentHash,
              risk: scanResult.risk,
              reasons: [...scanResult.reasons],
              detectedAt: new Date(now()).toISOString(),
            })
          }
        } catch (error) {
          summary.errors += 1
          const reason = error instanceof Error ? error.message : String(error)
          writeError(stderr, `guard scan failed for ${resolvedFilePath}: ${reason}`)
        }
      }
    }
  } catch (error) {
    summary.errors += 1
    const reason = error instanceof Error ? error.message : String(error)
    writeError(stderr, `guard scan failed: ${reason}`)
  }

  const payload: GuardHookOutput = {
    suppressPrompt: false,
    message: renderSummary(summary),
    summary: {
      watchPathCount: summary.watchPathCount,
      totalSkills: summary.totalSkills,
      scanned: summary.scanned,
      cached: summary.cached,
      suspicious: summary.suspicious,
      errors: summary.errors,
      cacheValid: summary.cacheValid,
    },
  }

  writeJson(stdout, payload)
  return payload
}
