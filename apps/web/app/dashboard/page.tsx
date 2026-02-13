'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { RiskBar } from '@/app/components/risk-bar'
import { StatusBadge } from '@/app/components/status-badge'
import { formatPercent, formatTimestamp } from '@/app/components/utils'

import { MetricCard } from './components/metric-card'
import { ThreatList } from './components/threat-list'
import { TimelineChart } from './components/timeline-chart'

import type { ThreatCategory } from '@/app/api/shared/threat-categories'

type MetricsResponse = {
  totalRequests: number
  blockedRequests: number
  allowedRequests: number
  blockRate: number
  avgLatencyMs: number
  topThreats: { category: ThreatCategory; label: string; count: number }[]
  timeline: { hour: string; total: number; blocked: number }[]
  recentActivity: {
    timestamp: string
    toolName: string
    action: 'allow' | 'block'
    risk: number
  }[]
}

function formatMs(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return value.toFixed(1)
}

export default function DashboardOverviewPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<MetricsResponse | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  const fetchMetrics = useCallback(async (): Promise<void> => {
    setError(null)
    try {
      const res = await fetch('/api/dashboard/metrics', { cache: 'no-store' })
      const payload = (await res.json()) as MetricsResponse | { error?: string }
      if (!res.ok) {
        const msg = 'error' in payload && payload.error ? payload.error : '메트릭을 불러오지 못했습니다.'
        throw new Error(msg)
      }
      setData(payload as MetricsResponse)
      setLastUpdated(new Date().toISOString())
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.'
      setError(msg)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchMetrics()
    const id = window.setInterval(() => {
      void fetchMetrics()
    }, 30_000)
    return () => {
      window.clearInterval(id)
    }
  }, [fetchMetrics])

  const summary = useMemo(() => {
    const empty: MetricsResponse = {
      totalRequests: 0,
      blockedRequests: 0,
      allowedRequests: 0,
      blockRate: 0,
      avgLatencyMs: 0,
      topThreats: [],
      timeline: [],
      recentActivity: [],
    }
    return data ?? empty
  }, [data])

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-ink">Overview</p>
          <p className="mt-1 text-xs text-steel">
            Auto-refresh every 30 seconds{lastUpdated ? ` • Updated ${formatTimestamp(lastUpdated)}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchMetrics()}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-ink shadow-subtle transition hover:bg-muted"
          disabled={loading}
        >
          {loading && (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-steel border-t-transparent" />
          )}
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 shadow-subtle">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total Requests" value={summary.totalRequests} />
        <MetricCard label="Blocked" value={summary.blockedRequests} variant={summary.blockedRequests > 0 ? 'danger' : 'default'} />
        <MetricCard label="Block Rate" value={formatPercent(summary.blockRate)} />
        <MetricCard label="Avg Latency" value={`${formatMs(summary.avgLatencyMs)}ms`} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <TimelineChart data={summary.timeline} />
        <ThreatList threats={summary.topThreats} />
      </section>

      <section className="grid gap-4 rounded-2xl border border-border bg-white p-5 shadow-subtle">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">Recent Activity</p>
          <p className="text-xs text-steel">Last 10</p>
        </div>

        {loading && !data ? (
          <div className="grid place-items-center py-10 text-sm text-steel">Loading...</div>
        ) : summary.recentActivity.length === 0 ? (
          <div className="grid place-items-center py-10 text-sm text-steel">No audit log data found.</div>
        ) : (
          <div className="overflow-auto rounded-xl border border-border bg-white">
            <div className="min-w-[720px]">
              <div className="sticky top-0 z-10 grid grid-cols-[180px_1fr_120px_1fr] gap-3 border-b border-border bg-muted px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-steel">
                <div>Timestamp</div>
                <div>Tool</div>
                <div>Action</div>
                <div>Risk</div>
              </div>

              <ul className="divide-y divide-border">
                {summary.recentActivity.map((entry) => (
                  <li key={entry.timestamp} className="grid grid-cols-[180px_1fr_120px_1fr] gap-3 px-4 py-3 text-xs">
                    <div className="text-steel tabular-nums">{formatTimestamp(entry.timestamp)}</div>
                    <div className="font-medium text-ink">{entry.toolName}</div>
                    <div>
                      <StatusBadge variant={entry.action === 'block' ? 'block' : 'allow'} />
                    </div>
                    <div className="grid gap-1">
                      <div className="flex items-center justify-between text-[11px] text-steel">
                        <span className="font-medium tabular-nums">{formatPercent(entry.risk)}</span>
                      </div>
                      <RiskBar value={entry.risk} height="sm" />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
