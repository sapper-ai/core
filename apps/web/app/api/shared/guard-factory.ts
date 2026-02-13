import { existsSync, statSync } from 'node:fs'

import { AuditLogger, createDetectors, DecisionEngine, Guard, PolicyManager } from '@sapper-ai/core'
import type { Policy } from '@sapper-ai/types'

import { getCachedEntries } from './intel-store'
import { getAuditLogPath, getConfigPath } from './paths'

let cachedGuard: Guard | null = null
let cachedPolicy: Policy | null = null
let lastMtime = -1

const DEFAULT_POLICY: Policy = {
  mode: 'enforce',
  defaultAction: 'allow',
  failOpen: true,
  detectors: ['rules'],
  thresholds: { riskThreshold: 0.7, blockMinConfidence: 0.65 },
}

export async function getGuard(): Promise<{ guard: Guard; policy: Policy }> {
  const configPath = getConfigPath()
  let currentMtime = 0

  if (existsSync(configPath)) {
    currentMtime = statSync(configPath).mtimeMs
  }

  if (cachedGuard && cachedPolicy && currentMtime === lastMtime) {
    return { guard: cachedGuard, policy: cachedPolicy }
  }

  const manager = new PolicyManager()
  let policy: Policy

  if (!existsSync(configPath)) {
    policy = manager.loadFromObject(DEFAULT_POLICY)
  } else {
    try {
      policy = manager.loadFromFile(configPath)
    } catch {
      policy = manager.loadFromObject(DEFAULT_POLICY)
    }
  }

  const threatIntelEntries = await getCachedEntries()
  const detectors = createDetectors({ policy, threatIntelEntries })
  const auditLogPath = getAuditLogPath()
  const logger = new AuditLogger({ filePath: auditLogPath })
  const guard = new Guard(new DecisionEngine(detectors), logger, policy)

  cachedGuard = guard
  cachedPolicy = policy
  lastMtime = currentMtime

  return { guard, policy }
}
