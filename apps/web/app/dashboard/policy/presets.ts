import type { Policy } from '@sapper-ai/types'

export type PresetName = 'monitor' | 'standard' | 'strict' | 'paranoid' | 'ci' | 'development'

export const policyPresets: Record<
  PresetName,
  { label: string; description: string; policy: Policy }
> = {
  monitor: {
    label: 'Monitor',
    description: 'Log only, no blocking',
    policy: {
      mode: 'monitor',
      defaultAction: 'allow',
      failOpen: true,
      detectors: ['rules'],
      thresholds: { riskThreshold: 0.7, blockMinConfidence: 0.5 },
    },
  },
  standard: {
    label: 'Standard',
    description: 'Balanced protection (default)',
    policy: {
      mode: 'enforce',
      defaultAction: 'allow',
      failOpen: true,
      detectors: ['rules'],
      thresholds: { riskThreshold: 0.7, blockMinConfidence: 0.5 },
    },
  },
  strict: {
    label: 'Strict',
    description: 'Lower thresholds, fail closed',
    policy: {
      mode: 'enforce',
      defaultAction: 'allow',
      failOpen: false,
      detectors: ['rules'],
      thresholds: { riskThreshold: 0.5, blockMinConfidence: 0.3 },
    },
  },
  paranoid: {
    label: 'Paranoid',
    description: 'Maximum security + LLM analysis',
    policy: {
      mode: 'enforce',
      defaultAction: 'allow',
      failOpen: false,
      detectors: ['rules', 'llm'],
      thresholds: { riskThreshold: 0.3, blockMinConfidence: 0.2 },
    },
  },
  ci: {
    label: 'CI/CD',
    description: 'Deterministic, fail closed',
    policy: {
      mode: 'enforce',
      defaultAction: 'allow',
      failOpen: false,
      detectors: ['rules'],
      thresholds: { riskThreshold: 0.7, blockMinConfidence: 0.5 },
    },
  },
  development: {
    label: 'Development',
    description: 'Permissive, monitor only',
    policy: {
      mode: 'monitor',
      defaultAction: 'allow',
      failOpen: true,
      detectors: ['rules'],
      thresholds: { riskThreshold: 0.9, blockMinConfidence: 0.8 },
    },
  },
}
