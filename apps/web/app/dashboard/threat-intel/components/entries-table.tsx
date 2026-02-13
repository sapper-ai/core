'use client'

import { useEffect, useMemo, useState } from 'react'

import type { ThreatIntelEntry } from '@sapper-ai/core'

import { StatusBadge } from '@/app/components/status-badge'
import { formatTimestamp } from '@/app/components/utils'
import { Pagination } from '@/app/dashboard/audit/components/pagination'

type ThreatIntelEntriesResponse = {
  entries: ThreatIntelEntry[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

type Filters = {
  type: string
  severity: string
  search: string
}

function severityVariant(severity: string): 'critical' | 'warning' | 'clear' {
  if (severity === 'critical' || severity === 'high') return 'critical'
  if (severity === 'medium') return 'warning'
  return 'clear'
}

export function EntriesTable({ refreshKey }: { refreshKey: number }) {
  const [filters, setFilters] = useState<Filters>({ type: '', severity: '', search: '' })
  const [applied, setApplied] = useState<Filters>({ type: '', severity: '', search: '' })
  const [page, setPage] = useState(1)
  const [limit] = useState(50)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ThreatIntelEntriesResponse | null>(null)

  const query = useMemo(() => {
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('limit', String(limit))
    if (applied.type) params.set('type', applied.type)
    if (applied.severity) params.set('severity', applied.severity)
    if (applied.search.trim().length > 0) params.set('search', applied.search.trim())
    return params.toString()
  }, [applied, page, limit])

  const fetchEntries = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/dashboard/threat-intel/entries?${query}`, { cache: 'no-store' })
      const payload = (await response.json()) as ThreatIntelEntriesResponse | { error?: string }
      if (!response.ok) {
        const message = 'error' in payload && payload.error ? payload.error : 'Failed to load entries.'
        throw new Error(message)
      }
      setData(payload as ThreatIntelEntriesResponse)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      setError(message)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchEntries()
  }, [query, refreshKey])

  const pagination = data?.pagination ?? { page: 1, limit, total: 0, totalPages: 1 }
  const entries = data?.entries ?? []

  return (
    <section className="grid gap-4 rounded-2xl border border-border bg-white p-6 shadow-subtle">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">Entries</p>
          <p className="mt-1 text-xs text-steel">Paginated view (MAX_ENTRIES 10K assumed)</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="grid gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-steel">Type</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="h-9 rounded-lg border border-border bg-white px-3 text-sm text-ink"
            >
              <option value="">All</option>
              <option value="toolName">toolName</option>
              <option value="packageName">packageName</option>
              <option value="urlPattern">urlPattern</option>
              <option value="contentPattern">contentPattern</option>
              <option value="sha256">sha256</option>
            </select>
          </div>

          <div className="grid gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-steel">Severity</label>
            <select
              value={filters.severity}
              onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
              className="h-9 rounded-lg border border-border bg-white px-3 text-sm text-ink"
            >
              <option value="">All</option>
              <option value="critical">critical</option>
              <option value="high">high</option>
              <option value="medium">medium</option>
              <option value="low">low</option>
            </select>
          </div>

          <div className="grid gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-steel">Search</label>
            <input
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="malicious"
              className="h-9 rounded-lg border border-border bg-white px-3 text-sm text-ink"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  setApplied(filters)
                  setPage(1)
                }
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setApplied(filters)
              setPage(1)
            }}
            className="h-9 rounded-lg bg-ink px-4 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            Apply
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid place-items-center py-10 text-sm text-steel">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted p-6 text-sm text-steel">No entries found.</div>
      ) : (
        <div className="overflow-auto rounded-xl border border-border bg-white">
          <div className="min-w-[980px]">
            <div className="sticky top-0 z-10 grid grid-cols-[120px_minmax(260px,1fr)_120px_200px_170px_170px] gap-3 border-b border-border bg-muted px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-steel">
              <div>Type</div>
              <div>Value</div>
              <div>Severity</div>
              <div>Source</div>
              <div>Added</div>
              <div>Expires</div>
            </div>
            <ul className="divide-y divide-border">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  className="grid grid-cols-[120px_minmax(260px,1fr)_120px_200px_170px_170px] gap-3 px-4 py-3 text-xs transition hover:bg-muted/50"
                >
                  <div className="font-medium text-ink">{entry.type}</div>
                  <div className="break-all text-steel">{entry.value}</div>
                  <div>
                    <StatusBadge variant={severityVariant(entry.severity)} label={entry.severity} />
                  </div>
                  <div className="break-all text-steel">{entry.source}</div>
                  <div className="tabular-nums text-steel">{formatTimestamp(entry.addedAt)}</div>
                  <div className="tabular-nums text-steel">{entry.expiresAt ? formatTimestamp(entry.expiresAt) : '—'}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        onPageChange={(next) => {
          setPage(next)
        }}
      />
    </section>
  )
}
