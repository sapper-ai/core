import { basename, dirname } from 'node:path'

export type DiscoveryTargetType = 'mcp_server' | 'skill' | 'agent' | 'plugin' | 'config'

export interface DiscoveryTarget {
  type: DiscoveryTargetType
  name: string
  source: string
  surface: string
}

const MAX_TEXT_LENGTH = 4000

const SECRET_PATTERNS = [
  /(figd_[A-Za-z0-9_\-]+)/g,
  /(sk-[A-Za-z0-9_-]{12,})/g,
  /(api[_-]?key\s*[:=]\s*["']?)[^\s"']+/gi,
  /(token\s*[:=]\s*["']?)[^\s"']+/gi,
]

function redactSecrets(input: string): string {
  let output = input

  for (const pattern of SECRET_PATTERNS) {
    output = output.replace(pattern, (...args: unknown[]) => {
      const match = typeof args[1] === 'string' ? args[1] : null
      if (match) {
        return `${match.slice(0, Math.min(match.length, 8))}***REDACTED***`
      }

      return '***REDACTED***'
    })
  }

  return output
}

export function normalizeSurfaceText(input: string): string {
  const text = redactSecrets(input)

  if (text.length <= MAX_TEXT_LENGTH) {
    return text
  }

  return `${text.slice(0, MAX_TEXT_LENGTH)}...`
}

export function isConfigLikeFile(filePath: string): boolean {
  const base = basename(filePath).toLowerCase()

  if (base === '.mcp.json' || base === 'mcp.json' || base === 'config.json' || base === 'settings.json') {
    return true
  }

  if (base === 'plugin.json' || base === 'marketplace.json' || base === 'installed_plugins.json') {
    return true
  }

  if (base === 'skill.md' || base === 'agents.md') {
    return true
  }

  return filePath.endsWith('.mcp.json')
}

export function classifyTargetType(filePath: string): DiscoveryTargetType {
  const normalized = filePath.toLowerCase()

  if (normalized.endsWith('.mcp.json') || normalized.includes('/mcp')) {
    return 'mcp_server'
  }

  if (normalized.includes('/skills/') || normalized.endsWith('/skill.md')) {
    return 'skill'
  }

  if (normalized.includes('/agents/') || normalized.endsWith('/agents.md')) {
    return 'agent'
  }

  if (normalized.includes('/plugins/')) {
    return 'plugin'
  }

  return 'config'
}

export function buildEntryName(filePath: string): string {
  return `${basename(dirname(filePath))}/${basename(filePath)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function collectMcpTargetsFromJson(filePath: string, data: unknown): DiscoveryTarget[] {
  if (!isRecord(data)) {
    return []
  }

  const maybeServers = data.mcpServers
  if (!isRecord(maybeServers)) {
    return []
  }

  const targets: DiscoveryTarget[] = []

  for (const [serverName, config] of Object.entries(maybeServers)) {
    targets.push({
      type: 'mcp_server',
      name: String(serverName),
      source: filePath,
      surface: normalizeSurfaceText(JSON.stringify(config, null, 2)),
    })
  }

  return targets
}
