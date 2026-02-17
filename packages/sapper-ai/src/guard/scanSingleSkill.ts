import { readFile, realpath } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { basename } from 'node:path'

import { createDetectors, DecisionEngine, SkillParser, type ParsedSkill } from '@sapper-ai/core'
import type { AssessmentContext, Policy } from '@sapper-ai/types'

import { getDefaultPolicy } from './getDefaultPolicy'
import type { SingleSkillScanResult } from './types'

const DEFAULT_SUSPICIOUS_THRESHOLD = 0.7

export interface ScanSingleSkillOptions {
  policy?: Policy
  suspiciousThreshold?: number
  readFileFn?: (filePath: string, encoding: BufferEncoding) => Promise<string>
  realpathFn?: (filePath: string) => Promise<string>
  now?: () => number
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function fallbackSkillName(filePath: string): string {
  const fileName = basename(filePath)
  return fileName.toLowerCase().endsWith('.md') ? fileName.slice(0, -3) : fileName
}

function resolveThreshold(policy: Policy, override?: number): number {
  if (typeof override === 'number') {
    return override
  }

  const threshold = policy.thresholds?.riskThreshold
  return typeof threshold === 'number' ? threshold : DEFAULT_SUSPICIOUS_THRESHOLD
}

function toAssessmentContext(
  skillName: string,
  skillPath: string,
  policy: Policy,
  body: string,
  metadata: unknown,
  now: number
): AssessmentContext {
  return {
    kind: 'install_scan',
    policy,
    toolCall: {
      toolName: `skill:${skillName}`,
      arguments: {
        content: body,
        metadata,
      },
    },
    meta: {
      source: 'skill-guard',
      sourcePath: skillPath,
      sourceType: 'skill',
      timestamp: now,
    },
  }
}

export async function scanSingleSkill(
  filePath: string,
  options: ScanSingleSkillOptions = {}
): Promise<SingleSkillScanResult> {
  const resolvePath = options.realpathFn ?? realpath
  const read = options.readFileFn ?? readFile
  const now = options.now ?? Date.now

  const resolvedPath = await resolvePath(filePath)
  const content = await read(resolvedPath, 'utf8')
  const contentHash = sha256(content)
  const policy = options.policy ?? getDefaultPolicy()
  const suspiciousThreshold = resolveThreshold(policy, options.suspiciousThreshold)

  let parsed: ParsedSkill

  try {
    parsed = SkillParser.parse(content)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return {
      skillName: fallbackSkillName(resolvedPath),
      skillPath: resolvedPath,
      contentHash,
      decision: 'suspicious',
      risk: 1,
      reasons: [`Parse error: ${reason}`],
    }
  }

  const skillName =
    typeof parsed.metadata.name === 'string' && parsed.metadata.name.length > 0
      ? parsed.metadata.name
      : fallbackSkillName(resolvedPath)
  const context = toAssessmentContext(
    skillName,
    resolvedPath,
    policy,
    parsed.body,
    parsed.metadata,
    now()
  )

  const detectors = createDetectors({ policy, preferredDetectors: ['rules'] })
  const engine = new DecisionEngine(detectors)
  const decision = await engine.assess(context)

  return {
    skillName,
    skillPath: resolvedPath,
    contentHash,
    decision: decision.risk >= suspiciousThreshold ? 'suspicious' : 'safe',
    risk: decision.risk,
    reasons: [...decision.reasons],
  }
}
