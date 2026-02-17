export type GuardDecision = 'safe' | 'suspicious'

export interface SingleSkillScanResult {
  skillName: string
  skillPath: string
  contentHash: string
  decision: GuardDecision
  risk: number
  reasons: string[]
}

export interface ScanCacheEntry {
  path: string
  skillName: string
  decision: GuardDecision
  risk: number
  reasons: string[]
  scannedAt: string
}

export interface ScanCacheVerificationResult {
  valid: boolean
}

export interface SkillWarning {
  skillName: string
  skillPath: string
  contentHash: string
  risk: number
  reasons: string[]
  detectedAt: string
}

export interface DismissedWarning {
  skillName: string
  contentHash?: string
  dismissedAt: string
}

export interface GuardHookOutput {
  suppressPrompt: boolean
  message?: string
  warnings?: SkillWarning[]
  summary?: Record<string, boolean | number | string>
}

export interface OutputWriter {
  write: (chunk: string) => unknown
}
