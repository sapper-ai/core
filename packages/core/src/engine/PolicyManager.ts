import { readFileSync } from 'node:fs'
import { extname } from 'node:path'

import type { Policy } from '@sapperai/types'
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'

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
  llm: LlmConfigSchema.optional(),
})

type ExtendedPolicy = Policy & {
  detectors?: string[]
  thresholds?: {
    riskThreshold?: number
    blockMinConfidence?: number
  }
}

export class PolicyManager {
  resolvePolicy(toolName: string, basePolicy: Policy): Policy {
    const extendedBase = basePolicy as ExtendedPolicy
    const toolOverride = basePolicy.toolOverrides?.[toolName]

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
