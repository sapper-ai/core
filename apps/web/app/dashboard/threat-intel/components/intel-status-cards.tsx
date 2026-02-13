'use client'

import { MetricCard } from '@/app/dashboard/components/metric-card'
import { formatTimestamp } from '@/app/components/utils'

type ThreatIntelStatusResponse = {
  totalEntries: number
  byType: Record<string, number>
  bySeverity: Record<string, number>
  bySource: { source: string; count: number }[]
  lastSyncedAt: string
  cachePath: string
}

export function IntelStatusCards({ status }: { status: ThreatIntelStatusResponse }) {
  const sources = status.bySource.length
  const typeCount = Object.keys(status.byType).length
  const lastSyncedLabel = status.lastSyncedAt ? formatTimestamp(status.lastSyncedAt) : '—'

  return (
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard label="Total Entries" value={status.totalEntries} />
      <MetricCard label="Sources" value={sources} />
      <MetricCard label="Last Synced" value={lastSyncedLabel} subtext={status.lastSyncedAt ? status.lastSyncedAt : undefined} />
      <MetricCard label="Types" value={typeCount} subtext={status.cachePath} />
    </section>
  )
}
