import type { Policy } from '@sapper-ai/types'

const DEFAULT_POLICY: Policy = {
  mode: 'enforce',
  defaultAction: 'allow',
  failOpen: true,
  detectors: ['rules'],
  thresholds: {
    riskThreshold: 0.7,
    blockMinConfidence: 0.5,
  },
}

export function getDefaultPolicy(): Policy {
  return {
    ...DEFAULT_POLICY,
    detectors: [...(DEFAULT_POLICY.detectors ?? ['rules'])],
    thresholds: {
      riskThreshold: DEFAULT_POLICY.thresholds?.riskThreshold ?? 0.7,
      blockMinConfidence: DEFAULT_POLICY.thresholds?.blockMinConfidence ?? 0.5,
    },
  }
}
