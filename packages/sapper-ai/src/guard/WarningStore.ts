import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { atomicWriteFile } from '../utils/fs'

import type { DismissedWarning, SkillWarning } from './types'

const WARNING_STORE_VERSION = 1
const WARNING_DIR = '.sapper-ai'
const WARNING_FILE = 'warnings.json'
const PRIVATE_FILE_MODE = 0o600

interface WarningStoreState {
  version: number
  pending: SkillWarning[]
  acknowledged: SkillWarning[]
  dismissed: DismissedWarning[]
}

export interface WarningStoreOptions {
  filePath?: string
  homeDir?: string
  now?: () => number
  readFileFn?: (filePath: string, encoding: BufferEncoding) => Promise<string>
  writeFileFn?: (filePath: string, content: string) => Promise<void>
}

function cloneWarning(warning: SkillWarning): SkillWarning {
  return {
    skillName: warning.skillName,
    skillPath: warning.skillPath,
    contentHash: warning.contentHash,
    risk: warning.risk,
    reasons: [...warning.reasons],
    detectedAt: warning.detectedAt,
  }
}

function cloneDismissed(dismissed: DismissedWarning): DismissedWarning {
  return {
    skillName: dismissed.skillName,
    contentHash: dismissed.contentHash,
    dismissedAt: dismissed.dismissedAt,
  }
}

function normalizeWarning(value: unknown): SkillWarning | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const warning = value as {
    skillName?: unknown
    skillPath?: unknown
    contentHash?: unknown
    risk?: unknown
    reasons?: unknown
    detectedAt?: unknown
  }

  if (typeof warning.skillName !== 'string' || warning.skillName.length === 0) {
    return null
  }
  if (typeof warning.skillPath !== 'string' || warning.skillPath.length === 0) {
    return null
  }
  if (typeof warning.contentHash !== 'string' || warning.contentHash.length === 0) {
    return null
  }
  if (typeof warning.risk !== 'number' || !Number.isFinite(warning.risk)) {
    return null
  }
  if (!Array.isArray(warning.reasons) || warning.reasons.some((reason) => typeof reason !== 'string')) {
    return null
  }
  if (typeof warning.detectedAt !== 'string' || warning.detectedAt.length === 0) {
    return null
  }

  return {
    skillName: warning.skillName,
    skillPath: warning.skillPath,
    contentHash: warning.contentHash,
    risk: warning.risk,
    reasons: [...warning.reasons],
    detectedAt: warning.detectedAt,
  }
}

function normalizeDismissed(value: unknown): DismissedWarning | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const dismissed = value as {
    skillName?: unknown
    contentHash?: unknown
    dismissedAt?: unknown
  }

  if (typeof dismissed.skillName !== 'string' || dismissed.skillName.length === 0) {
    return null
  }
  if (dismissed.contentHash !== undefined && typeof dismissed.contentHash !== 'string') {
    return null
  }
  if (typeof dismissed.dismissedAt !== 'string' || dismissed.dismissedAt.length === 0) {
    return null
  }

  return {
    skillName: dismissed.skillName,
    contentHash: dismissed.contentHash,
    dismissedAt: dismissed.dismissedAt,
  }
}

function normalizeWarningList(value: unknown): SkillWarning[] {
  if (!Array.isArray(value)) {
    return []
  }

  const warnings: SkillWarning[] = []
  for (const warning of value) {
    const normalized = normalizeWarning(warning)
    if (!normalized) {
      continue
    }
    warnings.push(normalized)
  }
  return warnings
}

function normalizeDismissedList(value: unknown): DismissedWarning[] {
  if (!Array.isArray(value)) {
    return []
  }

  const dismissedList: DismissedWarning[] = []
  for (const dismissed of value) {
    const normalized = normalizeDismissed(dismissed)
    if (!normalized) {
      continue
    }
    dismissedList.push(normalized)
  }
  return dismissedList
}

function isSameWarning(left: SkillWarning, right: SkillWarning): boolean {
  return (
    left.skillName === right.skillName &&
    left.skillPath === right.skillPath &&
    left.contentHash === right.contentHash
  )
}

function hasDismissedMatch(dismissed: DismissedWarning, skillName: string, contentHash: string): boolean {
  if (dismissed.skillName !== skillName) {
    return false
  }

  if (!dismissed.contentHash) {
    return true
  }

  return dismissed.contentHash === contentHash
}

export class WarningStore {
  private readonly filePath: string
  private readonly now: () => number
  private readonly readFileFn: (filePath: string, encoding: BufferEncoding) => Promise<string>
  private readonly writeFileFn: (filePath: string, content: string) => Promise<void>
  private state: WarningStoreState | null = null

  constructor(options: WarningStoreOptions = {}) {
    this.filePath = options.filePath ?? join(options.homeDir ?? homedir(), WARNING_DIR, WARNING_FILE)
    this.now = options.now ?? Date.now
    this.readFileFn = options.readFileFn ?? readFile
    this.writeFileFn =
      options.writeFileFn ??
      ((filePath: string, content: string) => atomicWriteFile(filePath, content, { mode: PRIVATE_FILE_MODE }))
  }

  async addPending(warning: SkillWarning): Promise<void> {
    const state = await this.loadState()
    const normalized = this.normalizeInputWarning(warning)

    if (this.isDismissedInState(state, normalized.skillName, normalized.contentHash)) {
      return
    }

    const existingIndex = state.pending.findIndex(
      (entry) => entry.skillName === normalized.skillName && entry.skillPath === normalized.skillPath
    )

    if (existingIndex >= 0) {
      state.pending[existingIndex] = normalized
    } else {
      state.pending.push(normalized)
    }

    await this.persist(state)
  }

  async getPending(): Promise<SkillWarning[]> {
    const state = await this.loadState()
    return state.pending.map(cloneWarning)
  }

  async getAcknowledged(): Promise<SkillWarning[]> {
    const state = await this.loadState()
    return state.acknowledged.map(cloneWarning)
  }

  async getDismissed(): Promise<DismissedWarning[]> {
    const state = await this.loadState()
    return state.dismissed.map(cloneDismissed)
  }

  async isDismissed(skillName: string, contentHash: string): Promise<boolean> {
    const state = await this.loadState()
    return this.isDismissedInState(state, skillName, contentHash)
  }

  async acknowledge(skillName: string, skillPath?: string): Promise<number> {
    const state = await this.loadState()

    const matched = state.pending.filter((entry) =>
      skillPath ? entry.skillName === skillName && entry.skillPath === skillPath : entry.skillName === skillName
    )

    if (matched.length === 0) {
      return 0
    }

    state.pending = state.pending.filter((entry) =>
      skillPath ? !(entry.skillName === skillName && entry.skillPath === skillPath) : entry.skillName !== skillName
    )

    for (const warning of matched) {
      const alreadyAcknowledged = state.acknowledged.some((entry) => isSameWarning(entry, warning))
      if (!alreadyAcknowledged) {
        state.acknowledged.push(cloneWarning(warning))
      }
    }

    await this.persist(state)
    return matched.length
  }

  async acknowledgeAll(warnings: SkillWarning[]): Promise<number> {
    if (warnings.length === 0) {
      return 0
    }

    const state = await this.loadState()
    const targetKeys = new Set(
      warnings.map((warning) => `${warning.skillName}\u0000${warning.skillPath}`)
    )

    let movedCount = 0
    const nextPending: SkillWarning[] = []
    for (const warning of state.pending) {
      const key = `${warning.skillName}\u0000${warning.skillPath}`
      if (!targetKeys.has(key)) {
        nextPending.push(warning)
        continue
      }

      movedCount += 1
      const alreadyAcknowledged = state.acknowledged.some((entry) => isSameWarning(entry, warning))
      if (!alreadyAcknowledged) {
        state.acknowledged.push(cloneWarning(warning))
      }
    }

    if (movedCount === 0) {
      return 0
    }

    state.pending = nextPending
    await this.persist(state)
    return movedCount
  }

  async dismiss(skillName: string): Promise<number> {
    const state = await this.loadState()
    const matchedWarnings = [
      ...state.pending.filter((entry) => entry.skillName === skillName),
      ...state.acknowledged.filter((entry) => entry.skillName === skillName),
    ]

    state.pending = state.pending.filter((entry) => entry.skillName !== skillName)
    state.acknowledged = state.acknowledged.filter((entry) => entry.skillName !== skillName)
    state.dismissed = state.dismissed.filter((entry) => entry.skillName !== skillName)
    state.dismissed.push({
      skillName,
      dismissedAt: new Date(this.now()).toISOString(),
    })

    await this.persist(state)
    return matchedWarnings.length
  }

  async clearPending(): Promise<void> {
    const state = await this.loadState()
    state.pending = []
    await this.persist(state)
  }

  async replacePending(warnings: SkillWarning[]): Promise<void> {
    const state = await this.loadState()
    const nextPending: SkillWarning[] = []

    for (const warning of warnings) {
      const normalized = this.normalizeInputWarning(warning)
      if (this.isDismissedInState(state, normalized.skillName, normalized.contentHash)) {
        continue
      }

      const duplicate = nextPending.some(
        (entry) =>
          entry.skillName === normalized.skillName &&
          entry.skillPath === normalized.skillPath &&
          entry.contentHash === normalized.contentHash
      )

      if (!duplicate) {
        nextPending.push(normalized)
      }
    }

    state.pending = nextPending
    await this.persist(state)
  }

  private normalizeInputWarning(warning: SkillWarning): SkillWarning {
    const normalized = normalizeWarning(warning)
    if (!normalized) {
      throw new Error('Invalid warning payload')
    }
    return normalized
  }

  private isDismissedInState(state: WarningStoreState, skillName: string, contentHash: string): boolean {
    return state.dismissed.some((entry) => hasDismissedMatch(entry, skillName, contentHash))
  }

  private async loadState(): Promise<WarningStoreState> {
    if (this.state) {
      return this.state
    }

    try {
      const raw = await this.readFileFn(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as unknown
      const normalized = this.normalizeState(parsed)
      this.state = normalized
      return normalized
    } catch {
      const empty = this.createEmptyState()
      this.state = empty
      return empty
    }
  }

  private normalizeState(raw: unknown): WarningStoreState {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return this.createEmptyState()
    }

    const record = raw as {
      version?: unknown
      pending?: unknown
      acknowledged?: unknown
      dismissed?: unknown
    }

    const version = typeof record.version === 'number' ? record.version : WARNING_STORE_VERSION

    return {
      version,
      pending: normalizeWarningList(record.pending),
      acknowledged: normalizeWarningList(record.acknowledged),
      dismissed: normalizeDismissedList(record.dismissed),
    }
  }

  private createEmptyState(): WarningStoreState {
    return {
      version: WARNING_STORE_VERSION,
      pending: [],
      acknowledged: [],
      dismissed: [],
    }
  }

  private async persist(state: WarningStoreState): Promise<void> {
    state.version = WARNING_STORE_VERSION

    const payload = JSON.stringify(
      {
        version: state.version,
        pending: state.pending,
        acknowledged: state.acknowledged,
        dismissed: state.dismissed,
      },
      null,
      2
    )

    await this.writeFileFn(this.filePath, `${payload}\n`)
  }
}
