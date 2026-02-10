import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import {
  AuditLogger,
  RulesDetector,
  Scanner,
  ThreatIntelDetector,
  ThreatIntelStore,
  buildMatchListFromIntel,
  evaluatePolicyMatch,
  QuarantineManager,
  buildEntryName,
  classifyTargetType,
  collectMcpTargetsFromJson,
  isConfigLikeFile,
  normalizeSurfaceText,
} from '@sapper-ai/core'
import type { AssessmentContext, AuditLogEntry, Decision, Detector, Policy } from '@sapper-ai/types'
import chokidar, { type FSWatcher } from 'chokidar'

type AuditLoggerLike = Pick<AuditLogger, 'log'>

interface FileWatcherOptions {
  policy: Policy
  scanner?: Scanner
  quarantineManager?: QuarantineManager
  auditLogger?: AuditLoggerLike
  detectors?: Detector[]
  watchPaths?: string[]
  threatIntelStore?: ThreatIntelStore
}

interface ScanTarget {
  id: string
  sourcePath: string
  sourceType: ReturnType<typeof classifyTargetType>
  surface: string
}

function toDefaultWatchPaths(): string[] {
  const home = homedir()
  return [join(home, '.claude', 'plugins'), join(home, '.config', 'claude-code'), process.cwd()]
}

export class FileWatcher {
  private readonly policy: Policy
  private readonly scanner: Scanner
  private readonly quarantineManager: QuarantineManager
  private readonly auditLogger: AuditLoggerLike
  private readonly detectors: Detector[]
  private readonly watchPaths: string[]
  private readonly threatIntelStore: ThreatIntelStore

  private watcher: FSWatcher | null = null
  private readonly inFlightPaths = new Set<string>()
  private threatIntelEntries: Array<{
    id: string
    type: 'toolName' | 'packageName' | 'urlPattern' | 'contentPattern' | 'sha256'
    value: string
    reason: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    source: string
    addedAt: string
    expiresAt?: string
  }> = []

  constructor(options: FileWatcherOptions) {
    this.policy = options.policy
    this.scanner = options.scanner ?? new Scanner()
    this.quarantineManager = options.quarantineManager ?? new QuarantineManager()
    this.auditLogger =
      options.auditLogger ?? new AuditLogger({ filePath: process.env.SAPPERAI_AUDIT_LOG_PATH ?? '/tmp/sapperai-proxy.audit.log' })
    this.detectors = options.detectors ?? [new RulesDetector()]
    this.watchPaths = options.watchPaths ?? toDefaultWatchPaths()
    this.threatIntelStore = options.threatIntelStore ?? new ThreatIntelStore({ cachePath: process.env.SAPPERAI_THREAT_FEED_CACHE })
  }

  async start(): Promise<void> {
    if (this.watcher) {
      throw new Error('FileWatcher already started')
    }

    await this.loadThreatIntel()

    const quarantineDir = this.quarantineManager.getQuarantineDir()
    this.watcher = chokidar.watch(this.watchPaths, {
      ignored: (pathName: string) => {
        if (pathName.includes('/node_modules/') || pathName.includes('/.git/') || pathName.includes('/dist/')) {
          return true
        }

        return pathName.startsWith(quarantineDir)
      },
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 250,
        pollInterval: 100,
      },
    })

    this.watcher.on('add', (pathName: string) => {
      void this.handleFile(pathName)
    })

    this.watcher.on('change', (pathName: string) => {
      void this.handleFile(pathName)
    })

    await new Promise<void>((resolve, reject) => {
      if (!this.watcher) {
        reject(new Error('FileWatcher failed to initialize'))
        return
      }

      const onReady = () => {
        this.watcher?.off('error', onError)
        resolve()
      }

      const onError = (error: unknown) => {
        this.watcher?.off('ready', onReady)
        reject(error instanceof Error ? error : new Error(String(error)))
      }

      this.watcher.once('ready', onReady)
      this.watcher.once('error', onError)
    })
  }

  async close(): Promise<void> {
    if (!this.watcher) {
      return
    }

    await this.watcher.close()
    this.watcher = null
  }

  private async handleFile(filePath: string): Promise<void> {
    if (!isConfigLikeFile(filePath) || this.inFlightPaths.has(filePath)) {
      return
    }

    this.inFlightPaths.add(filePath)

    try {
      const content = await this.readFileIfPresent(filePath)
      if (content === null || content.trim().length === 0) {
        return
      }

      const targets = this.toTargets(filePath, content)
      for (const target of targets) {
        const policyMatch = evaluatePolicyMatch(this.withThreatIntel(this.policy), {
          toolName: target.id,
          content: target.surface,
        })

        if (policyMatch.action === 'allow') {
          this.logAuditEntry(
            target,
            {
              action: 'allow',
              risk: 0,
              confidence: 1,
              reasons: policyMatch.reasons,
              evidence: [],
            },
            'watch_policy_match'
          )
          continue
        }

        if (policyMatch.action === 'block') {
          const blockDecision: Decision = {
            action: this.policy.mode === 'enforce' ? 'block' : 'allow',
            risk: 1,
            confidence: 1,
            reasons: policyMatch.reasons,
            evidence: [],
          }

          this.logAuditEntry(target, blockDecision, 'watch_policy_match')

          if (this.policy.mode === 'enforce') {
            await this.quarantineManager.quarantine(filePath, blockDecision)
            return
          }

          continue
        }

        const decision = await this.scanner.scanTool(target.id, target.surface, this.withThreatIntel(this.policy), this.resolveDetectors())
        this.logAuditEntry(target, decision)

        if (decision.action === 'block' && this.policy.mode === 'enforce') {
          try {
            await this.quarantineManager.quarantine(filePath, decision)
          } catch (error) {
            const reasons = [`Quarantine failed: ${error instanceof Error ? error.message : String(error)}`]
            this.logAuditEntry(
              target,
              {
                action: 'allow',
                risk: 0,
                confidence: 0,
                reasons,
                evidence: [],
              },
              'watch_quarantine_error'
            )
          }
          return
        }
      }
    } finally {
      this.inFlightPaths.delete(filePath)
    }
  }

  private async readFileIfPresent(filePath: string): Promise<string | null> {
    try {
      return await readFile(filePath, 'utf8')
    } catch {
      return null
    }
  }

  private toTargets(filePath: string, content: string): ScanTarget[] {
    const normalized = normalizeSurfaceText(content)
    const targetType = classifyTargetType(filePath)
    const targets: ScanTarget[] = [
      {
        id: `${targetType}:${buildEntryName(filePath)}`,
        sourcePath: filePath,
        sourceType: targetType,
        surface: normalized,
      },
    ]

    if (filePath.endsWith('.json')) {
      try {
        const parsed = JSON.parse(content) as unknown
        const mcpTargets = collectMcpTargetsFromJson(filePath, parsed)
        for (const mcpTarget of mcpTargets) {
          targets.push({
            id: `${mcpTarget.type}:${mcpTarget.name}`,
            sourcePath: mcpTarget.source,
            sourceType: mcpTarget.type,
            surface: mcpTarget.surface,
          })
        }
      } catch {
        // Ignore invalid JSON.
      }
    }

    return targets
  }

  private logAuditEntry(
    target: ScanTarget,
    decision: Decision,
    phase: 'watch_scan' | 'watch_quarantine_error' | 'watch_policy_match' = 'watch_scan'
  ): void {
    const context = {
      kind: 'install_scan',
      policy: this.policy,
      meta: {
        phase,
        sourcePath: target.sourcePath,
        sourceType: target.sourceType,
      },
    } as AssessmentContext

    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      context,
      decision,
      durationMs: 0,
    }

    this.auditLogger.log(entry)
  }

  private resolveDetectors(): Detector[] {
    if (this.threatIntelEntries.length === 0) {
      return this.detectors
    }

    return [new ThreatIntelDetector(this.threatIntelEntries), ...this.detectors]
  }

  private withThreatIntel(policy: Policy): Policy {
    if (this.threatIntelEntries.length === 0) {
      return policy
    }

    const intelBlocklist = buildMatchListFromIntel(this.threatIntelEntries)
    const extended = policy as Policy & {
      blocklist?: {
        toolNames?: string[]
        urlPatterns?: string[]
        contentPatterns?: string[]
        packageNames?: string[]
        sha256?: string[]
      }
    }

    return {
      ...extended,
      blocklist: {
        ...(extended.blocklist ?? {}),
        toolNames: [...(extended.blocklist?.toolNames ?? []), ...(intelBlocklist.toolNames ?? [])],
        packageNames: [...(extended.blocklist?.packageNames ?? []), ...(intelBlocklist.packageNames ?? [])],
        urlPatterns: [...(extended.blocklist?.urlPatterns ?? []), ...(intelBlocklist.urlPatterns ?? [])],
        contentPatterns: [...(extended.blocklist?.contentPatterns ?? []), ...(intelBlocklist.contentPatterns ?? [])],
        sha256: [...(extended.blocklist?.sha256 ?? []), ...(intelBlocklist.sha256 ?? [])],
      },
    } as Policy
  }

  private async loadThreatIntel(): Promise<void> {
    const extended = this.policy as Policy & {
      threatFeed?: {
        enabled?: boolean
        sources?: string[]
        autoSync?: boolean
        failOpen?: boolean
        cachePath?: string
      }
    }

    const feed = extended.threatFeed
    if (!feed?.enabled) {
      this.threatIntelEntries = []
      return
    }

    const store = feed.cachePath ? new ThreatIntelStore({ cachePath: feed.cachePath }) : this.threatIntelStore

    try {
      if (feed.autoSync && Array.isArray(feed.sources) && feed.sources.length > 0) {
        await store.syncFromSources(feed.sources)
      }

      const snapshot = await store.loadSnapshot()
      this.threatIntelEntries = snapshot.entries
    } catch (error) {
      if (feed.failOpen === false) {
        throw error
      }

      this.threatIntelEntries = []
    }
  }
}
