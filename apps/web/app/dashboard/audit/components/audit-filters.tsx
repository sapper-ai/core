'use client'

export type FilterState = {
  action?: 'allow' | 'block'
  minRisk?: number
  toolName?: string
  from?: string
  to?: string
}

export function AuditFilters({
  filters,
  onChange,
  onSearch,
  onReset,
  onExport,
}: {
  filters: FilterState
  onChange: (f: FilterState) => void
  onSearch: () => void
  onReset: () => void
  onExport: (format: 'csv' | 'json') => void
}) {
  const minRiskValue = typeof filters.minRisk === 'number' ? filters.minRisk : 0

  return (
    <div className="grid gap-4 rounded-2xl border border-border bg-white p-5 shadow-subtle">
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="grid gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-steel">Action</label>
          <select
            value={filters.action ?? ''}
            onChange={(e) => onChange({ ...filters, action: (e.target.value || undefined) as FilterState['action'] })}
            className="h-10 rounded-lg border border-border bg-white px-3 text-sm text-ink"
          >
            <option value="">All</option>
            <option value="allow">Allow</option>
            <option value="block">Block</option>
          </select>
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-steel">Min Risk</label>
            <span className="text-xs font-semibold tabular-nums text-ink">{minRiskValue.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={minRiskValue}
            onChange={(e) => onChange({ ...filters, minRisk: Number.parseFloat(e.target.value) })}
          />
        </div>

        <div className="grid gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-steel">Tool Name</label>
          <input
            value={filters.toolName ?? ''}
            onChange={(e) => onChange({ ...filters, toolName: e.target.value })}
            placeholder="shell"
            className="h-10 rounded-lg border border-border bg-white px-3 text-sm text-ink"
          />
        </div>

        <div className="grid gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-steel">From</label>
          <input
            type="date"
            value={filters.from ?? ''}
            onChange={(e) => onChange({ ...filters, from: e.target.value || undefined })}
            className="h-10 rounded-lg border border-border bg-white px-3 text-sm text-ink"
          />
        </div>

        <div className="grid gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-steel">To</label>
          <input
            type="date"
            value={filters.to ?? ''}
            onChange={(e) => onChange({ ...filters, to: e.target.value || undefined })}
            className="h-10 rounded-lg border border-border bg-white px-3 text-sm text-ink"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSearch}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            Search
          </button>
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-ink shadow-subtle transition hover:bg-muted"
          >
            Reset
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onExport('csv')}
            className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-ink shadow-subtle transition hover:bg-muted"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => onExport('json')}
            className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-ink shadow-subtle transition hover:bg-muted"
          >
            Export JSON
          </button>
        </div>
      </div>
    </div>
  )
}
