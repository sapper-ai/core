// Core logic for SapperAI
import { version } from '@sapperai/types'

export const coreVersion = version

export { RulesDetector } from './detectors/RulesDetector'
export { LlmDetector } from './detectors/LlmDetector'

export { DecisionEngine } from './engine/DecisionEngine'
export { PolicyManager, validatePolicy } from './engine/PolicyManager'

export { Scanner } from './guards/Scanner'
export { Guard } from './guards/Guard'

export { AuditLogger } from './logger/AuditLogger'
