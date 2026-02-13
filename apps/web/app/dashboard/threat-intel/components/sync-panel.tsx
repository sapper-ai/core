'use client'

import { useEffect, useMemo, useState } from 'react'

type SyncResponse = {
  sourceCount: number
  acceptedEntries: number
  skippedEntries: number
  updatedAt: string
  errors: { source: string; message: string }[]
}

export function SyncPanel({
  initialSources,
  onSynced,
}: {
  initialSources: string[]
  onSynced: () => void
}) {
  const [sources, setSources] = useState<string[]>([])
  const [newSource, setNewSource] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SyncResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSources(initialSources)
  }, [initialSources])

  const normalizedSources = useMemo(() => {
    const list = sources.map((s) => s.trim()).filter((s) => s.length > 0)
    return Array.from(new Set(list))
  }, [sources])

  const handleAdd = () => {
    const value = newSource.trim()
    if (!value) return
    setSources((prev) => [...prev, value])
    setNewSource('')
  }

  const handleRemove = (index: number) => {
    setSources((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSync = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const body = normalizedSources.length > 0 ? { sources: normalizedSources } : {}
      const response = await fetch('/api/dashboard/threat-intel/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = (await response.json()) as SyncResponse | { error?: string }

      if (!response.ok) {
        const message = 'error' in payload && payload.error ? payload.error : 'Sync failed.'
        throw new Error(message)
      }

      setResult(payload as SyncResponse)
      onSynced()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="grid gap-4 rounded-2xl border border-border bg-white p-6 shadow-subtle">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">Sync Panel</p>
          <p className="mt-1 text-xs text-steel">This list resets on page refresh.</p>
        </div>
        <button
          type="button"
          onClick={() => void handleSync()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading && <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
          Sync Now
        </button>
      </div>

      <div className="grid gap-3">
        <div className="grid gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-steel">Source URLs</p>
          {normalizedSources.length === 0 ? (
            <div className="rounded-xl border border-border bg-muted p-4 text-sm text-steel">
              No sources. Add a URL or sync with policy defaults.
            </div>
          ) : (
            <ul className="grid gap-2">
              {normalizedSources.map((source, index) => (
                <li key={`${source}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted px-4 py-3">
                  <p className="break-all text-xs text-ink">{source}</p>
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-subtle transition hover:bg-muted"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={newSource}
            onChange={(e) => setNewSource(e.target.value)}
            placeholder="https://example.com/threat-feed.json"
            className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAdd()
              }
            }}
          />
          <button
            type="button"
            onClick={handleAdd}
            className="h-10 rounded-lg border border-border bg-white px-4 text-sm font-semibold text-ink shadow-subtle transition hover:bg-muted"
          >
            + Add Source
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="grid gap-3 rounded-xl border border-border bg-muted p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border bg-white px-3 py-1 text-[11px] font-medium text-steel">
              Sources {result.sourceCount}
            </span>
            <span className="rounded-full border border-border bg-white px-3 py-1 text-[11px] font-medium text-steel">
              Total stored entries {result.acceptedEntries}
            </span>
            <span className="rounded-full border border-border bg-white px-3 py-1 text-[11px] font-medium text-steel">
              Skipped {result.skippedEntries}
            </span>
            {result.updatedAt && (
              <span className="rounded-full border border-border bg-white px-3 py-1 text-[11px] font-medium text-steel">
                Updated {result.updatedAt}
              </span>
            )}
          </div>

          {result.errors.length > 0 && (
            <div className="grid gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-steel">Partial failures</p>
              <ul className="grid gap-1">
                {result.errors.map((item) => (
                  <li key={`${item.source}-${item.message}`} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    <span className="font-semibold">{item.source}</span>: {item.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
