// Core logic for SapperAI
import { version } from '@sapper-ai/types'

export const coreVersion = version

export { RulesDetector } from './detectors/RulesDetector'
export { LlmDetector } from './detectors/LlmDetector'
export { ThreatIntelDetector } from './detectors/ThreatIntelDetector'

export { DecisionEngine } from './engine/DecisionEngine'
export { PolicyManager, validatePolicy } from './engine/PolicyManager'
export { evaluatePolicyMatch, sha256 } from './engine/PolicyMatcher'

export { Scanner } from './guards/Scanner'
export { Guard } from './guards/Guard'

export { AuditLogger } from './logger/AuditLogger'
export { QuarantineManager } from './quarantine/QuarantineManager'
export type { QuarantineRecord } from './quarantine/QuarantineManager'
export { ThreatIntelStore } from './intel/ThreatIntelStore'
export { buildMatchListFromIntel } from './intel/ThreatIntelStore'
export { FindingScorer } from './adversary/FindingScorer'
export type {
  IntelMatchList,
  ThreatIntelEntry,
  ThreatIntelSnapshot,
  ThreatIntelSyncResult,
  ThreatIndicatorType,
} from './intel/ThreatIntelStore'

export {
  buildEntryName,
  classifyTargetType,
  collectMcpTargetsFromJson,
  isConfigLikeFile,
  normalizeSurfaceText,
} from './discovery/DiscoveryUtils'
export type { DiscoveryTarget, DiscoveryTargetType } from './discovery/DiscoveryUtils'
