import { createServer } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import type { Policy } from '@sapper-ai/types'

import {
  runBlocklistCheckCommand,
  runBlocklistListCommand,
  runBlocklistStatusCommand,
  runBlocklistSyncCommand,
} from '../commands/blocklist'

const policy: Policy = {
  mode: 'enforce',
  defaultAction: 'allow',
  failOpen: true,
  threatFeed: {
    enabled: true,
  },
} as Policy

describe('blocklist commands', () => {
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

  it('sync/status/list/check flow works with cache file', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'sapper-blocklist-cmd-'))
    tempDirs.push(rootDir)
    const cachePath = join(rootDir, 'intel.json')

    const server = createServer((req, res) => {
      if (req.url === '/feed') {
        res.setHeader('content-type', 'application/json')
        res.end(
          JSON.stringify({
            entries: [
              {
                id: 'ghsa-test-001',
                type: 'packageName',
                value: 'malicious-package',
                reason: 'Known malicious package',
                severity: 'critical',
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
      throw new Error('Expected numeric address')
    }

    const source = `http://127.0.0.1:${address.port}/feed`

    const syncOutputs: string[] = []
    await runBlocklistSyncCommand({
      policy,
      sources: [source],
      cachePath,
      write: (text) => syncOutputs.push(text),
    })
    const syncPayload = JSON.parse(syncOutputs.join('')) as { acceptedEntries: number }
    expect(syncPayload.acceptedEntries).toBe(1)

    const statusOutputs: string[] = []
    await runBlocklistStatusCommand({
      cachePath,
      write: (text) => statusOutputs.push(text),
    })
    const statusPayload = JSON.parse(statusOutputs.join('')) as { count: number }
    expect(statusPayload.count).toBe(1)

    const listOutputs: string[] = []
    await runBlocklistListCommand({
      cachePath,
      write: (text) => listOutputs.push(text),
    })
    const listPayload = JSON.parse(listOutputs.join('')) as { entries: Array<{ id: string }> }
    expect(listPayload.entries[0]?.id).toBe('ghsa-test-001')

    const checkOutputs: string[] = []
    await runBlocklistCheckCommand({
      cachePath,
      indicator: 'malicious-package',
      write: (text) => checkOutputs.push(text),
    })
    const checkPayload = JSON.parse(checkOutputs.join('')) as { matched: boolean }
    expect(checkPayload.matched).toBe(true)
  })
})
