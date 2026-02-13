'use client'

import type { AuditLogEntry } from '@sapper-ai/types'

export function AuditDetail({ entry }: { entry: AuditLogEntry }) {
  return (
    <div className="grid gap-4 rounded-xl border border-border bg-muted p-4">
      <div className="grid gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-steel">Reasons</p>
        {entry.decision.reasons.length === 0 ? (
          <p className="text-sm text-steel">No reasons</p>
        ) : (
          <ul className="list-disc pl-5 text-sm text-steel">
            {entry.decision.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-steel">Evidence</p>
        {entry.decision.evidence.length === 0 ? (
          <p className="text-sm text-steel">No evidence</p>
        ) : (
          <div className="grid gap-2">
            {entry.decision.evidence.map((evidence) => (
              <div key={evidence.detectorId} className="rounded-lg border border-border bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-steel">
                  <span className="font-semibold text-ink">{evidence.detectorId}</span>
                  <span className="tabular-nums">risk {evidence.risk.toFixed(2)} • conf {evidence.confidence.toFixed(2)}</span>
                </div>
                <ul className="mt-2 list-disc pl-5 text-xs text-steel">
                  {evidence.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      <details className="rounded-lg border border-border bg-white p-3">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-steel">
          Raw Context
        </summary>
        <pre className="mt-3 overflow-auto text-xs text-ink">{JSON.stringify(entry.context, null, 2)}</pre>
      </details>
    </div>
  )
}
