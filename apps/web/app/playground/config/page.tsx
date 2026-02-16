'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import type { Policy } from '@sapper-ai/types'

type PolicyReadResponse = {
  policy: Policy
  rawYaml: string
  filePath: string
  lastModified: string
}

function formatDateTime(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export default function PlaygroundConfigPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PolicyReadResponse | null>(null)

  const load = useCallback(async (): Promise<void> => {
    setError(null)
    try {
      const res = await fetch('/api/policy', { cache: 'no-store' })
      const payload = (await res.json()) as PolicyReadResponse | { error?: string }
      if (!res.ok) {
        const msg = 'error' in payload && payload.error ? payload.error : '정책을 불러오지 못했습니다.'
        throw new Error(msg)
      }
      setData(payload as PolicyReadResponse)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.'
      setError(msg)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const hasConfigFile = useMemo(() => {
    if (!data) return false
    return data.lastModified !== new Date(0).toISOString()
  }, [data])

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-border bg-surface p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-ink">Runtime Config</p>
            <p className="mt-1 text-xs text-steel">
              This is the policy file used by <code className="rounded bg-muted px-1 py-0.5">/api/detect</code> and demo
              endpoints (via <code className="rounded bg-muted px-1 py-0.5">getGuard()</code>).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-ink transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              disabled={loading}
            >
              {loading && (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-steel border-t-transparent" />
              )}
              Refresh
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="grid gap-3 rounded-2xl border border-border bg-surface p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-steel">Paths</p>
        <div className="grid gap-2 text-sm text-steel">
          <p>
            <span className="font-semibold text-ink">Config:</span>{' '}
            <code className="rounded bg-muted px-1 py-0.5">{data?.filePath ?? '...'}</code>
          </p>
          <p>
            <span className="font-semibold text-ink">Last modified:</span>{' '}
            <span className="tabular-nums">{data ? formatDateTime(data.lastModified) : '...'}</span>
          </p>
          {!loading && data && !hasConfigFile && (
            <p className="text-xs text-steel">No config file found yet. Saving in the editor will create it.</p>
          )}
          <p className="text-xs text-steel">
            Env overrides: <code className="rounded bg-muted px-1 py-0.5">SAPPERAI_CONFIG_PATH</code>,{' '}
            <code className="rounded bg-muted px-1 py-0.5">SAPPERAI_AUDIT_LOG_PATH</code>
          </p>
        </div>
      </section>

      <section className="grid gap-3 rounded-2xl border border-border bg-surface p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-steel">Current YAML</p>
        <pre className="max-h-[520px] overflow-auto rounded-xl border border-border bg-[#0a0a0a] p-4 text-xs leading-relaxed text-gray-100">
          {data?.rawYaml ?? (loading ? 'Loading...' : 'No data')}
        </pre>
      </section>
    </div>
  )
}
