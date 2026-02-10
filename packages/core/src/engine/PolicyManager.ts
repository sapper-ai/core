import { readFileSync } from 'node:fs'
import { extname } from 'node:path'

import type { Policy } from '@sapper-ai/types'
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'

const MatchListSchema = z
  .object({
    toolNames: z.array(z.string()).optional(),
    urlPatterns: z.array(z.string()).optional(),
    contentPatterns: z.array(z.string()).optional(),
    packageNames: z.array(z.string()).optional(),
    sha256: z.array(z.string()).optional(),
  })
  .optional()

const GuardActionSchema = z.enum(['allow', 'block'])

const ThresholdSchema = z
  .object({
    riskThreshold: z.number().min(0).max(1).optional(),
    blockMinConfidence: z.number().min(0).max(1).optional(),
  })
  .optional()

const ToolPolicySchema = z.object({
  mode: z.enum(['monitor', 'enforce']).optional(),
  detectors: z.array(z.string()).optional(),
  thresholds: z
    .object({
      blockMinConfidence: z.number().min(0).max(1).optional(),
      riskThreshold: z.number().min(0).max(1).optional(),
    })
    .optional(),
  allowlist: MatchListSchema,
  blocklist: MatchListSchema,
})

const ThreatFeedSchema = z.object({
  enabled: z.boolean().optional(),
  sources: z.array(z.string()).optional(),
  ttlMinutes: z.number().int().positive().optional(),
  autoSync: z.boolean().optional(),
  failOpen: z.boolean().optional(),
  cachePath: z.string().optional(),
})

const LlmConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'sapperai']),
  apiKey: z.string().optional(),
  endpoint: z.string().optional(),
  model: z.string().optional(),
})

const PolicySchema = z.object({
  mode: z.enum(['monitor', 'enforce']),
  defaultAction: GuardActionSchema,
  failOpen: z.boolean().default(true),
  detectors: z.array(z.string()).optional(),
  thresholds: ThresholdSchema,
  toolOverrides: z.record(z.string(), ToolPolicySchema).optional(),
  allowlist: MatchListSchema,
  blocklist: MatchListSchema,
  threatFeed: ThreatFeedSchema.optional(),
  llm: LlmConfigSchema.optional(),
})

type ExtendedPolicy = Policy & {
  detectors?: string[]
  thresholds?: {
    riskThreshold?: number
    blockMinConfidence?: number
  }
  allowlist?: {
    toolNames?: string[]
    urlPatterns?: string[]
    contentPatterns?: string[]
    packageNames?: string[]
    sha256?: string[]
  }
  blocklist?: {
    toolNames?: string[]
    urlPatterns?: string[]
    contentPatterns?: string[]
    packageNames?: string[]
    sha256?: string[]
  }
}

type ExtendedToolPolicy = NonNullable<Policy['toolOverrides']>[string] & {
  allowlist?: ExtendedPolicy['allowlist']
  blocklist?: ExtendedPolicy['blocklist']
}

function mergeUnique(left: string[] | undefined, right: string[] | undefined): string[] | undefined {
  const values = [...(left ?? []), ...(right ?? [])]
  if (values.length === 0) {
    return undefined
  }

  return Array.from(new Set(values))
}

function mergeMatchList(
  base: ExtendedPolicy['allowlist'] | undefined,
  override: ExtendedPolicy['allowlist'] | undefined
): ExtendedPolicy['allowlist'] | undefined {
  const merged = {
    toolNames: mergeUnique(base?.toolNames, override?.toolNames),
    urlPatterns: mergeUnique(base?.urlPatterns, override?.urlPatterns),
    contentPatterns: mergeUnique(base?.contentPatterns, override?.contentPatterns),
    packageNames: mergeUnique(base?.packageNames, override?.packageNames),
    sha256: mergeUnique(base?.sha256, override?.sha256),
  }

  if (!merged.toolNames && !merged.urlPatterns && !merged.contentPatterns && !merged.packageNames && !merged.sha256) {
    return undefined
  }

  return merged
}

export class PolicyManager {
  resolvePolicy(toolName: string, basePolicy: Policy): Policy {
    const extendedBase = basePolicy as ExtendedPolicy
    const toolOverride = basePolicy.toolOverrides?.[toolName] as ExtendedToolPolicy | undefined

    if (!toolOverride) {
      return { ...basePolicy }
    }

    const merged: ExtendedPolicy = {
      ...extendedBase,
      mode: toolOverride.mode ?? basePolicy.mode,
      toolOverrides: basePolicy.toolOverrides,
    }

    if (extendedBase.detectors || toolOverride.detectors) {
      merged.detectors = toolOverride.detectors ?? extendedBase.detectors
    }

    if (extendedBase.thresholds || toolOverride.thresholds) {
      merged.thresholds = {
        ...(extendedBase.thresholds ?? {}),
        ...(toolOverride.thresholds ?? {}),
      }
    }

    if (extendedBase.allowlist || toolOverride.allowlist) {
      merged.allowlist = mergeMatchList(extendedBase.allowlist, toolOverride.allowlist)
    }

    if (extendedBase.blocklist || toolOverride.blocklist) {
      merged.blocklist = mergeMatchList(extendedBase.blocklist, toolOverride.blocklist)
    }

    return merged
  }

  loadFromFile(path: string): Policy {
    const fileContent = readFileSync(path, 'utf8')
    const extension = extname(path).toLowerCase()

    let parsed: unknown
    if (extension === '.json') {
      parsed = JSON.parse(fileContent)
    } else if (extension === '.yaml' || extension === '.yml') {
      parsed = parseYaml(fileContent)
    } else {
      try {
        parsed = JSON.parse(fileContent)
      } catch {
        parsed = parseYaml(fileContent)
      }
    }

    return this.loadFromObject(parsed)
  }

  loadFromObject(obj: unknown): Policy {
    return PolicySchema.parse(obj) as Policy
  }
}

export function validatePolicy(obj: unknown): Policy {
  return PolicySchema.parse(obj) as Policy
}
