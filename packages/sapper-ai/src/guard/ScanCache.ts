import { readFile, writeFile } from 'node:fs/promises'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

import { atomicWriteFile, ensureDir } from '../utils/fs'

import type { ScanCacheEntry, ScanCacheVerificationResult } from './types'

const SCAN_CACHE_VERSION = 2
const SCAN_CACHE_DIR = '.sapper-ai'
const SCAN_CACHE_FILE = 'scan-cache.json'
const HMAC_KEY_FILE = 'hmac-key'
const HMAC_KEY_BYTES = 32
const SHA256_HEX_LENGTH = 64
const PRIVATE_FILE_MODE = 0o600
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

interface ScanCacheFileData {
  version: number
  hmac: string
  entries: Record<string, ScanCacheEntry>
}

export interface ScanCacheOptions {
  filePath?: string
  homeDir?: string
  keyPath?: string
  // Backward-compatible legacy fields (unused in v2 key strategy).
  hostName?: string
  userId?: string
  readFileFn?: (filePath: string, encoding: BufferEncoding) => Promise<string>
  writeFileFn?: (filePath: string, content: string) => Promise<void>
  readBufferFileFn?: (filePath: string) => Promise<Buffer>
  writeBufferFileFn?: (filePath: string, content: Buffer) => Promise<void>
  randomBytesFn?: (size: number) => Buffer
}

function createEntryMap(): Record<string, ScanCacheEntry> {
  return Object.create(null) as Record<string, ScanCacheEntry>
}

function isHexDigest(value: string): boolean {
  return value.length === SHA256_HEX_LENGTH && /^[0-9a-f]+$/i.test(value)
}

function hmacEqual(left: string, right: string): boolean {
  if (!isHexDigest(left) || !isHexDigest(right) || left.length !== right.length) {
    return false
  }

  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'))
}

function sortEntries(entries: Record<string, ScanCacheEntry>): Record<string, ScanCacheEntry> {
  const ordered = createEntryMap()

  for (const hash of Object.keys(entries).sort()) {
    if (DANGEROUS_KEYS.has(hash)) {
      continue
    }

    const entry = entries[hash]
    if (!entry) {
      continue
    }

    ordered[hash] = {
      path: entry.path,
      skillName: entry.skillName,
      decision: entry.decision,
      risk: entry.risk,
      reasons: [...entry.reasons],
      scannedAt: entry.scannedAt,
    }
  }

  return ordered
}

function normalizeEntry(entry: unknown): ScanCacheEntry | null {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return null
  }

  const value = entry as {
    path?: unknown
    skillName?: unknown
    decision?: unknown
    risk?: unknown
    reasons?: unknown
    scannedAt?: unknown
  }

  const decision = value.decision === 'suspicious' ? 'suspicious' : value.decision === 'safe' ? 'safe' : null
  if (decision === null) {
    return null
  }

  if (typeof value.path !== 'string' || value.path.length === 0) {
    return null
  }
  if (typeof value.skillName !== 'string' || value.skillName.length === 0) {
    return null
  }
  if (typeof value.risk !== 'number' || !Number.isFinite(value.risk)) {
    return null
  }
  if (!Array.isArray(value.reasons) || value.reasons.some((reason) => typeof reason !== 'string')) {
    return null
  }
  if (typeof value.scannedAt !== 'string' || value.scannedAt.length === 0) {
    return null
  }

  return {
    path: value.path,
    skillName: value.skillName,
    decision,
    risk: value.risk,
    reasons: [...value.reasons],
    scannedAt: value.scannedAt,
  }
}

function normalizeEntries(entries: unknown): Record<string, ScanCacheEntry> {
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    return createEntryMap()
  }

  const normalized = createEntryMap()
  for (const [hash, entry] of Object.entries(entries as Record<string, unknown>)) {
    if (DANGEROUS_KEYS.has(hash)) {
      continue
    }

    const safeEntry = normalizeEntry(entry)
    if (!safeEntry) {
      continue
    }
    normalized[hash] = safeEntry
  }

  return normalized
}

export class ScanCache {
  private readonly cachePath: string
  private readonly hmacKeyPath: string
  private readonly readFileFn: (filePath: string, encoding: BufferEncoding) => Promise<string>
  private readonly writeFileFn: (filePath: string, content: string) => Promise<void>
  private readonly readBufferFileFn: (filePath: string) => Promise<Buffer>
  private readonly writeBufferFileFn: (filePath: string, content: Buffer) => Promise<void>
  private readonly randomBytesFn: (size: number) => Buffer

  private state: ScanCacheFileData | null = null
  private hmacKey: Buffer | null = null

  constructor(options: ScanCacheOptions = {}) {
    const homePath = options.homeDir ?? homedir()
    this.cachePath = options.filePath ?? join(homePath, SCAN_CACHE_DIR, SCAN_CACHE_FILE)
    this.hmacKeyPath = options.keyPath ?? join(homePath, SCAN_CACHE_DIR, HMAC_KEY_FILE)

    this.readFileFn = options.readFileFn ?? readFile
    this.writeFileFn =
      options.writeFileFn ?? ((filePath: string, content: string) => atomicWriteFile(filePath, content, { mode: PRIVATE_FILE_MODE }))

    this.readBufferFileFn = options.readBufferFileFn ?? ((filePath: string) => readFile(filePath))
    this.writeBufferFileFn =
      options.writeBufferFileFn ??
      (async (filePath: string, content: Buffer) => {
        await ensureDir(dirname(filePath))
        await writeFile(filePath, content, { mode: PRIVATE_FILE_MODE })
      })

    this.randomBytesFn = options.randomBytesFn ?? randomBytes
  }

  async has(contentHash: string): Promise<boolean> {
    const state = await this.loadState()
    return Object.prototype.hasOwnProperty.call(state.entries, contentHash)
  }

  async get(contentHash: string): Promise<ScanCacheEntry | null> {
    const state = await this.loadState()
    const entry = state.entries[contentHash]
    if (!entry) {
      return null
    }

    return {
      ...entry,
      reasons: [...entry.reasons],
    }
  }

  async set(contentHash: string, entry: ScanCacheEntry): Promise<void> {
    const state = await this.loadState()
    state.entries[contentHash] = {
      path: entry.path,
      skillName: entry.skillName,
      decision: entry.decision,
      risk: entry.risk,
      reasons: [...entry.reasons],
      scannedAt: entry.scannedAt,
    }
    await this.persist(state)
  }

  async list(): Promise<Array<{ contentHash: string; entry: ScanCacheEntry }>> {
    const state = await this.loadState()
    return Object.keys(state.entries)
      .sort()
      .map((contentHash) => ({
        contentHash,
        entry: {
          ...state.entries[contentHash]!,
          reasons: [...state.entries[contentHash]!.reasons],
        },
      }))
  }

  async clear(): Promise<void> {
    const state = await this.loadState()
    state.entries = createEntryMap()
    await this.persist(state)
  }

  async verify(): Promise<ScanCacheVerificationResult> {
    const state = await this.loadState()
    const expectedHmac = await this.computeHmac(state.entries)

    if (state.version === SCAN_CACHE_VERSION && hmacEqual(state.hmac, expectedHmac)) {
      return { valid: true }
    }

    state.version = SCAN_CACHE_VERSION
    state.entries = createEntryMap()
    await this.persist(state)
    return { valid: false }
  }

  private async loadState(): Promise<ScanCacheFileData> {
    if (this.state) {
      return this.state
    }

    try {
      const raw = await this.readFileFn(this.cachePath, 'utf8')
      const parsed = JSON.parse(raw) as unknown
      const data = this.normalizeState(parsed)
      this.state = data
      return data
    } catch {
      const empty = await this.createEmptyState()
      this.state = empty
      return empty
    }
  }

  private normalizeState(raw: unknown): ScanCacheFileData {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return {
        version: SCAN_CACHE_VERSION,
        hmac: '',
        entries: createEntryMap(),
      }
    }

    const record = raw as {
      version?: unknown
      hmac?: unknown
      entries?: unknown
    }

    const entries = normalizeEntries(record.entries)
    const hmac = typeof record.hmac === 'string' ? record.hmac : ''
    const version = typeof record.version === 'number' ? record.version : SCAN_CACHE_VERSION

    return {
      version,
      hmac,
      entries,
    }
  }

  private async createEmptyState(): Promise<ScanCacheFileData> {
    const entries = createEntryMap()
    return {
      version: SCAN_CACHE_VERSION,
      hmac: await this.computeHmac(entries),
      entries,
    }
  }

  private async persist(state: ScanCacheFileData): Promise<void> {
    const sorted = sortEntries(state.entries)
    state.entries = sorted
    state.version = SCAN_CACHE_VERSION
    state.hmac = await this.computeHmac(sorted)

    const payload = JSON.stringify(
      {
        version: state.version,
        hmac: state.hmac,
        entries: state.entries,
      },
      null,
      2
    )

    await this.writeFileFn(this.cachePath, `${payload}\n`)
  }

  private async computeHmac(entries: Record<string, ScanCacheEntry>): Promise<string> {
    const key = await this.getOrCreateHmacKey()
    const canonicalEntries = JSON.stringify(sortEntries(entries))
    return createHmac('sha256', key).update(canonicalEntries).digest('hex')
  }

  private async getOrCreateHmacKey(): Promise<Buffer> {
    if (this.hmacKey) {
      return this.hmacKey
    }

    const existing = await this.readExistingHmacKey()
    if (existing) {
      this.hmacKey = existing
      return existing
    }

    const generated = this.randomBytesFn(HMAC_KEY_BYTES)
    await this.writeBufferFileFn(this.hmacKeyPath, generated)
    this.hmacKey = Buffer.from(generated)
    return this.hmacKey
  }

  private async readExistingHmacKey(): Promise<Buffer | null> {
    try {
      const existing = await this.readBufferFileFn(this.hmacKeyPath)
      if (existing.length === HMAC_KEY_BYTES) {
        return Buffer.from(existing)
      }
      return null
    } catch {
      return null
    }
  }
}
