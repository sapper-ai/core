// Core logic for SapperAI

export const coreVersion = '0.2.0'

export { RulesDetector } from './detectors/RulesDetector'
export { LlmDetector } from './detectors/LlmDetector'
export { ThreatIntelDetector } from './detectors/ThreatIntelDetector'

export { DecisionEngine } from './engine/DecisionEngine'
export { PolicyManager, validatePolicy } from './engine/PolicyManager'
export { evaluatePolicyMatch, sha256 } from './engine/PolicyMatcher'
export { createDetectors } from './engine/DetectorFactory'
export { applyThreatIntelBlocklist } from './engine/ThreatIntelPolicy'
export { resolvePolicyPath } from './engine/PolicyPathResolver'
export type { PolicyPathSource, ResolvedPolicyPath, ResolvePolicyPathOptions } from './engine/PolicyPathResolver'

export { Scanner } from './guards/Scanner'
export { Guard } from './guards/Guard'

export { AuditLogger } from './logger/AuditLogger'
export { QuarantineManager } from './quarantine/QuarantineManager'
export type { QuarantineRecord } from './quarantine/QuarantineManager'
export { ThreatIntelStore } from './intel/ThreatIntelStore'
export { buildMatchListFromIntel } from './intel/ThreatIntelStore'
export { FindingScorer } from './adversary/FindingScorer'
export { SkillParser } from './parsers/SkillParser'
export type {
  IntelMatchList,
  ThreatIntelEntry,
  ThreatIntelSnapshot,
  ThreatIntelSyncResult,
  ThreatIndicatorType,
} from './intel/ThreatIntelStore'
export type { ParsedSkill } from './parsers/SkillParser'

export {
  buildEntryName,
  classifyTargetType,
  collectMcpTargetsFromJson,
  isConfigLikeFile,
  normalizeSurfaceText,
} from './discovery/DiscoveryUtils'
export type { DiscoveryTarget, DiscoveryTargetType } from './discovery/DiscoveryUtils'
