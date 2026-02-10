import { ThreatIntelStore } from '@sapper-ai/core'
import type { Policy } from '@sapper-ai/types'

interface BlocklistOutputOptions {
  write?: (text: string) => void
}

interface BlocklistSyncOptions extends BlocklistOutputOptions {
  policy: Policy
  sources?: string[]
  cachePath?: string
}

interface BlocklistStatusOptions extends BlocklistOutputOptions {
  cachePath?: string
}

interface BlocklistListOptions extends BlocklistOutputOptions {
  cachePath?: string
}

interface BlocklistCheckOptions extends BlocklistOutputOptions {
  cachePath?: string
  indicator: string
}

function writeOutput(write: ((text: string) => void) | undefined, payload: unknown): void {
  const out = write ?? ((text: string) => process.stdout.write(text))
  out(`${JSON.stringify(payload, null, 2)}\n`)
}

function resolveFeedSources(policy: Policy, sources?: string[]): string[] {
  if (Array.isArray(sources) && sources.length > 0) {
    return sources
  }

  const extended = policy as Policy & {
    threatFeed?: {
      sources?: string[]
    }
  }

  return Array.isArray(extended.threatFeed?.sources) ? extended.threatFeed.sources : []
}

export async function runBlocklistSyncCommand(options: BlocklistSyncOptions): Promise<void> {
  const store = new ThreatIntelStore({ cachePath: options.cachePath })
  const sources = resolveFeedSources(options.policy, options.sources)
  if (sources.length === 0) {
    throw new Error('No threat feed sources configured. Set policy.threatFeed.sources or pass --source.')
  }

  const result = await store.syncFromSources(sources)
  writeOutput(options.write, {
    status: 'ok',
    ...result,
    sources,
  })
}

export async function runBlocklistStatusCommand(options: BlocklistStatusOptions): Promise<void> {
  const store = new ThreatIntelStore({ cachePath: options.cachePath })
  const snapshot = await store.loadSnapshot()

  writeOutput(options.write, {
    status: 'ok',
    updatedAt: snapshot.updatedAt,
    count: snapshot.entries.length,
    cachePath: options.cachePath,
  })
}

export async function runBlocklistListCommand(options: BlocklistListOptions): Promise<void> {
  const store = new ThreatIntelStore({ cachePath: options.cachePath })
  const entries = await store.listEntries()

  writeOutput(options.write, {
    status: 'ok',
    count: entries.length,
    entries,
  })
}

export async function runBlocklistCheckCommand(options: BlocklistCheckOptions): Promise<void> {
  const store = new ThreatIntelStore({ cachePath: options.cachePath })
  const entries = (await store.listEntries()) as Array<{ id: string; value: string }>
  const indicator = options.indicator.toLowerCase()

  const matches = entries.filter((entry) => entry.value.toLowerCase().includes(indicator) || entry.id.toLowerCase().includes(indicator))
  writeOutput(options.write, {
    status: 'ok',
    indicator: options.indicator,
    matched: matches.length > 0,
    matches,
  })
}
