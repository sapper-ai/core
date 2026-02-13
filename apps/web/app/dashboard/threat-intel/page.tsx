'use client'

import { useEffect, useState } from 'react'

import type { Policy } from '@sapper-ai/types'

import { IntelStatusCards } from './components/intel-status-cards'
import { IndicatorCheck } from './components/indicator-check'
import { EntriesTable } from './components/entries-table'
import { SyncPanel } from './components/sync-panel'

type ThreatIntelStatusResponse = {
  totalEntries: number
  byType: Record<string, number>
  bySeverity: Record<string, number>
  bySource: { source: string; count: number }[]
  lastSyncedAt: string
  cachePath: string
}

type PolicyReadResponse = {
  policy: Policy
  rawYaml: string
  filePath: string
  lastModified: string
}

function getPolicySources(policy: Policy | null): string[] {
  const sources = policy?.threatFeed?.sources
  if (!Array.isArray(sources)) return []
  return sources.filter((s) => typeof s === 'string' && s.trim().length > 0).map((s) => s.trim())
}

export default function ThreatIntelPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<ThreatIntelStatusResponse | null>(null)
  const [policy, setPolicy] = useState<Policy | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const load = async (): Promise<void> => {
    setError(null)
    try {
      const [statusRes, policyRes] = await Promise.all([
        fetch('/api/dashboard/threat-intel', { cache: 'no-store' }),
        fetch('/api/dashboard/policy', { cache: 'no-store' }),
      ])

      const statusPayload = (await statusRes.json()) as ThreatIntelStatusResponse | { error?: string }
      if (!statusRes.ok) {
        const msg = 'error' in statusPayload && statusPayload.error ? statusPayload.error : 'Failed to load status.'
        throw new Error(msg)
      }

      const policyPayload = (await policyRes.json()) as PolicyReadResponse | { error?: string }
      if (policyRes.ok) {
        setPolicy((policyPayload as PolicyReadResponse).policy)
      }

      setStatus(statusPayload as ThreatIntelStatusResponse)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(msg)
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const onSynced = () => {
    setRefreshKey((k) => k + 1)
    void load()
  }

  const sources = getPolicySources(policy)

  if (loading && !status) {
    return <div className="grid place-items-center py-16 text-sm text-steel">Loading...</div>
  }

  return (
    <div className="grid gap-6">
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 shadow-subtle">
          {error}
        </div>
      )}

      {status && <IntelStatusCards status={status} />}

      <section className="grid gap-4 lg:grid-cols-2">
        <SyncPanel initialSources={sources} onSynced={onSynced} />
        <IndicatorCheck onChecked={() => setRefreshKey((k) => k + 1)} />
      </section>

      <EntriesTable refreshKey={refreshKey} />
    </div>
  )
}
