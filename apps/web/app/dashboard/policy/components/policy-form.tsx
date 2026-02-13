'use client'

import type { MatchList, Policy } from '@sapper-ai/types'

import { MatchlistEditor } from './matchlist-editor'
import { ToolOverridesEditor } from './tool-overrides-editor'

function formatNumber(value: number | undefined, fallback: number): string {
  const v = typeof value === 'number' ? value : fallback
  return v.toFixed(2)
}

export function PolicyForm({
  policy,
  onChange,
}: {
  policy: Policy
  onChange: (policy: Policy) => void
}) {
  const detectors = policy.detectors ?? []

  const setDetector = (name: string, enabled: boolean) => {
    const next = new Set(detectors)
    if (enabled) next.add(name)
    else next.delete(name)
    onChange({
      ...policy,
      detectors: next.size > 0 ? Array.from(next) : undefined,
    })
  }

  const thresholds = policy.thresholds ?? {}
  const riskThreshold = typeof thresholds.riskThreshold === 'number' ? thresholds.riskThreshold : 0.7
  const blockMinConfidence =
    typeof thresholds.blockMinConfidence === 'number' ? thresholds.blockMinConfidence : 0.5

  const updateThresholds = (next: { riskThreshold?: number; blockMinConfidence?: number }) => {
    onChange({
      ...policy,
      thresholds: {
        ...thresholds,
        ...next,
      },
    })
  }

  const normalizeMatchList = (value: MatchList): MatchList | undefined => {
    const keys = Object.keys(value) as (keyof MatchList)[]
    const hasAny = keys.some((k) => (value[k]?.length ?? 0) > 0)
    return hasAny ? value : undefined
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 rounded-2xl border border-border bg-white p-6 shadow-subtle">
        <div className="grid gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-steel">Mode</label>
          <select
            value={policy.mode}
            onChange={(e) => onChange({ ...policy, mode: e.target.value as Policy['mode'] })}
            className="h-10 rounded-lg border border-border bg-white px-3 text-sm text-ink"
          >
            <option value="monitor">monitor</option>
            <option value="enforce">enforce</option>
          </select>
        </div>

        <div className="grid gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-steel">Default Action</label>
          <select
            value={policy.defaultAction}
            onChange={(e) => onChange({ ...policy, defaultAction: e.target.value as Policy['defaultAction'] })}
            className="h-10 rounded-lg border border-border bg-white px-3 text-sm text-ink"
          >
            <option value="allow">allow</option>
            <option value="block">block</option>
          </select>
        </div>

        <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-ink">Fail Open</p>
            <p className="mt-0.5 text-xs text-steel">Allow when detectors error</p>
          </div>
          <input
            type="checkbox"
            checked={policy.failOpen}
            onChange={(e) => onChange({ ...policy, failOpen: e.target.checked })}
            className="h-5 w-5"
          />
        </label>

        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-steel">Risk Threshold</label>
            <span className="text-xs font-semibold tabular-nums text-ink">{formatNumber(riskThreshold, 0.7)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={riskThreshold}
            onChange={(e) => updateThresholds({ riskThreshold: Number.parseFloat(e.target.value) })}
          />
        </div>

        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-steel">Block Min Confidence</label>
            <span className="text-xs font-semibold tabular-nums text-ink">
              {formatNumber(blockMinConfidence, 0.5)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={blockMinConfidence}
            onChange={(e) => updateThresholds({ blockMinConfidence: Number.parseFloat(e.target.value) })}
          />
        </div>

        <div className="grid gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-steel">Detectors</p>
          <div className="grid gap-2">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={detectors.includes('rules')}
                onChange={(e) => setDetector('rules', e.target.checked)}
              />
              rules
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={detectors.includes('llm')}
                onChange={(e) => setDetector('llm', e.target.checked)}
              />
              llm
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={detectors.includes('threat-intel')}
                onChange={(e) => setDetector('threat-intel', e.target.checked)}
              />
              threat-intel
            </label>
          </div>
        </div>
      </div>

      <details className="rounded-2xl border border-border bg-white p-6 shadow-subtle">
        <summary className="cursor-pointer text-sm font-semibold text-ink">Advanced Settings</summary>
        <div className="mt-5 grid gap-6">
          <ToolOverridesEditor
            overrides={policy.toolOverrides ?? {}}
            onChange={(overrides) => {
              const next = Object.keys(overrides).length > 0 ? overrides : undefined
              onChange({ ...policy, toolOverrides: next })
            }}
          />
          <MatchlistEditor
            label="Allowlist"
            matchList={policy.allowlist}
            onChange={(matchList) => onChange({ ...policy, allowlist: normalizeMatchList(matchList) })}
          />
          <MatchlistEditor
            label="Blocklist"
            matchList={policy.blocklist}
            onChange={(matchList) => onChange({ ...policy, blocklist: normalizeMatchList(matchList) })}
          />
        </div>
      </details>
    </div>
  )
}
