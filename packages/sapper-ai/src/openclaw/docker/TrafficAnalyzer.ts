import type { Honeytoken, HoneytokenFinding } from '@sapper-ai/types'

export interface TrafficAnalyzerOptions {
  knownHosts?: string[]
}

export interface TrafficAnalysisResult {
  exfiltrationDetected: boolean
  findings: HoneytokenFinding[]
  unknownHosts: string[]
}

interface HttpContext {
  protocol: 'http' | 'https'
  host: string
  requestPath?: string
}

const DEFAULT_KNOWN_HOSTS = ['localhost', 'proxy', 'openclaw', 'gateway', 'users-macbook']

const HTTP_URL_GLOBAL = /\bhttps?:\/\/([^\s\/:]+|\[[^\]\s]+\])(?::\d+)?([^\s]*)?/gi
const HTTP_URL_SINGLE = /\b(https?):\/\/([^\s\/:]+|\[[^\]\s]+\])(?::\d+)?([^\s]*)?/i
const HOST_HEADER = /\b(?:host|:authority)\s*:\s*([^\s,;]+)/i
const DOMAIN_GLOBAL = /\b([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9-]{1,63})*\.[a-z]{2,63})\b/gi

function normalizeHost(rawHost: string): string {
  let normalized = rawHost.trim().toLowerCase()
  normalized = normalized.replace(/^[\[("'`]+|[\])"'`.,;]+$/g, '')

  if (normalized.startsWith('[') && normalized.endsWith(']')) {
    normalized = normalized.slice(1, -1)
  }

  if (/^[a-z0-9.-]+:\d+$/.test(normalized)) {
    normalized = normalized.replace(/:\d+$/, '')
  }

  return normalized.replace(/\.$/, '')
}

function parseIpv4(host: string): number[] | null {
  const matched = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!matched) {
    return null
  }

  const octets = matched.slice(1).map((part) => Number.parseInt(part, 10))
  if (octets.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return null
  }

  return octets
}

function isLocalIpv4(host: string): boolean {
  const octets = parseIpv4(host)
  if (!octets) {
    return false
  }

  const first = octets[0]!
  const second = octets[1]!

  if (first === 10 || first === 127 || first === 0) {
    return true
  }

  if (first === 172 && second >= 16 && second <= 31) {
    return true
  }

  if (first === 192 && second === 168) {
    return true
  }

  return first === 169 && second === 254
}

function isLocalIpv6(host: string): boolean {
  const normalized = host.toLowerCase()
  if (normalized === '::1') {
    return true
  }

  return normalized.startsWith('fe80:') || normalized.startsWith('fc') || normalized.startsWith('fd')
}

function isLocalHost(host: string, knownHosts: Set<string>): boolean {
  if (!host) {
    return true
  }

  if (knownHosts.has(host)) {
    return true
  }

  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    return true
  }

  if (isLocalIpv4(host) || isLocalIpv6(host)) {
    return true
  }

  return /^[a-z0-9-]+$/.test(host)
}

function maybeDecodeUriComponent(value: string): string {
  if (!value.includes('%') && !value.includes('+')) {
    return value
  }

  const pieces = value.split(/(\s+)/)
  return pieces
    .map((piece) => {
      if (!piece.includes('%') && !piece.includes('+')) {
        return piece
      }

      try {
        return decodeURIComponent(piece.replace(/\+/g, '%20'))
      } catch {
        return piece
      }
    })
    .join('')
}

function includesPattern(line: string, searchPattern: string): boolean {
  if (!searchPattern) {
    return false
  }

  if (line.includes(searchPattern) || line.toLowerCase().includes(searchPattern.toLowerCase())) {
    return true
  }

  const decodedLine = maybeDecodeUriComponent(line)
  return (
    decodedLine.includes(searchPattern) || decodedLine.toLowerCase().includes(searchPattern.toLowerCase())
  )
}

function extractHttpContext(line: string): HttpContext | null {
  const matched = line.match(HTTP_URL_SINGLE)
  if (!matched) {
    return null
  }

  const protocol = matched[1]?.toLowerCase() === 'https' ? 'https' : 'http'
  const host = normalizeHost(matched[2] ?? '')
  const requestPath = matched[3] && matched[3].length > 0 ? matched[3] : '/'

  if (!host) {
    return null
  }

  return {
    protocol,
    host,
    requestPath,
  }
}

function extractHeaderHost(line: string): string | null {
  const matched = line.match(HOST_HEADER)
  if (!matched) {
    return null
  }

  const host = normalizeHost(matched[1] ?? '')
  return host.length > 0 ? host : null
}

function extractDnsHost(line: string): string | null {
  const lowered = line.toLowerCase()
  if (!lowered.includes('dns')) {
    return null
  }

  const matches = line.matchAll(DOMAIN_GLOBAL)
  for (const match of matches) {
    const candidate = normalizeHost(match[1] ?? '')
    if (candidate) {
      return candidate
    }
  }

  return null
}

function extractHosts(line: string): string[] {
  const hosts = new Set<string>()

  const urlMatches = line.matchAll(HTTP_URL_GLOBAL)
  for (const match of urlMatches) {
    const host = normalizeHost(match[1] ?? '')
    if (host) {
      hosts.add(host)
    }
  }

  const headerHost = extractHeaderHost(line)
  if (headerHost) {
    hosts.add(headerHost)
  }

  const dnsHost = extractDnsHost(line)
  if (dnsHost) {
    hosts.add(dnsHost)
  }

  const domainMatches = line.matchAll(DOMAIN_GLOBAL)
  for (const match of domainMatches) {
    const host = normalizeHost(match[1] ?? '')
    if (host) {
      hosts.add(host)
    }
  }

  return Array.from(hosts)
}

function inferProtocolFromLine(line: string): 'http' | 'https' {
  const lowered = line.toLowerCase()
  if (lowered.includes('https://') || lowered.includes(':443')) {
    return 'https'
  }

  return 'http'
}

function findingKey(finding: HoneytokenFinding): string {
  return `${finding.honeytoken.envVar}|${finding.protocol}|${finding.destination}|${finding.requestPath ?? ''}`
}

export class TrafficAnalyzer {
  private readonly knownHosts: Set<string>

  constructor(options: TrafficAnalyzerOptions = {}) {
    const knownHosts = (options.knownHosts ?? []).map((host) => normalizeHost(host)).filter(Boolean)
    this.knownHosts = new Set([...DEFAULT_KNOWN_HOSTS, ...knownHosts])
  }

  analyze(trafficDump: string, honeytokens: Honeytoken[]): TrafficAnalysisResult {
    const findingsByKey = new Map<string, HoneytokenFinding>()
    const observedHosts = new Set<string>()
    let currentHttpContext: HttpContext | null = null

    const lines = trafficDump.split(/\r?\n/)
    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (line.length === 0) {
        continue
      }

      const hostsInLine = extractHosts(line)
      for (const host of hostsInLine) {
        observedHosts.add(host)
      }

      const lineHttpContext = extractHttpContext(line)
      if (lineHttpContext) {
        currentHttpContext = lineHttpContext
      }

      const headerHost = extractHeaderHost(line)
      if (headerHost) {
        currentHttpContext = {
          protocol: currentHttpContext?.protocol ?? inferProtocolFromLine(line),
          host: headerHost,
          requestPath: currentHttpContext?.requestPath,
        }
      }

      const dnsHost = extractDnsHost(line)

      for (const honeytoken of honeytokens) {
        if (!includesPattern(line, honeytoken.searchPattern)) {
          continue
        }

        let finding: HoneytokenFinding

        if (dnsHost) {
          finding = {
            honeytoken,
            destination: dnsHost,
            protocol: 'dns',
          }
        } else if (lineHttpContext) {
          finding = {
            honeytoken,
            destination: lineHttpContext.host,
            protocol: lineHttpContext.protocol,
            requestPath: lineHttpContext.requestPath,
          }
        } else if (currentHttpContext) {
          finding = {
            honeytoken,
            destination: currentHttpContext.host,
            protocol: currentHttpContext.protocol,
            requestPath: currentHttpContext.requestPath,
          }
        } else {
          finding = {
            honeytoken,
            destination: 'unknown',
            protocol: 'http',
          }
        }

        findingsByKey.set(findingKey(finding), finding)
      }
    }

    const unknownHosts = Array.from(observedHosts)
      .filter((host) => !isLocalHost(host, this.knownHosts))
      .sort((left, right) => left.localeCompare(right))

    const findings = Array.from(findingsByKey.values())
    return {
      exfiltrationDetected: findings.length > 0,
      findings,
      unknownHosts,
    }
  }
}

export function analyzeTraffic(
  trafficDump: string,
  honeytokens: Honeytoken[],
  options: TrafficAnalyzerOptions = {}
): TrafficAnalysisResult {
  return new TrafficAnalyzer(options).analyze(trafficDump, honeytokens)
}
