'use client'

import { useEffect, useMemo, useState } from 'react'

import type { AuditLogEntry } from '@sapper-ai/types'

import { AuditFilters, type FilterState } from './components/audit-filters'
import { AuditTable } from './components/audit-table'
import { Pagination } from './components/pagination'

type AuditLogsResponse = {
  entries: AuditLogEntry[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

function toIsoRange(value: string | undefined, endOfDay: boolean): string | undefined {
  if (!value) return undefined
  if (endOfDay) return `${value}T23:59:59Z`
  return `${value}T00:00:00Z`
}

function buildQuery(filters: FilterState, page: number, limit: number): string {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('limit', String(limit))

  if (filters.action) params.set('action', filters.action)
  if (typeof filters.minRisk === 'number') params.set('minRisk', String(filters.minRisk))
  if (filters.toolName && filters.toolName.trim().length > 0) params.set('toolName', filters.toolName.trim())
  const from = toIsoRange(filters.from, false)
  const to = toIsoRange(filters.to, true)
  if (from) params.set('from', from)
  if (to) params.set('to', to)

  return params.toString()
}

async function downloadExport(url: string, filename: string) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('Export failed')
  }
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  a.click()
  URL.revokeObjectURL(objectUrl)
}

export default function AuditLogPage() {
  const [filters, setFilters] = useState<FilterState>({ minRisk: 0 })
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({ minRisk: 0 })
  const [page, setPage] = useState(1)
  const [limit] = useState(50)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<AuditLogsResponse | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const query = useMemo(() => buildQuery(appliedFilters, page, limit), [appliedFilters, page, limit])

  const fetchLogs = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/dashboard/audit-logs?${query}`, { cache: 'no-store' })
      const payload = (await res.json()) as AuditLogsResponse | { error?: string }
      if (!res.ok) {
        const msg = 'error' in payload && payload.error ? payload.error : '감사 로그를 불러오지 못했습니다.'
        throw new Error(msg)
      }
      setData(payload as AuditLogsResponse)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.'
      setError(msg)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchLogs()
  }, [query])

  const pagination = data?.pagination ?? { page: 1, limit, total: 0, totalPages: 1 }
  const entries = data?.entries ?? []

  const showingFrom = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1
  const showingTo = Math.min(pagination.total, pagination.page * pagination.limit)

  const onSearch = () => {
    setAppliedFilters(filters)
    setPage(1)
    setExpandedId(null)
  }

  const onReset = () => {
    const cleared: FilterState = { minRisk: 0 }
    setFilters(cleared)
    setAppliedFilters(cleared)
    setPage(1)
    setExpandedId(null)
  }

  const onExport = async (format: 'csv' | 'json') => {
    const qs = buildQuery(appliedFilters, 1, 1)
    const url = `/api/dashboard/audit-logs/export?${qs}&format=${format}`
    const filename = format === 'csv' ? 'sapperai-audit.csv' : 'sapperai-audit.json'
    try {
      await downloadExport(url, filename)
    } catch {
      setError('Export failed')
    }
  }

  return (
    <div className="grid gap-6">
      <AuditFilters
        filters={filters}
        onChange={setFilters}
        onSearch={onSearch}
        onReset={onReset}
        onExport={(format) => void onExport(format)}
      />

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 shadow-subtle">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-steel">
          Results: Showing{' '}
          <span className="font-semibold tabular-nums text-ink">{showingFrom}</span>-{
            <span className="font-semibold tabular-nums text-ink">{showingTo}</span>
          }{' '}
          of <span className="font-semibold tabular-nums text-ink">{pagination.total}</span> entries
        </p>
        <button
          type="button"
          onClick={() => void fetchLogs()}
          className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-ink shadow-subtle transition hover:bg-muted"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="grid place-items-center py-16 text-sm text-steel">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-border bg-white p-8 text-center text-sm text-steel shadow-subtle">
          No audit log entries found.
        </div>
      ) : (
        <AuditTable
          entries={entries}
          expandedId={expandedId}
          onToggle={(id) => setExpandedId(expandedId === id ? null : id)}
        />
      )}

      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        onPageChange={(next) => {
          setPage(next)
          setExpandedId(null)
        }}
      />
    </div>
  )
}
