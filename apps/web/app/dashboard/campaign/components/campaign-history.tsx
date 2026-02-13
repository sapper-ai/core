'use client'

import { formatPercent, formatTimestamp } from '@/app/components/utils'

export type CampaignHistoryEntry = {
  runId: string
  timestamp: string
  detectionRate: number
  totalCases: number
  blockedCases: number
  policyType: 'configured' | 'default'
}

export function CampaignHistory({ history }: { history: CampaignHistoryEntry[] }) {
  return (
    <section className="grid gap-4 rounded-2xl border border-border bg-white p-6 shadow-subtle">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">History</p>
        <p className="text-xs text-steel">Last 5</p>
      </div>

      {history.length === 0 ? (
        <p className="text-sm text-steel">No runs yet.</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-white">
          {history.map((entry) => (
            <li key={entry.runId} className="grid gap-1 px-4 py-3 text-xs">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-ink">{formatPercent(entry.detectionRate)}</p>
                <p className="text-steel tabular-nums">{formatTimestamp(entry.timestamp)}</p>
              </div>
              <p className="text-steel">
                {entry.blockedCases}/{entry.totalCases} blocked • {entry.policyType === 'default' ? 'default policy' : 'configured policy'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
