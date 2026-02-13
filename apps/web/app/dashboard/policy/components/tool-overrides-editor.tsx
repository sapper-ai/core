'use client'

import { useMemo, useState } from 'react'

import type { ToolPolicy } from '@sapper-ai/types'

function formatNumber(value: number | undefined, fallback: number): string {
  const v = typeof value === 'number' ? value : fallback
  return v.toFixed(2)
}

export function ToolOverridesEditor({
  overrides,
  onChange,
}: {
  overrides: Record<string, ToolPolicy>
  onChange: (overrides: Record<string, ToolPolicy>) => void
}) {
  const [newToolName, setNewToolName] = useState('')
  const keys = useMemo(() => Object.keys(overrides).sort(), [overrides])

  const addOverride = () => {
    const name = newToolName.trim()
    if (!name) return
    if (overrides[name]) return

    onChange({
      ...overrides,
      [name]: {
        mode: 'enforce',
        thresholds: { riskThreshold: 0.7, blockMinConfidence: 0.65 },
      },
    })
    setNewToolName('')
  }

  const removeOverride = (toolName: string) => {
    const next: Record<string, ToolPolicy> = {}
    for (const [key, value] of Object.entries(overrides)) {
      if (key === toolName) continue
      next[key] = value
    }
    onChange(next)
  }

  const updateOverride = (toolName: string, patch: Partial<ToolPolicy>) => {
    const current = overrides[toolName] ?? {}
    onChange({
      ...overrides,
      [toolName]: {
        ...current,
        ...patch,
      },
    })
  }

  const updateThresholds = (
    toolName: string,
    patch: { riskThreshold?: number; blockMinConfidence?: number }
  ) => {
    const current = overrides[toolName] ?? {}
    const currentThresholds = current.thresholds ?? {}
    updateOverride(toolName, {
      thresholds: {
        ...currentThresholds,
        ...patch,
      },
    })
  }

  return (
    <div className="grid gap-4 rounded-2xl border border-border bg-white p-6 shadow-subtle">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">Tool Overrides</p>
          <p className="mt-1 text-xs text-steel">Tool-specific mode / thresholds.</p>
        </div>
      </div>

      {keys.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted p-4 text-sm text-steel">
          No tool-specific overrides. Click + to add.
        </div>
      ) : (
        <div className="grid gap-3">
          {keys.map((toolName) => {
            const toolPolicy = overrides[toolName] ?? {}
            const thresholds = toolPolicy.thresholds ?? {}
            const riskThreshold =
              typeof thresholds.riskThreshold === 'number' ? thresholds.riskThreshold : 0.7
            const blockMinConfidence =
              typeof thresholds.blockMinConfidence === 'number' ? thresholds.blockMinConfidence : 0.65

            return (
              <div key={toolName} className="grid gap-4 rounded-xl border border-border bg-muted p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-mono text-xs font-semibold text-ink">{toolName}</p>
                  <button
                    type="button"
                    onClick={() => removeOverride(toolName)}
                    className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-subtle transition hover:bg-muted"
                  >
                    Delete
                  </button>
                </div>

                <div className="grid gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-steel">Mode</label>
                  <select
                    value={toolPolicy.mode ?? 'enforce'}
                    onChange={(e) => updateOverride(toolName, { mode: e.target.value as ToolPolicy['mode'] })}
                    className="h-10 rounded-lg border border-border bg-white px-3 text-sm text-ink"
                  >
                    <option value="monitor">monitor</option>
                    <option value="enforce">enforce</option>
                  </select>
                </div>

                <div className="grid gap-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-steel">Risk Threshold</label>
                    <span className="text-xs font-semibold tabular-nums text-ink">
                      {formatNumber(riskThreshold, 0.7)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={riskThreshold}
                    onChange={(e) => updateThresholds(toolName, { riskThreshold: Number.parseFloat(e.target.value) })}
                  />
                </div>

                <div className="grid gap-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-steel">Block Min Confidence</label>
                    <span className="text-xs font-semibold tabular-nums text-ink">
                      {formatNumber(blockMinConfidence, 0.65)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={blockMinConfidence}
                    onChange={(e) =>
                      updateThresholds(toolName, { blockMinConfidence: Number.parseFloat(e.target.value) })
                    }
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={newToolName}
          onChange={(e) => setNewToolName(e.target.value)}
          placeholder="tool name (e.g. read_file)"
          className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addOverride()
            }
          }}
        />
        <button
          type="button"
          onClick={addOverride}
          className="h-10 rounded-lg border border-border bg-white px-4 text-sm font-semibold text-ink shadow-subtle transition hover:bg-muted"
        >
          + Add Override
        </button>
      </div>
    </div>
  )
}
