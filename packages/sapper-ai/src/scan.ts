import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'

import {
  buildEntryName,
  classifyTargetType,
  collectMcpTargetsFromJson,
  createDetectors,
  isConfigLikeFile,
  normalizeSurfaceText,
  PolicyManager,
  QuarantineManager,
  resolvePolicyPath,
  Scanner,
} from '@sapper-ai/core'
import type { Decision, LlmConfig, Policy } from '@sapper-ai/types'

import { getAuthPath, loadOpenAiApiKey, promptAndSaveOpenAiApiKey } from './auth'
import { presets } from './presets'
import { createProgressBar } from './utils/progress'
import { createColors, header, padLeft, padRightVisual, riskColor, table, truncateToWidth } from './utils/format'
import { findRepoRoot } from './utils/repoRoot'

export interface ScanOptions {
  targets?: string[]
  policyPath?: string
  fix?: boolean
  deep?: boolean
  system?: boolean
  scopeLabel?: string
  ai?: boolean
  noSave?: boolean
  noOpen?: boolean
  noPrompt?: boolean
  noColor?: boolean
}

interface ScanFinding {
  filePath: string
  decision: Decision
  quarantinedId?: string
  aiAnalysis?: string | null
  source?: 'rules' | 'ai'
}

interface ScanFileResult {
  scanned: boolean
  decision?: Decision
  quarantinedId?: string
  skipReason?: 'not_eligible' | 'empty_or_unreadable'
}

export interface ScanResult {
  version: '1.0'
  timestamp: string
  scope: string
  target: string
  ai: boolean
  filters: {
    configLikeOnly: boolean
  }
  summary: {
    totalFiles: number
    eligibleFiles: number
    scannedFiles: number
    skippedFiles: number
    skippedNotEligible: number
    skippedEmptyOrUnreadable: number
    threats: number
  }
  findings: Array<{
    filePath: string
    risk: number
    confidence: number
    action: string
    patterns: string[]
    reasons: string[]
    snippet: string
    detectors: string[]
    aiAnalysis: string | null
    ruleMatches: Array<{
      label: string
      severity: 'high' | 'medium'
      matchText: string
      context: string
    }>
  }>
}

const SYSTEM_SCAN_PATHS = (() => {
  const home = homedir()
  return [
    join(home, '.claude'),
    join(home, '.config', 'claude-code'),
    join(home, '.cursor'),
    join(home, '.vscode', 'extensions'),
    join(home, 'Library', 'Application Support', 'Claude'),
  ]
})()

function resolvePolicy(cwd: string, options: { policyPath?: string }): Policy {
  const manager = new PolicyManager()

  const explicitPath = options.policyPath ?? process.env.SAPPERAI_POLICY_PATH
  if (explicitPath) {
    return manager.loadFromFile(explicitPath)
  }

  const repoRoot = findRepoRoot(cwd)
  const resolved = resolvePolicyPath({ repoRoot, homeDir: homedir() })
  if (!resolved) {
    return { ...presets.standard.policy }
  }

  return manager.loadFromFile(resolved.path)
}

function getThresholds(policy: Policy): { riskThreshold: number; blockMinConfidence: number } {
  const extended = policy as Policy & {
    thresholds?: {
      riskThreshold?: unknown
      blockMinConfidence?: unknown
    }
  }

  const riskThreshold =
    typeof extended.thresholds?.riskThreshold === 'number' ? extended.thresholds.riskThreshold : 0.7
  const blockMinConfidence =
    typeof extended.thresholds?.blockMinConfidence === 'number' ? extended.thresholds.blockMinConfidence : 0.5

  return { riskThreshold, blockMinConfidence }
}

function shouldSkipDir(dirName: string): boolean {
  const base = basename(dirName)
  return base === 'node_modules' || base === '.git' || base === 'dist'
}

async function collectFiles(targetPath: string, deep: boolean): Promise<string[]> {
  try {
    const info = await stat(targetPath)
    if (info.isFile()) {
      return [targetPath]
    }
    if (!info.isDirectory()) {
      return []
    }
  } catch {
    return []
  }

  if (!deep) {
    try {
      const entries = await readdir(targetPath, { withFileTypes: true })
      const results: string[] = []
      for (const entry of entries) {
        if (!entry.isFile()) continue
        results.push(join(targetPath, entry.name))
      }
      return results
    } catch {
      return []
    }
  }

  const results: string[] = []
  const stack: string[] = [targetPath]

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) continue

    let entries
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      const fullPath = join(current, entry.name)

      if (entry.isDirectory()) {
        if (shouldSkipDir(fullPath)) {
          continue
        }
        stack.push(fullPath)
        continue
      }

      if (entry.isFile()) {
        results.push(fullPath)
      }
    }
  }

  return results
}

function extractPatternLabel(decision: Decision): string {
  const reason = decision.reasons[0]
  if (!reason) return 'threat'
  return reason.startsWith('Detected pattern: ') ? reason.slice('Detected pattern: '.length) : reason
}

function renderFindingsTable(
  findings: ScanFinding[],
  opts: { cwd: string; columns: number; colors: ReturnType<typeof createColors>; includeSource?: boolean }
): string {
  const riskWidth = 4
  const patternWidth = Math.min(20, Math.max('Pattern'.length, ...findings.map((f) => extractPatternLabel(f.decision).length)))
  const sourceWidth = opts.includeSource ? Math.max('Source'.length, 5) : 0

  const maxTableWidth = Math.max(60, Math.min(opts.columns || 80, 120))
  const sepWidth = 2
  const baseWidth =
    'File'.length + sepWidth + riskWidth + sepWidth + patternWidth + (opts.includeSource ? sepWidth + sourceWidth : 0)
  const fileWidth = Math.max(20, Math.min(50, maxTableWidth - baseWidth))

  const headers = opts.includeSource ? ['File', 'Risk', 'Pattern', 'Source'] : ['File', 'Risk', 'Pattern']

  const rows = findings.map((f) => {
    const relative = f.filePath.startsWith(opts.cwd + '/') ? f.filePath.slice(opts.cwd.length + 1) : f.filePath
    const file = truncateToWidth(relative, fileWidth)

    const label = extractPatternLabel(f.decision)
    const patternPlain = truncateToWidth(label, patternWidth)
    const pattern = `${opts.colors.dim}${patternPlain}${opts.colors.reset}`

    const riskValue = f.decision.risk.toFixed(2)
    const riskPlain = padLeft(riskValue, riskWidth)
    const risk = `${riskColor(f.decision.risk, opts.colors)}${riskPlain}${opts.colors.reset}`

    if (!opts.includeSource) {
      return [file, risk, pattern]
    }

    const src = f.source === 'ai' ? `${opts.colors.olive}ai${opts.colors.reset}` : `${opts.colors.dim}rules${opts.colors.reset}`
    return [file, risk, pattern, src]
  })

  return table(headers, rows, opts.colors)
}

function isThreat(decision: Decision, policy: Policy): boolean {
  const { riskThreshold, blockMinConfidence } = getThresholds(policy)
  return decision.risk >= riskThreshold && decision.confidence >= blockMinConfidence
}

async function readFileIfPresent(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf8')
  } catch {
    return null
  }
}

async function scanFile(
  filePath: string,
  policy: Policy,
  scanner: Scanner,
  detectors: ReturnType<typeof createDetectors>,
  fix: boolean,
  quarantineManager: QuarantineManager
): Promise<ScanFileResult> {
  if (!isConfigLikeFile(filePath)) {
    return { scanned: false, skipReason: 'not_eligible' }
  }

  const raw = await readFileIfPresent(filePath)
  if (raw === null || raw.trim().length === 0) {
    return { scanned: false, skipReason: 'empty_or_unreadable' }
  }

  const fileSurface = normalizeSurfaceText(raw)
  const targetType = classifyTargetType(filePath)
  const targets: Array<{ id: string; surface: string; meta: Record<string, unknown> }> = [
    {
      id: `${targetType}:${buildEntryName(filePath)}`,
      surface: fileSurface,
      meta: {
        scanSource: 'file_surface',
        sourcePath: filePath,
        sourceType: targetType,
      },
    },
  ]

  if (filePath.endsWith('.json')) {
    try {
      const parsed = JSON.parse(raw) as unknown
      const mcpTargets = collectMcpTargetsFromJson(filePath, parsed)
      for (const t of mcpTargets) {
        targets.push({
          id: `${t.type}:${t.name}`,
          surface: t.surface,
          meta: {
            scanSource: 'file_surface',
            sourcePath: t.source,
            sourceType: t.type,
          },
        })
      }
    } catch {
    }
  }

  let bestDecision: Decision | null = null
  let bestThreat: Decision | null = null

  for (const target of targets) {
    const decision = await scanner.scanTool(target.id, target.surface, policy, detectors, target.meta)

    if (!bestDecision || decision.risk > bestDecision.risk) {
      bestDecision = decision
    }

    if (!isThreat(decision, policy)) {
      continue
    }

    if (!bestThreat || decision.risk > bestThreat.risk) {
      bestThreat = decision
    }

    if (fix && decision.action === 'block') {
      try {
        const record = await quarantineManager.quarantine(filePath, decision)
        return { scanned: true, decision: bestDecision ?? decision, quarantinedId: record.id }
      } catch {
      }
    }
  }

  if (!bestDecision) {
    return { scanned: false }
  }

  return { scanned: true, decision: bestThreat ?? bestDecision }
}

function uniq<T>(values: T[]): T[] {
  return Array.from(new Set(values))
}

function extractPatternsFromReasons(reasons: string[]): string[] {
  const prefix = 'Detected pattern: '
  const patterns: string[] = []
  for (const r of reasons) {
    if (r.startsWith(prefix)) {
      patterns.push(r.slice(prefix.length))
    }
  }
  return patterns
}

function toDetectorsList(decision: Decision): string[] {
  return uniq(decision.evidence.map((e) => e.detectorId))
}

function extractRuleMatches(decision: Decision): Array<{
  label: string
  severity: 'high' | 'medium'
  matchText: string
  context: string
}> {
  const evidence = Array.isArray(decision.evidence) ? decision.evidence : []
  const output = evidence.find((e) => e && e.detectorId === 'rules')
  if (!output || !output.evidence || typeof output.evidence !== 'object') {
    return []
  }

  const maybeMatches = (output.evidence as { matches?: unknown }).matches
  if (!Array.isArray(maybeMatches)) {
    return []
  }

  const results: Array<{ label: string; severity: 'high' | 'medium'; matchText: string; context: string }> = []
  for (const m of maybeMatches) {
    if (!m || typeof m !== 'object') continue
    const match = m as { label?: unknown; severity?: unknown; matchText?: unknown; context?: unknown; sample?: unknown }

    const label = typeof match.label === 'string' ? match.label : ''
    const severity = match.severity === 'high' ? 'high' : 'medium'
    const matchText = typeof match.matchText === 'string' ? match.matchText : ''
    const context =
      typeof match.context === 'string'
        ? match.context
        : typeof match.sample === 'string'
          ? match.sample
          : ''

    if (!label || !matchText) continue
    results.push({ label, severity, matchText, context })
    if (results.length >= 24) break
  }

  return results
}

function truncateSnippet(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text
  }
  return text.slice(0, maxChars)
}

async function buildScanResult(params: {
  scope: string
  target: string
  ai: boolean
  totalFiles: number
  eligibleFiles: number
  scannedFiles: number
  skippedFiles: number
  skippedNotEligible: number
  skippedEmptyOrUnreadable: number
  threats: number
  findings: ScanFinding[]
}): Promise<ScanResult> {
  const timestamp = new Date().toISOString()

  const findings = await Promise.all(
    params.findings.map(async (f) => {
      const raw = await readFileIfPresent(f.filePath)
      const snippet = raw ? truncateSnippet(raw, 400) : ''

      const reasons = f.decision.reasons
      const patterns = extractPatternsFromReasons(reasons)
      const detectors = toDetectorsList(f.decision)
      const ruleMatches = extractRuleMatches(f.decision)

      return {
        filePath: f.filePath,
        risk: f.decision.risk,
        confidence: f.decision.confidence,
        action: f.decision.action,
        patterns,
        reasons,
        snippet,
        detectors,
        aiAnalysis: f.aiAnalysis ?? null,
        ruleMatches,
      }
    })
  )

  return {
    version: '1.0',
    timestamp,
    scope: params.scope,
    target: params.target,
    ai: params.ai,
    filters: {
      configLikeOnly: true,
    },
    summary: {
      totalFiles: params.totalFiles,
      eligibleFiles: params.eligibleFiles,
      scannedFiles: params.scannedFiles,
      skippedFiles: params.skippedFiles,
      skippedNotEligible: params.skippedNotEligible,
      skippedEmptyOrUnreadable: params.skippedEmptyOrUnreadable,
      threats: params.threats,
    },
    findings,
  }
}

export async function runScan(options: ScanOptions = {}): Promise<number> {
  const cwd = process.cwd()
  const colors = createColors({ noColor: options.noColor })
  const policy = resolvePolicy(cwd, { policyPath: options.policyPath })
  const fix = options.fix === true

  console.log(`\n${header('scan', colors)}\n`)

  const aiEnabled = options.ai === true
  let llmConfig: LlmConfig | null = null

  if (aiEnabled) {
    let apiKey = await loadOpenAiApiKey()
    if (!apiKey) {
      const canPrompt =
        options.noPrompt !== true && process.stdout.isTTY === true && process.stdin.isTTY === true

      if (!canPrompt) {
        console.log('  Error: OPENAI_API_KEY environment variable is required for --ai mode.\n')
        return 1
      }

      console.log('  No OpenAI API key found.\n')
      console.log(`  ${colors.olive}Get one at https://platform.openai.com/api-keys${colors.reset}`)
      console.log()

      apiKey = await promptAndSaveOpenAiApiKey()
      if (!apiKey) {
        console.log('\n  Error: API key is required for --ai mode.\n')
        return 1
      }

      const authPath = getAuthPath()
      const home = homedir()
      const displayAuthPath =
        authPath === home ? '~' : authPath.startsWith(home + '/') ? `~/${authPath.slice(home.length + 1)}` : authPath
      console.log()
      console.log(`${colors.dim}  Key saved to ${displayAuthPath}${colors.reset}`)
      console.log()
    }
    llmConfig = { provider: 'openai', apiKey, model: 'gpt-4.1-mini' }
  }

  const deep = options.system ? true : options.deep !== false
  const targets =
    options.system === true
      ? SYSTEM_SCAN_PATHS
      : options.targets && options.targets.length > 0
        ? options.targets
        : [cwd]

  const scanner = new Scanner()
  const detectors = createDetectors({ policy, preferredDetectors: ['rules'] })
  const quarantineDir = process.env.SAPPERAI_QUARANTINE_DIR
  const quarantineManager = quarantineDir ? new QuarantineManager({ quarantineDir }) : new QuarantineManager()

  const fileSet = new Set<string>()
  for (const target of targets) {
    const files = await collectFiles(target, deep)
    for (const f of files) {
      fileSet.add(f)
    }
  }

  const files = Array.from(fileSet).sort()
  const eligibleFiles = files.filter((f) => isConfigLikeFile(f))
  const eligibleByName = eligibleFiles.length
  const skippedNotEligible = Math.max(0, files.length - eligibleByName)

  console.log(`${colors.dim}  Scanning ${eligibleByName} files...${colors.reset}`)
  console.log()

  const scannedFindings: ScanFinding[] = []
  let scannedFiles = 0
  let skippedEmptyOrUnreadable = 0

  const rulesProgress = createProgressBar({
    label: aiEnabled ? 'Phase 1 rules' : 'Scan',
    total: eligibleFiles.length,
    colors,
  })

  rulesProgress.start()
  try {
    for (const filePath of eligibleFiles) {
      try {
        const result = await scanFile(filePath, policy, scanner, detectors, fix, quarantineManager)

        if (result.skipReason === 'empty_or_unreadable') {
          skippedEmptyOrUnreadable += 1
          continue
        }

        if (result.scanned && result.decision) {
          scannedFiles += 1
          scannedFindings.push({
            filePath,
            decision: result.decision,
            quarantinedId: result.quarantinedId,
            source: aiEnabled ? 'rules' : undefined,
          })
        }
      } finally {
        rulesProgress.tick(filePath)
      }
    }
  } finally {
    rulesProgress.done()
  }

  let aiTargetsCount = 0

  if (aiEnabled && llmConfig) {
    const suspiciousFindings = scannedFindings.filter((f) => f.decision.risk >= 0.5)
    const maxAiFiles = 50

    if (suspiciousFindings.length > 0) {
      const aiTargets = suspiciousFindings.slice(0, maxAiFiles)
      aiTargetsCount = aiTargets.length

      const detectorsList = (policy.detectors ?? ['rules']).slice()
      if (!detectorsList.includes('llm')) {
        detectorsList.push('llm')
      }

      const aiPolicy: Policy = { ...policy, llm: llmConfig, detectors: detectorsList }
      const aiDetectors = createDetectors({ policy: aiPolicy, preferredDetectors: ['rules', 'llm'] })

      const aiProgress = createProgressBar({
        label: 'Phase 2 ai',
        total: aiTargets.length,
        colors,
      })

      aiProgress.start()
      try {
        for (const finding of aiTargets) {
          try {
            const raw = await readFileIfPresent(finding.filePath)
            if (!raw) continue
            const surface = normalizeSurfaceText(raw)
            const targetType = classifyTargetType(finding.filePath)
            const id = `${targetType}:${buildEntryName(finding.filePath)}`
            const aiDecision = await scanner.scanTool(id, surface, aiPolicy, aiDetectors, {
              scanSource: 'file_surface',
              sourcePath: finding.filePath,
              sourceType: targetType,
            })

            const aiDominates = aiDecision.risk > finding.decision.risk
            const mergedReasons = aiDominates
              ? uniq([...aiDecision.reasons, ...finding.decision.reasons])
              : uniq([...finding.decision.reasons, ...aiDecision.reasons])
            const existingEvidence = finding.decision.evidence
            const mergedEvidence = [...existingEvidence]
            for (const ev of aiDecision.evidence) {
              if (!mergedEvidence.some((e) => e.detectorId === ev.detectorId)) {
                mergedEvidence.push(ev)
              }
            }

            const nextDecision = {
              ...finding.decision,
              reasons: mergedReasons,
              evidence: mergedEvidence,
            }

            if (aiDominates) {
              finding.source = 'ai'
              finding.decision = {
                ...nextDecision,
                action: aiDecision.action,
                risk: aiDecision.risk,
                confidence: aiDecision.confidence,
              }
            } else {
              finding.source = finding.source ?? 'rules'
              finding.decision = nextDecision
            }

            finding.aiAnalysis =
              aiDecision.reasons.find((r) => !r.startsWith('Detected pattern:')) ?? null
          } catch {
          } finally {
            aiProgress.tick(finding.filePath)
          }
        }
      } finally {
        aiProgress.done()
      }
    }
  }

  const scopeLabel =
    options.scopeLabel ??
    (options.system
      ? 'AI system scan'
      : deep
        ? 'Current + subdirectories'
        : 'Current directory only')

  const skippedFiles = skippedNotEligible + skippedEmptyOrUnreadable
  const threats = scannedFindings.filter((f) => isThreat(f.decision, policy))

  const scanResult = await buildScanResult({
    scope: scopeLabel,
    target: targets.join(', '),
    ai: aiEnabled,
    totalFiles: files.length,
    eligibleFiles: eligibleByName,
    scannedFiles,
    skippedFiles,
    skippedNotEligible,
    skippedEmptyOrUnreadable,
    threats: threats.length,
    findings: scannedFindings,
  })

  if (options.noSave !== true) {
    const scanDir = join(homedir(), '.sapperai', 'scans')
    await mkdir(scanDir, { recursive: true })
    const ts = new Date().toISOString().replace(/[:.]/g, '-')

    const jsonPath = join(scanDir, `${ts}.json`)
    await writeFile(jsonPath, JSON.stringify(scanResult, null, 2), 'utf8')

    const { generateHtmlReport } = await import('./report')
    const html = generateHtmlReport(scanResult)
    const htmlPath = join(scanDir, `${ts}.html`)
    await writeFile(htmlPath, html, 'utf8')

    console.log(`${colors.dim}  Saved to ${jsonPath}${colors.reset}`)
    console.log(`${colors.dim}  Report: ${htmlPath}${colors.reset}`)
    console.log()

    if (options.noOpen !== true) {
      try {
        const { execFile } = await import('node:child_process')

        if (process.platform === 'win32') {
          execFile('cmd', ['/c', 'start', '', htmlPath])
        } else {
          const openCmd = process.platform === 'darwin' ? 'open' : 'xdg-open'
          execFile(openCmd, [htmlPath])
        }
      } catch {
      }
    }
  }

  if (aiEnabled) {
    const countWidth = Math.max(String(eligibleByName).length, String(aiTargetsCount).length)
    const rulesName = `${colors.dim}rules${colors.reset}`
    const aiName = `${colors.olive}ai${colors.reset}`

    console.log(`  Phase 1  ${padRightVisual(rulesName, 5)}  ${padLeft(String(eligibleByName), countWidth)} files`)
    console.log(`  Phase 2  ${padRightVisual(aiName, 5)}  ${padLeft(String(aiTargetsCount), countWidth)} files`)
    console.log()
  }

  if (threats.length === 0) {
    console.log(`  ${colors.olive}All clear — 0 threats in ${eligibleByName} files${colors.reset}`)
    console.log()
    return 0
  }

  console.log(
    renderFindingsTable(threats, {
      cwd,
      columns: process.stdout.columns ?? 80,
      colors,
      includeSource: aiEnabled,
    })
  )
  console.log()

  console.log(`  ${threats.length} threats found in ${eligibleByName} files (${files.length} total)`)
  console.log()
  if (!fix) {
    console.log('  Run npx sapper-ai scan --fix to quarantine.\n')
  } else {
    console.log()
  }

  return 1
}
