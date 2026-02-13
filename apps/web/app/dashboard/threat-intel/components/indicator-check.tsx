'use client'

import { useState } from 'react'

import type { ThreatIntelEntry } from '@sapper-ai/core'

type CheckResponse = {
  indicator: string
  matches: ThreatIntelEntry[]
  matched: boolean
}

export function IndicatorCheck({ onChecked }: { onChecked: () => void }) {
  const [indicator, setIndicator] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CheckResponse | null>(null)

  const handleCheck = async (): Promise<void> => {
    const value = indicator.trim()
    if (!value) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/dashboard/threat-intel/check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ indicator: value }),
      })
      const payload = (await response.json()) as CheckResponse | { error?: string }
      if (!response.ok) {
        const message = 'error' in payload && payload.error ? payload.error : 'Check failed.'
        throw new Error(message)
      }
      setResult(payload as CheckResponse)
      onChecked()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="grid gap-4 rounded-2xl border border-border bg-white p-6 shadow-subtle">
      <div>
        <p className="text-sm font-semibold text-ink">Indicator Check</p>
        <p className="mt-1 text-xs text-steel">Check a single indicator against cached intel entries.</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={indicator}
          onChange={(e) => setIndicator(e.target.value)}
          placeholder="toolName / sha256 / URL / keyword"
          className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void handleCheck()
            }
          }}
        />
        <button
          type="button"
          onClick={() => void handleCheck()}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 text-sm font-semibold text-ink shadow-subtle transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading && (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-steel border-t-transparent" />
          )}
          Check
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="grid gap-2 rounded-xl border border-border bg-muted p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-steel">
            {result.matched ? `Matched (${result.matches.length})` : 'No match'}
          </p>
          {result.matched && (
            <ul className="grid gap-2">
              {result.matches.slice(0, 10).map((entry) => (
                <li key={entry.id} className="rounded-lg border border-border bg-white px-3 py-2">
                  <p className="text-xs font-semibold text-ink">{entry.type}: {entry.value}</p>
                  <p className="mt-1 text-xs text-steel">{entry.severity} • {entry.source}</p>
                  <p className="mt-1 text-[11px] text-steel">{entry.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
