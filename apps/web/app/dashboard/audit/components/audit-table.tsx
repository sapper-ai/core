'use client'

import type { AuditLogEntry } from '@sapper-ai/types'

import { RiskBar } from '@/app/components/risk-bar'
import { StatusBadge } from '@/app/components/status-badge'
import { formatPercent, formatTimestamp } from '@/app/components/utils'

import { AuditDetail } from './audit-detail'

export function AuditTable({
  entries,
  expandedId,
  onToggle,
}: {
  entries: AuditLogEntry[]
  expandedId: string | null
  onToggle: (id: string) => void
}) {
  return (
    <div className="overflow-auto rounded-2xl border border-border bg-white shadow-subtle">
      <div className="min-w-[980px]">
        <div className="sticky top-0 z-10 grid grid-cols-[200px_180px_110px_1fr_120px_100px] gap-3 border-b border-border bg-muted px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-steel">
          <div>Timestamp</div>
          <div>Tool</div>
          <div>Action</div>
          <div>Risk</div>
          <div>Confidence</div>
          <div>ms</div>
        </div>

        <ul className="divide-y divide-border">
          {entries.map((entry) => {
            const id = entry.timestamp
            const isExpanded = expandedId === id
            const toolName = entry.context.toolCall?.toolName ?? 'unknown'

            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onToggle(id)}
                  className="w-full text-left"
                >
                  <div className="grid grid-cols-[200px_180px_110px_1fr_120px_100px] gap-3 px-4 py-3 text-xs transition hover:bg-muted/50">
                    <div className="tabular-nums text-steel">{formatTimestamp(entry.timestamp)}</div>
                    <div className="font-medium text-ink">{toolName}</div>
                    <div>
                      <StatusBadge variant={entry.decision.action === 'block' ? 'block' : 'allow'} />
                    </div>
                    <div className="grid gap-1">
                      <div className="flex items-center justify-between text-[11px] text-steel">
                        <span className="font-medium tabular-nums">{formatPercent(entry.decision.risk)}</span>
                      </div>
                      <RiskBar value={entry.decision.risk} height="sm" />
                    </div>
                    <div className="tabular-nums text-steel">{entry.decision.confidence.toFixed(2)}</div>
                    <div className="tabular-nums text-steel">{entry.durationMs}</div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4">
                    <AuditDetail entry={entry} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
