import { existsSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { ThreatIntelStore } from '@sapper-ai/core'
import type { ThreatIntelEntry } from '@sapper-ai/core'

import { getIntelCachePath } from './paths'

let cachedEntries: ThreatIntelEntry[] = []
let lastIntelMtime = -1

function getIntelFilePath(): string {
  return getIntelCachePath() ?? join(homedir(), '.sapperai', 'intel', 'threat-intel.json')
}

export function createIntelStore(): ThreatIntelStore {
  return new ThreatIntelStore({ cachePath: getIntelCachePath() })
}

export async function getCachedEntries(): Promise<ThreatIntelEntry[]> {
  const filePath = getIntelFilePath()
  let currentMtime = 0
  if (existsSync(filePath)) {
    currentMtime = statSync(filePath).mtimeMs
  }

  if (currentMtime === lastIntelMtime) {
    return cachedEntries
  }

  const store = createIntelStore()
  cachedEntries = await store.listEntries()
  lastIntelMtime = currentMtime
  return cachedEntries
}
