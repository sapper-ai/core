'use client'

import { useMemo, useState } from 'react'

import type { MatchList } from '@sapper-ai/types'

type FieldKey = 'toolNames' | 'urlPatterns' | 'contentPatterns' | 'packageNames' | 'sha256'

const fieldLabels: Record<FieldKey, string> = {
  toolNames: 'toolNames',
  urlPatterns: 'urlPatterns',
  contentPatterns: 'contentPatterns',
  packageNames: 'packageNames',
  sha256: 'sha256',
}

function normalize(matchList: MatchList): MatchList {
  const next: MatchList = { ...matchList }
  for (const key of Object.keys(fieldLabels) as FieldKey[]) {
    const value = next[key]
    if (!value || value.length === 0) {
      delete next[key]
      continue
    }
    next[key] = value.map((v) => v.trim()).filter((v) => v.length > 0)
    if (!next[key] || next[key]!.length === 0) {
      delete next[key]
    }
  }
  return next
}

export function MatchlistEditor({
  label,
  matchList,
  onChange,
}: {
  label: 'Allowlist' | 'Blocklist'
  matchList: MatchList | undefined
  onChange: (matchList: MatchList) => void
}) {
  const current = matchList ?? {}
  const [drafts, setDrafts] = useState<Record<FieldKey, string>>({
    toolNames: '',
    urlPatterns: '',
    contentPatterns: '',
    packageNames: '',
    sha256: '',
  })
  const [expanded, setExpanded] = useState<Record<FieldKey, boolean>>({
    toolNames: false,
    urlPatterns: false,
    contentPatterns: false,
    packageNames: false,
    sha256: false,
  })

  const hasAny = useMemo(() => {
    return (Object.keys(fieldLabels) as FieldKey[]).some((k) => (current[k]?.length ?? 0) > 0)
  }, [current])

  const updateField = (key: FieldKey, values: string[]) => {
    const next = normalize({
      ...current,
      [key]: values,
    })
    onChange(next)
  }

  const addTag = (key: FieldKey) => {
    const value = drafts[key].trim()
    if (!value) return
    const existing = current[key] ?? []
    if (existing.includes(value)) {
      setDrafts((prev) => ({ ...prev, [key]: '' }))
      return
    }
    updateField(key, [...existing, value])
    setDrafts((prev) => ({ ...prev, [key]: '' }))
    setExpanded((prev) => ({ ...prev, [key]: true }))
  }

  const removeTag = (key: FieldKey, value: string) => {
    const existing = current[key] ?? []
    updateField(
      key,
      existing.filter((v) => v !== value)
    )
  }

  return (
    <div
      className="grid gap-4 rounded-2xl border border-border bg-white p-6 shadow-subtle"
      data-testid={`matchlist-${label.toLowerCase()}`}
    >
      <div>
        <p className="text-sm font-semibold text-ink">{label}</p>
        <p className="mt-1 text-xs text-steel">Tag-based editor for match list fields.</p>
      </div>

      {!hasAny && (
        <div className="rounded-xl border border-border bg-muted p-4 text-sm text-steel">
          Empty.
        </div>
      )}

      <div className="grid gap-3">
        {(Object.keys(fieldLabels) as FieldKey[]).map((key) => {
          const values = current[key] ?? []
          const isOpen = expanded[key] || values.length > 0

          if (!isOpen) {
            return (
              <div key={key} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted px-4 py-3">
                <p className="text-sm font-semibold text-ink">{fieldLabels[key]}</p>
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => ({ ...prev, [key]: true }))}
                  className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-subtle transition hover:bg-muted"
                >
                  Add
                </button>
              </div>
            )
          }

          return (
            <div key={key} className="grid gap-2 rounded-xl border border-border bg-muted p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-ink">{fieldLabels[key]}</p>
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => ({ ...prev, [key]: values.length > 0 }))}
                  className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-subtle transition hover:bg-muted"
                >
                  Collapse
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {values.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => removeTag(key, value)}
                    className="rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-ink shadow-subtle transition hover:bg-muted"
                    title="Click to remove"
                  >
                    {value}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  value={drafts[key]}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addTag(key)
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => addTag(key)}
                  className="h-9 rounded-lg border border-border bg-white px-4 text-sm font-semibold text-ink shadow-subtle transition hover:bg-muted"
                >
                  +
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
