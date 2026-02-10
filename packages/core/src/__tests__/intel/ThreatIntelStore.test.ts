import { createServer } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { ThreatIntelStore, buildMatchListFromIntel } from '../../intel/ThreatIntelStore'

describe('ThreatIntelStore', () => {
  const tempDirs: string[] = []
  const servers: Array<{ close: () => void }> = []

  afterEach(() => {
    for (const server of servers) {
      server.close()
    }

    servers.length = 0

    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('syncs entries from remote source and persists snapshot', async () => {
    const root = mkdtempSync(join(tmpdir(), 'intel-store-'))
    tempDirs.push(root)

    const server = createServer((req, res) => {
      if (req.url === '/feed') {
        res.setHeader('content-type', 'application/json')
        res.end(
          JSON.stringify({
            entries: [
              {
                id: 'malicious-tool-1',
                type: 'toolName',
                value: 'evil_tool',
                reason: 'Known malware',
                severity: 'critical',
              },
              {
                type: 'urlPattern',
                value: 'evil\\.example',
              },
            ],
          })
        )
        return
      }

      res.statusCode = 404
      res.end('not found')
    })

    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve())
    })
    servers.push(server)

    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Server did not provide numeric port')
    }

    const feedUrl = `http://127.0.0.1:${address.port}/feed`
    const store = new ThreatIntelStore({
      cachePath: join(root, 'intel.json'),
    })

    const syncResult = await store.syncFromSources([feedUrl])
    expect(syncResult.acceptedEntries).toBe(2)

    const snapshot = await store.loadSnapshot()
    expect(snapshot.entries).toHaveLength(2)
    expect(snapshot.entries[0]?.id).toBe('malicious-tool-1')

    const matchList = buildMatchListFromIntel(snapshot.entries)
    expect(matchList.toolNames).toContain('evil_tool')
    expect(matchList.urlPatterns).toContain('evil\\.example')
  })
})
