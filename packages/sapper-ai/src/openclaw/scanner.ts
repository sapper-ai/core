import { readFile, readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { createHash } from 'node:crypto'

import {
  createDetectors,
  DecisionEngine,
  PolicyManager,
  QuarantineManager,
  resolvePolicyPath,
  SkillParser,
  ThreatIntelStore,
  type ParsedSkill,
  type ThreatIntelEntry,
} from '@sapper-ai/core'
import type { Decision, HoneytokenFinding, Policy, SkillScanResult } from '@sapper-ai/types'

import { presets } from '../presets'
import { findRepoRoot } from '../utils/repoRoot'

import { skillToAssessmentContext } from './contextAdapter'
import { DockerSandbox, defaultDockerCommandRunner } from './docker/DockerSandbox'
import { HoneytokenGenerator } from './docker/HoneytokenGenerator'
import { OpenClawTestRunner } from './docker/OpenClawTestRunner'
import { TrafficAnalyzer } from './docker/TrafficAnalyzer'

interface StaticScanRecord {
  result: SkillScanResult
  staticDecision: Decision | null
  parsedSkill: ParsedSkill | null
  rawContent: string | null
}

type ScanDecision = SkillScanResult['decision']

export type DynamicAnalysisStatus = 'not_requested' | 'completed' | 'skipped_unconfigured' | 'skipped_unavailable'

export interface OpenClawScanProgressEvent {
  phase: 'static' | 'dynamic'
  completed: number
  total: number
  skillPath: string
  skillName: string
}

export interface DynamicAnalysisInput {
  skillPath: string
  skillName: string
  parsedSkill: ParsedSkill
  rawContent: string
  staticResult: {
    risk: number
    confidence: number
    reasons: string[]
  }
  policy: Policy
}

export interface DynamicAnalysisResult {
  exfiltrationDetected: boolean
  findings: HoneytokenFinding[]
  unknownHosts?: string[]
}

export interface DynamicAnalysisAdapter {
  isAvailable?: () => boolean | Promise<boolean>
  analyze: (input: DynamicAnalysisInput) => Promise<DynamicAnalysisResult>
}

export interface OpenClawScanOptions {
  dynamicAnalysis?: boolean
  dynamicAnalyzer?: DynamicAnalysisAdapter
  dynamicTimeoutMs?: number
  quarantineOnRisk?: boolean
  quarantineDir?: string
  onProgress?: (event: OpenClawScanProgressEvent) => void
}

export interface OpenClawScanOutcome {
  results: SkillScanResult[]
  staticCount: number
  suspiciousCount: number
  dynamicCount: number
  dynamicStatus: DynamicAnalysisStatus
}

export interface ResolveOpenClawPolicyOptions {
  cwd?: string
  homeDir?: string
  policyPath?: string
}

const DECISION_RANK: Record<ScanDecision, number> = {
  quarantined: 0,
  suspicious: 1,
  safe: 2,
}

const DEFAULT_DYNAMIC_PROBE_TIMEOUT_MS = 15_000
const SANITIZED_ERROR_MAX_LENGTH = 240

export interface OpenClawDockerDynamicAnalyzerOptions {
  timeoutMs?: number
  sandbox?: DockerSandbox
  testRunner?: OpenClawTestRunner
  trafficAnalyzer?: TrafficAnalyzer
}

export class OpenClawDockerDynamicAnalyzer implements DynamicAnalysisAdapter {
  private readonly timeoutMs?: number
  private readonly sandbox: DockerSandbox
  private readonly testRunner: OpenClawTestRunner
  private readonly trafficAnalyzer: TrafficAnalyzer

  constructor(options: OpenClawDockerDynamicAnalyzerOptions = {}) {
    this.timeoutMs = options.timeoutMs
    this.sandbox = options.sandbox ?? new DockerSandbox()
    this.testRunner = options.testRunner ?? new OpenClawTestRunner()
    this.trafficAnalyzer = options.trafficAnalyzer ?? new TrafficAnalyzer()
  }

  async isAvailable(): Promise<boolean> {
    const dockerInfo = await defaultDockerCommandRunner('docker', ['info'], {
      timeoutMs: DEFAULT_DYNAMIC_PROBE_TIMEOUT_MS,
    })
    if (!dockerInfo.ok) {
      return false
    }

    const composePlugin = await defaultDockerCommandRunner('docker', ['compose', 'version'], {
      timeoutMs: DEFAULT_DYNAMIC_PROBE_TIMEOUT_MS,
    })
    if (composePlugin.ok) {
      return true
    }

    const composeLegacy = await defaultDockerCommandRunner('docker-compose', ['version'], {
      timeoutMs: DEFAULT_DYNAMIC_PROBE_TIMEOUT_MS,
    })
    return composeLegacy.ok
  }

  async analyze(input: DynamicAnalysisInput): Promise<DynamicAnalysisResult> {
    const generatorSeed = createHash('sha256')
      .update(input.skillPath)
      .update('\n')
      .update(input.rawContent)
      .digest('hex')
    const { honeytokens } = new HoneytokenGenerator({ seed: generatorSeed }).generate()
    const sandboxId = await this.sandbox.prepare(input.skillPath, honeytokens)

    try {
      const runResult = await this.sandbox.run(sandboxId, this.timeoutMs)
      await this.testRunner.run(runResult.openclawContainerId)
      const trafficLog = await this.sandbox.getTrafficLog(sandboxId)
      const trafficResult = this.trafficAnalyzer.analyze(trafficLog, honeytokens)

      return {
        exfiltrationDetected: trafficResult.exfiltrationDetected,
        findings: trafficResult.findings,
        unknownHosts: trafficResult.unknownHosts,
      }
    } finally {
      await this.sandbox.cleanup(sandboxId).catch((error) => {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(
          `[openclaw] Failed to cleanup sandbox ${sandboxId}: ${sanitizeErrorMessage(reason)}`
        )
      })
    }
  }
}

export function createDefaultOpenClawDynamicAnalyzer(
  options: OpenClawDockerDynamicAnalyzerOptions = {}
): DynamicAnalysisAdapter {
  return new OpenClawDockerDynamicAnalyzer(options)
}

function resolveRiskThreshold(policy: Policy): number {
  const thresholds = (policy as Policy & { thresholds?: { riskThreshold?: unknown } }).thresholds
  return typeof thresholds?.riskThreshold === 'number' ? thresholds.riskThreshold : 0.7
}

function toFallbackSkillName(skillPath: string): string {
  const fileName = basename(skillPath)
  return fileName.toLowerCase().endsWith('.md') ? fileName.slice(0, -3) : fileName
}

function toDecisionFromStaticResult(
  staticResult: NonNullable<SkillScanResult['staticResult']>,
  action: Decision['action'] = 'block'
): Decision {
  return {
    action,
    risk: staticResult.risk,
    confidence: staticResult.confidence,
    reasons: staticResult.reasons,
    evidence: [],
  }
}

function toDecisionFromDynamicResult(result: SkillScanResult): Decision {
  const findings = result.dynamicResult?.findings ?? []
  return {
    action: 'block',
    risk: 1,
    confidence: 0.95,
    reasons:
      findings.length > 0
        ? findings.map(
            (finding) =>
              `Honeytoken ${finding.honeytoken.type} exfiltrated to ${finding.destination} via ${finding.protocol}`
          )
        : ['Dynamic analysis identified high-risk exfiltration behavior'],
    evidence: [],
  }
}

function sanitizeErrorMessage(errorMessage: string): string {
  const collapsed = errorMessage.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!collapsed) {
    return 'unknown error'
  }

  let sanitized = collapsed
  const homePath = homedir()

  if (homePath) {
    sanitized = sanitized.split(homePath).join('<redacted-path>')
    sanitized = sanitized.split(homePath.split('\\').join('/')).join('<redacted-path>')
  }

  sanitized = sanitized.replace(
    /(^|[\s(])(?:[A-Za-z]:\\|\/)[^\s):]*/g,
    '$1<redacted-path>'
  )

  if (sanitized.length <= SANITIZED_ERROR_MAX_LENGTH) {
    return sanitized
  }

  return `${sanitized.slice(0, SANITIZED_ERROR_MAX_LENGTH - 3)}...`
}

function appendQuarantineError(result: SkillScanResult, errorMessage: string): void {
  const reason = `Quarantine failed: ${sanitizeErrorMessage(errorMessage)}`
  if (result.staticResult) {
    result.staticResult.reasons = [...result.staticResult.reasons, reason]
    return
  }

  result.staticResult = {
    risk: 1,
    confidence: 0.5,
    reasons: [reason],
  }
}

function appendDynamicAnalysisError(result: SkillScanResult, errorMessage: string): void {
  const reason = `Dynamic analysis failed: ${sanitizeErrorMessage(errorMessage)}`
  if (result.staticResult) {
    result.staticResult.reasons = [...result.staticResult.reasons, reason]
    return
  }

  result.staticResult = {
    risk: 1,
    confidence: 0.5,
    reasons: [reason],
  }
}

function appendParseError(result: SkillScanResult, errorMessage: string): void {
  const reason = `Failed to parse skill file: ${sanitizeErrorMessage(errorMessage)}`
  if (result.staticResult) {
    result.staticResult.reasons = [...result.staticResult.reasons, reason]
    return
  }

  result.staticResult = {
    risk: 1,
    confidence: 0.5,
    reasons: [reason],
  }
}

async function loadThreatIntelEntries(policy: Policy): Promise<ThreatIntelEntry[]> {
  const feed = (policy as Policy & {
    threatFeed?: {
      enabled?: boolean
      sources?: string[]
      autoSync?: boolean
      failOpen?: boolean
      cachePath?: string
    }
  }).threatFeed

  if (!feed?.enabled) {
    return []
  }

  const store = new ThreatIntelStore({ cachePath: feed.cachePath })

  try {
    if (feed.autoSync && Array.isArray(feed.sources) && feed.sources.length > 0) {
      await store.syncFromSources(feed.sources)
    }

    const snapshot = await store.loadSnapshot()
    return snapshot.entries
  } catch (error) {
    if (feed.failOpen === false) {
      throw error
    }

    return []
  }
}

function sortBySeverity(records: StaticScanRecord[]): StaticScanRecord[] {
  records.sort((left, right) => {
    const rankDiff = DECISION_RANK[left.result.decision] - DECISION_RANK[right.result.decision]
    if (rankDiff !== 0) {
      return rankDiff
    }

    const leftRisk = left.result.staticResult?.risk ?? 0
    const rightRisk = right.result.staticResult?.risk ?? 0
    if (leftRisk !== rightRisk) {
      return rightRisk - leftRisk
    }

    return left.result.skillName.localeCompare(right.result.skillName)
  })

  return records
}

async function collectSkillFiles(paths: string[]): Promise<string[]> {
  const files = new Set<string>()

  for (const inputPath of paths) {
    const normalizedPath = resolve(inputPath)

    let info
    try {
      info = await stat(normalizedPath)
    } catch {
      continue
    }

    if (info.isFile()) {
      if (normalizedPath.toLowerCase().endsWith('.md')) {
        files.add(normalizedPath)
      }
      continue
    }

    if (!info.isDirectory()) {
      continue
    }

    const stack: string[] = [normalizedPath]

    while (stack.length > 0) {
      const current = stack.pop()
      if (!current) {
        continue
      }

      let entries
      try {
        entries = await readdir(current, { withFileTypes: true })
      } catch {
        continue
      }

      for (const entry of entries) {
        const fullPath = join(current, entry.name)
        if (entry.isDirectory()) {
          stack.push(fullPath)
          continue
        }

        if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
          files.add(fullPath)
        }
      }
    }
  }

  return Array.from(files).sort()
}

async function scanSkillsStaticRecords(
  skillsPaths: string[],
  policy: Policy,
  onProgress?: (event: OpenClawScanProgressEvent) => void
): Promise<StaticScanRecord[]> {
  const skillFiles = await collectSkillFiles(skillsPaths)
  const threatIntelEntries = await loadThreatIntelEntries(policy)
  const detectors = createDetectors({ policy, preferredDetectors: ['rules'], threatIntelEntries })
  const engine = new DecisionEngine(detectors)
  const threshold = resolveRiskThreshold(policy)

  const records: StaticScanRecord[] = []

  for (let index = 0; index < skillFiles.length; index += 1) {
    const skillPath = skillFiles[index]!

    try {
      const rawContent = await readFile(skillPath, 'utf8')
      const parsedSkill = SkillParser.parse(rawContent)
      const assessmentContext = skillToAssessmentContext(parsedSkill, policy, { skillPath })
      const decision = await engine.assess(assessmentContext)

      const result: SkillScanResult = {
        skillName: parsedSkill.metadata.name,
        skillPath,
        staticResult: {
          risk: decision.risk,
          confidence: decision.confidence,
          reasons: decision.reasons,
        },
        dynamicResult: null,
        decision: decision.risk >= threshold ? 'suspicious' : 'safe',
      }

      records.push({
        result,
        staticDecision: decision,
        parsedSkill,
        rawContent,
      })

      onProgress?.({
        phase: 'static',
        completed: index + 1,
        total: skillFiles.length,
        skillPath,
        skillName: result.skillName,
      })
      continue
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const fallbackName = toFallbackSkillName(skillPath)

      const parseFailureStaticResult: NonNullable<SkillScanResult['staticResult']> = {
        risk: 1,
        confidence: 0.6,
        reasons: [],
      }

      const parseFailure: SkillScanResult = {
        skillName: fallbackName,
        skillPath,
        staticResult: parseFailureStaticResult,
        dynamicResult: null,
        decision: 'suspicious',
      }
      appendParseError(parseFailure, message)

      records.push({
        result: parseFailure,
        staticDecision: toDecisionFromStaticResult(parseFailureStaticResult, 'block'),
        parsedSkill: null,
        rawContent: null,
      })

      onProgress?.({
        phase: 'static',
        completed: index + 1,
        total: skillFiles.length,
        skillPath,
        skillName: fallbackName,
      })
    }
  }

  return sortBySeverity(records)
}

function countSuspicious(results: SkillScanResult[]): number {
  return results.filter((result) => result.decision === 'suspicious').length
}

export async function scanSkillsStatic(skillsPaths: string[], policy: Policy): Promise<SkillScanResult[]> {
  const records = await scanSkillsStaticRecords(skillsPaths, policy)
  return records.map((record) => record.result)
}

export async function scanSkills(
  skillsPaths: string[],
  policy: Policy,
  options: OpenClawScanOptions = {}
): Promise<OpenClawScanOutcome> {
  const staticRecords = await scanSkillsStaticRecords(skillsPaths, policy, options.onProgress)
  const staticResults = staticRecords.map((record) => record.result)
  let dynamicStatus: DynamicAnalysisStatus = 'not_requested'
  let dynamicCount = 0

  if (options.dynamicAnalysis === true) {
    const dynamicAnalyzer =
      options.dynamicAnalyzer ??
      createDefaultOpenClawDynamicAnalyzer({
        timeoutMs: options.dynamicTimeoutMs,
      })
    const suspiciousRecords = staticRecords.filter(
      (record) => record.result.decision === 'suspicious' && record.parsedSkill && typeof record.rawContent === 'string'
    )

    if (suspiciousRecords.length === 0) {
      dynamicStatus = 'completed'
    } else if (!dynamicAnalyzer) {
      dynamicStatus = 'skipped_unconfigured'
    } else if (dynamicAnalyzer.isAvailable && !(await dynamicAnalyzer.isAvailable())) {
      dynamicStatus = 'skipped_unavailable'
    } else {
      dynamicStatus = 'completed'

      for (let index = 0; index < suspiciousRecords.length; index += 1) {
        const record = suspiciousRecords[index]!
        const parsedSkill = record.parsedSkill!
        const rawContent = record.rawContent!
        const staticResult = record.result.staticResult

        if (!staticResult) {
          continue
        }

        try {
          const dynamicResult = await dynamicAnalyzer.analyze({
            skillPath: record.result.skillPath,
            skillName: record.result.skillName,
            parsedSkill,
            rawContent,
            staticResult,
            policy,
          })

          record.result.dynamicResult = {
            exfiltrationDetected: dynamicResult.exfiltrationDetected,
            findings: dynamicResult.findings,
          }

          if (dynamicResult.exfiltrationDetected) {
            record.result.decision = 'quarantined'
          } else if (Array.isArray(dynamicResult.unknownHosts) && dynamicResult.unknownHosts.length > 0) {
            record.result.decision = 'suspicious'
          } else {
            record.result.decision = 'safe'
          }
          dynamicCount += 1
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          appendDynamicAnalysisError(record.result, message)
        } finally {
          options.onProgress?.({
            phase: 'dynamic',
            completed: index + 1,
            total: suspiciousRecords.length,
            skillPath: record.result.skillPath,
            skillName: record.result.skillName,
          })
        }
      }
    }
  }

  if (options.quarantineOnRisk === true) {
    const quarantineManager = new QuarantineManager(
      options.quarantineDir ? { quarantineDir: options.quarantineDir } : undefined
    )

    for (const record of staticRecords) {
      if (record.result.decision !== 'suspicious' && record.result.decision !== 'quarantined') {
        continue
      }

      const decision: Decision =
        record.result.decision === 'quarantined' && record.result.dynamicResult
          ? toDecisionFromDynamicResult(record.result)
          : record.staticDecision && record.result.staticResult
            ? toDecisionFromStaticResult(record.result.staticResult, record.staticDecision.action)
            : record.result.staticResult
              ? toDecisionFromStaticResult(record.result.staticResult)
              : {
                  action: 'block',
                  risk: 1,
                  confidence: 0.5,
                  reasons: ['High-risk behavior detected'],
                  evidence: [],
                }

      try {
        await quarantineManager.quarantine(record.result.skillPath, decision)
        record.result.decision = 'quarantined'
      } catch (error) {
        if (record.result.decision === 'quarantined') {
          record.result.decision = 'suspicious'
        }

        const message = error instanceof Error ? error.message : String(error)
        appendQuarantineError(record.result, message)
      }
    }
  }

  const finalResults = sortBySeverity(staticRecords).map((record) => record.result)

  return {
    results: finalResults,
    staticCount: staticResults.length,
    suspiciousCount: countSuspicious(finalResults),
    dynamicCount,
    dynamicStatus,
  }
}

export function resolveOpenClawPolicy(options: ResolveOpenClawPolicyOptions = {}): Policy {
  const manager = new PolicyManager()
  const explicitPath = options.policyPath ?? process.env.SAPPERAI_POLICY_PATH

  if (explicitPath) {
    return manager.loadFromFile(explicitPath)
  }

  const cwd = options.cwd ?? process.cwd()
  const repoRoot = findRepoRoot(cwd)
  const homeDir = options.homeDir ?? homedir()
  const resolvedPath = resolvePolicyPath({ repoRoot, homeDir })

  if (!resolvedPath) {
    return { ...presets.standard.policy }
  }

  return manager.loadFromFile(resolvedPath.path)
}
