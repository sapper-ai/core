import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export type ThreatIndicatorType = 'toolName' | 'packageName' | 'urlPattern' | 'contentPattern' | 'sha256'

export interface ThreatIntelEntry {
  id: string
  type: ThreatIndicatorType
  value: string
  reason: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  source: string
  addedAt: string
  expiresAt?: string
}

export interface ThreatIntelSnapshot {
  version: number
  updatedAt: string
  entries: ThreatIntelEntry[]
}

export interface ThreatIntelSyncResult {
  sourceCount: number
  acceptedEntries: number
  skippedEntries: number
  updatedAt: string
}

export interface IntelMatchList {
  toolNames?: string[]
  urlPatterns?: string[]
  contentPatterns?: string[]
  packageNames?: string[]
  sha256?: string[]
}

interface ThreatIntelStoreOptions {
  cachePath?: string
  fetchImpl?: typeof fetch
}

function defaultCachePath(): string {
  return join(homedir(), '.sapperai', 'intel', 'threat-intel.json')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toSeverity(value: unknown): ThreatIntelEntry['severity'] {
  if (value === 'low' || value === 'medium' || value === 'high' || value === 'critical') {
    return value
  }

  return 'medium'
}

function toType(value: unknown): ThreatIndicatorType | null {
  if (value === 'toolName' || value === 'packageName' || value === 'urlPattern' || value === 'contentPattern' || value === 'sha256') {
    return value
  }

  return null
}

function normalizeEntry(raw: unknown, source: string): ThreatIntelEntry | null {
  if (!isRecord(raw)) {
    return null
  }

  const type = toType(raw.type)
  const value = typeof raw.value === 'string' ? raw.value.trim() : ''
  if (!type || value.length === 0) {
    return null
  }

  const id = typeof raw.id === 'string' && raw.id.trim().length > 0 ? raw.id.trim() : `${type}:${value}`
  const reason = typeof raw.reason === 'string' && raw.reason.trim().length > 0 ? raw.reason.trim() : 'Known malicious indicator'
  const now = new Date().toISOString()

  return {
    id,
    type,
    value,
    reason,
    severity: toSeverity(raw.severity),
    source: typeof raw.source === 'string' && raw.source.trim().length > 0 ? raw.source : source,
    addedAt: typeof raw.addedAt === 'string' ? raw.addedAt : now,
    expiresAt: typeof raw.expiresAt === 'string' ? raw.expiresAt : undefined,
  }
}

function isExpired(entry: ThreatIntelEntry, now: Date): boolean {
  if (!entry.expiresAt) {
    return false
  }

  const expires = new Date(entry.expiresAt)
  if (Number.isNaN(expires.getTime())) {
    return false
  }

  return expires.getTime() <= now.getTime()
}

export class ThreatIntelStore {
  private readonly cachePath: string
  private readonly fetchImpl: typeof fetch

  constructor(options: ThreatIntelStoreOptions = {}) {
    this.cachePath = options.cachePath ?? defaultCachePath()
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  async loadSnapshot(): Promise<ThreatIntelSnapshot> {
    try {
      const raw = await readFile(this.cachePath, 'utf8')
      const parsed = JSON.parse(raw) as ThreatIntelSnapshot
      if (!Array.isArray(parsed.entries)) {
        return this.emptySnapshot()
      }

      const now = new Date()
      return {
        version: typeof parsed.version === 'number' ? parsed.version : 1,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : now.toISOString(),
        entries: parsed.entries.filter((entry) => !isExpired(entry, now)),
      }
    } catch {
      return this.emptySnapshot()
    }
  }

  async saveSnapshot(snapshot: ThreatIntelSnapshot): Promise<void> {
    await mkdir(dirname(this.cachePath), { recursive: true })
    await writeFile(this.cachePath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
  }

  async syncFromSources(sources: string[]): Promise<ThreatIntelSyncResult> {
    const accepted: ThreatIntelEntry[] = []
    let skippedEntries = 0

    for (const source of sources) {
      const entries = await this.pullSource(source)
      for (const rawEntry of entries) {
        const normalized = normalizeEntry(rawEntry, source)
        if (normalized) {
          accepted.push(normalized)
        } else {
          skippedEntries += 1
        }
      }
    }

    const deduped = this.dedupe(accepted)
    const snapshot: ThreatIntelSnapshot = {
      version: 1,
      updatedAt: new Date().toISOString(),
      entries: deduped,
    }

    await this.saveSnapshot(snapshot)

    return {
      sourceCount: sources.length,
      acceptedEntries: deduped.length,
      skippedEntries,
      updatedAt: snapshot.updatedAt,
    }
  }

  async listEntries(): Promise<ThreatIntelEntry[]> {
    const snapshot = await this.loadSnapshot()
    return snapshot.entries
  }

  private async pullSource(source: string): Promise<unknown[]> {
    const response = await this.fetchImpl(source)
    if (!response.ok) {
      throw new Error(`Threat intel fetch failed for ${source}: ${response.status}`)
    }

    const payload = (await response.json()) as unknown
    if (Array.isArray(payload)) {
      return payload
    }

    if (isRecord(payload) && Array.isArray(payload.entries)) {
      return payload.entries
    }

    return []
  }

  private dedupe(entries: ThreatIntelEntry[]): ThreatIntelEntry[] {
    const seen = new Set<string>()
    const result: ThreatIntelEntry[] = []

    for (const entry of entries) {
      const key = `${entry.type}::${entry.value.toLowerCase()}`
      if (seen.has(key)) {
        continue
      }

      seen.add(key)
      result.push(entry)
    }

    return result
  }

  private emptySnapshot(): ThreatIntelSnapshot {
    return {
      version: 1,
      updatedAt: new Date(0).toISOString(),
      entries: [],
    }
  }
}

export function buildMatchListFromIntel(entries: ThreatIntelEntry[]): IntelMatchList {
  const toolNames: string[] = []
  const packageNames: string[] = []
  const urlPatterns: string[] = []
  const contentPatterns: string[] = []
  const sha256Values: string[] = []

  for (const entry of entries) {
    if (entry.type === 'toolName') {
      toolNames.push(entry.value)
    }

    if (entry.type === 'packageName') {
      packageNames.push(entry.value)
    }

    if (entry.type === 'urlPattern') {
      urlPatterns.push(entry.value)
    }

    if (entry.type === 'contentPattern') {
      contentPatterns.push(entry.value)
    }

    if (entry.type === 'sha256') {
      sha256Values.push(entry.value)
    }
  }

  return {
    toolNames: toolNames.length > 0 ? toolNames : undefined,
    packageNames: packageNames.length > 0 ? packageNames : undefined,
    urlPatterns: urlPatterns.length > 0 ? urlPatterns : undefined,
    contentPatterns: contentPatterns.length > 0 ? contentPatterns : undefined,
    sha256: sha256Values.length > 0 ? sha256Values : undefined,
  }
}
