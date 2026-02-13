'use client'

import type { AdversaryCampaignResponse } from '@/app/components/types'

import { CircularGauge } from '@/app/components/circular-gauge'
import { RiskBar } from '@/app/components/risk-bar'
import { StatusBadge } from '@/app/components/status-badge'
import { clampRisk, formatPercent, severityLabels, typeLabels } from '@/app/components/utils'

export function CampaignResults({ result }: { result: AdversaryCampaignResponse }) {
  return (
    <section className="grid gap-6 rounded-2xl border border-border bg-white p-7 shadow-subtle md:p-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <CircularGauge value={result.detectionRate} label="detect" />
          <div className="grid gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-steel">Campaign Stats</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-border bg-muted px-3 py-1 text-[11px] font-medium text-steel">
                Total {result.totalCases}
              </span>
              <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-medium text-red-600">
                Blocked {result.blockedCases}
              </span>
              <span className="rounded-full border border-border bg-muted px-3 py-1 text-[11px] font-medium text-steel">
                Model {result.model}
              </span>
            </div>
            <p className="text-xs text-steel">
              Run ID: <span className="font-medium text-ink">{result.runId}</span>
            </p>
          </div>
        </div>

        <div className="grid gap-2 rounded-xl border border-border bg-muted p-3 sm:min-w-[220px]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-steel">Blocked / Total</p>
          <p className="text-2xl font-bold tabular-nums text-ink">
            {result.blockedCases}/{result.totalCases}
          </p>
          <RiskBar value={result.totalCases > 0 ? result.blockedCases / result.totalCases : 0} height="md" />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="grid gap-2">
          <p className="text-sm font-semibold text-ink">Type Distribution</p>
          {result.typeDistribution.map((item) => {
            const ratio = item.total > 0 ? item.blocked / item.total : 0
            return (
              <div key={item.key} className="grid gap-1">
                <div className="flex items-center justify-between text-xs text-steel">
                  <span>{typeLabels[item.key] ?? item.key}</span>
                  <span className="tabular-nums">
                    {item.blocked}/{item.total}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div className="h-2.5 rounded-full bg-signal transition-all" style={{ width: `${ratio * 100}%` }} />
                  </div>
                  <span className="w-14 text-right text-[11px] font-medium tabular-nums text-steel">
                    {formatPercent(ratio)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="grid gap-2">
          <p className="text-sm font-semibold text-ink">Severity Distribution</p>
          {result.severityDistribution.map((item) => {
            const ratio = item.total > 0 ? item.blocked / item.total : 0
            return (
              <div key={item.key} className="grid gap-1">
                <div className="flex items-center justify-between text-xs text-steel">
                  <span>{severityLabels[item.key] ?? item.key}</span>
                  <span className="tabular-nums">
                    {item.blocked}/{item.total}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div className="h-2.5 rounded-full bg-ember transition-all" style={{ width: `${ratio * 100}%` }} />
                  </div>
                  <span className="w-14 text-right text-[11px] font-medium tabular-nums text-steel">
                    {formatPercent(ratio)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid gap-2">
        <p className="text-sm font-semibold text-ink">Top Detection Reasons</p>
        <ul className="grid gap-1.5">
          {result.topReasons.map((reason) => (
            <li key={reason} className="rounded-lg border border-border bg-muted px-3 py-2 text-xs text-steel">
              {reason}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink">Cases</p>
          <p className="text-xs text-steel">{result.cases.length}건</p>
        </div>

        <div className="max-h-80 overflow-auto rounded-xl border border-border bg-white">
          <div className="min-w-[860px]">
            <div className="sticky top-0 z-10 grid grid-cols-[minmax(260px,1.2fr)_160px_120px_110px_1fr] gap-3 border-b border-border bg-muted px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-steel">
              <div>Label</div>
              <div>Type</div>
              <div>Severity</div>
              <div>Action</div>
              <div>Risk</div>
            </div>
            <ul className="divide-y divide-border">
              {result.cases.map((entry) => {
                const riskValue = clampRisk(entry.decision.risk)
                const severityVariant =
                  entry.severity === 'critical' || entry.severity === 'high'
                    ? 'critical'
                    : entry.severity === 'medium'
                      ? 'warning'
                      : 'clear'
                return (
                  <li
                    key={entry.id}
                    className="grid grid-cols-[minmax(260px,1.2fr)_160px_120px_110px_1fr] gap-3 px-4 py-3 text-xs transition hover:bg-muted/50"
                  >
                    <div className="grid gap-1">
                      <p className="font-medium text-ink">{entry.label}</p>
                      <p className="text-[11px] text-steel">{entry.decision.reasons[0] ?? '탐지 사유 없음'}</p>
                    </div>
                    <div className="flex items-center text-steel">{typeLabels[entry.type] ?? entry.type}</div>
                    <div className="flex items-center">
                      <StatusBadge variant={severityVariant} label={severityLabels[entry.severity] ?? entry.severity} />
                    </div>
                    <div className="flex items-center">
                      <StatusBadge variant={entry.decision.action === 'block' ? 'block' : 'allow'} />
                    </div>
                    <div className="grid gap-1">
                      <div className="flex items-center justify-between text-[11px] text-steel">
                        <span className="font-medium tabular-nums">{formatPercent(riskValue)}</span>
                        <span className="tabular-nums">conf {formatPercent(entry.decision.confidence)}</span>
                      </div>
                      <RiskBar value={riskValue} height="sm" />
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
