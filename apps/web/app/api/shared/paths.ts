import { resolve } from 'node:path'

const DEFAULT_CONFIG = 'sapperai.config.yaml'
const DEFAULT_AUDIT_LOG = 'sapperai-audit.jsonl'

export function getConfigPath(): string {
  return process.env.SAPPERAI_CONFIG_PATH ?? resolve(process.cwd(), DEFAULT_CONFIG)
}

export function getAuditLogPath(): string {
  return process.env.SAPPERAI_AUDIT_LOG_PATH ?? resolve(process.cwd(), DEFAULT_AUDIT_LOG)
}

export function getIntelCachePath(): string | undefined {
  return process.env.SAPPERAI_THREAT_FEED_CACHE ?? undefined
}
