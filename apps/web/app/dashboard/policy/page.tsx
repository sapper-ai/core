'use client'

import { useEffect, useMemo, useState } from 'react'

import type { Policy } from '@sapper-ai/types'

import type { AdversaryCampaignResponse } from '@/app/components/types'

import { PolicyForm } from './components/policy-form'
import { TestResults } from './components/test-results'
import { YamlPreview } from './components/yaml-preview'
import { policyPresets, type PresetName } from './presets'

type PolicyReadResponse = {
  policy: Policy
  rawYaml: string
  filePath: string
  lastModified: string
}

type PolicyUpdateResponse = { success: boolean; policy: Policy; rawYaml: string }

function stableDetectors(value: string[] | undefined): string[] {
  return [...(value ?? [])].sort()
}

function matchesPreset(policy: Policy, preset: Policy): boolean {
  if (policy.mode !== preset.mode) return false
  if (policy.defaultAction !== preset.defaultAction) return false
  if (policy.failOpen !== preset.failOpen) return false

  const left = stableDetectors(policy.detectors)
  const right = stableDetectors(preset.detectors)
  if (left.length !== right.length) return false
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false
  }

  const lt = policy.thresholds ?? {}
  const rt = preset.thresholds ?? {}
  if ((lt.riskThreshold ?? 0.7) !== (rt.riskThreshold ?? 0.7)) return false
  if ((lt.blockMinConfidence ?? 0.5) !== (rt.blockMinConfidence ?? 0.5)) return false

  return true
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toYaml(value: unknown, indent: number): string[] {
  const pad = '  '.repeat(indent)

  if (value === null) {
    return [`${pad}null`]
  }

  if (value === undefined) {
    return []
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return [`${pad}${String(value)}`]
  }

  if (Array.isArray(value)) {
    const out: string[] = []
    for (const item of value) {
      if (item === undefined) continue
      if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean' || item === null) {
        out.push(`${pad}- ${String(item)}`)
      } else {
        out.push(`${pad}-`)
        out.push(...toYaml(item, indent + 1))
      }
    }
    return out
  }

  if (!isRecord(value)) {
    return [`${pad}${String(value)}`]
  }

  const keys = Object.keys(value)
  const out: string[] = []
  for (const key of keys) {
    const v = value[key]
    if (v === undefined) continue
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null) {
      out.push(`${pad}${key}: ${String(v)}`)
      continue
    }
    if (Array.isArray(v)) {
      if (v.length === 0) continue
      out.push(`${pad}${key}:`)
      out.push(...toYaml(v, indent + 1))
      continue
    }

    if (!isRecord(v)) {
      out.push(`${pad}${key}: ${String(v)}`)
      continue
    }

    const nestedKeys = Object.keys(v)
    if (nestedKeys.length === 0) continue
    out.push(`${pad}${key}:`)
    out.push(...toYaml(v, indent + 1))
  }
  return out
}

function policyToYaml(policy: Policy): string {
  const ordered: Record<string, unknown> = {
    mode: policy.mode,
    defaultAction: policy.defaultAction,
    failOpen: policy.failOpen,
    detectors: policy.detectors,
    thresholds: policy.thresholds,
    allowlist: policy.allowlist,
    blocklist: policy.blocklist,
    toolOverrides: policy.toolOverrides,
    threatFeed: policy.threatFeed,
    llm: policy.llm,
  }

  return toYaml(ordered, 0).join('\n')
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function PolicyEditorPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [lastModified, setLastModified] = useState<string | null>(null)
  const [policy, setPolicy] = useState<Policy | null>(null)
  const [testResult, setTestResult] = useState<AdversaryCampaignResponse | null>(null)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)

  const yamlPreview = useMemo(() => (policy ? policyToYaml(policy) : ''), [policy])

  const activePreset = useMemo(() => {
    if (!policy) return null
    const entries = Object.entries(policyPresets) as [PresetName, (typeof policyPresets)[PresetName]][]
    for (const [name, preset] of entries) {
      if (matchesPreset(policy, preset.policy)) return name
    }
    return null
  }, [policy])

  const load = async (): Promise<void> => {
    setError(null)
    setMessage(null)
    setTestResult(null)
    try {
      const res = await fetch('/api/dashboard/policy', { cache: 'no-store' })
      const payload = (await res.json()) as PolicyReadResponse | { error?: string }
      if (!res.ok) {
        const msg = 'error' in payload && payload.error ? payload.error : '정책을 불러오지 못했습니다.'
        throw new Error(msg)
      }

      const ok = payload as PolicyReadResponse
      setPolicy(ok.policy)
      setFilePath(ok.filePath)
      setLastModified(ok.lastModified)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.'
      setError(msg)
      setPolicy(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const applyPreset = (name: PresetName) => {
    if (!policy) return
    const preset = policyPresets[name].policy
    setPolicy({
      ...policy,
      mode: preset.mode,
      defaultAction: preset.defaultAction,
      failOpen: preset.failOpen,
      detectors: preset.detectors,
      thresholds: preset.thresholds,
    })
    setMessage(`Preset applied: ${policyPresets[name].label}`)
  }

  const savePolicy = async (): Promise<void> => {
    if (!policy) return
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/dashboard/policy', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ policy }),
      })
      const payload = (await res.json()) as PolicyUpdateResponse | { error?: string; issues?: unknown }
      if (!res.ok) {
        const msg = 'error' in payload && payload.error ? payload.error : '정책 저장에 실패했습니다.'
        throw new Error(msg)
      }
      setMessage('Policy saved.')
      await load()
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  const testPolicy = async (): Promise<void> => {
    if (!policy) return
    setTesting(true)
    setError(null)
    setMessage(null)
    setTestResult(null)
    try {
      const res = await fetch('/api/dashboard/policy/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ policy }),
      })
      const payload = (await res.json()) as AdversaryCampaignResponse | { error?: string }
      if (!res.ok) {
        const msg = 'error' in payload && payload.error ? payload.error : '정책 테스트에 실패했습니다.'
        throw new Error(msg)
      }
      setTestResult(payload as AdversaryCampaignResponse)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.'
      setError(msg)
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return <div className="grid place-items-center py-16 text-sm text-steel">Loading...</div>
  }

  if (!policy) {
    return (
      <div className="rounded-2xl border border-border bg-white p-6 shadow-subtle">
        <p className="text-sm font-semibold text-ink">Policy</p>
        <p className="mt-2 text-sm text-steel">{error ?? 'No policy loaded.'}</p>
      </div>
    )
  }

  const hasConfigFile = lastModified !== null && lastModified !== new Date(0).toISOString()

  return (
    <div className="grid gap-6">
      <div className="grid gap-2 rounded-2xl border border-border bg-white p-6 shadow-subtle">
        <p className="text-sm font-semibold text-ink">Policy Editor</p>
        {filePath && <p className="text-xs text-steel">{filePath}</p>}
        {!hasConfigFile && (
          <p className="text-xs text-steel">No config file found. Saving will create sapperai.config.yaml.</p>
        )}
      </div>

      <div className="grid gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-steel">Preset</p>
        <div className="grid gap-2 md:grid-cols-6">
          {(Object.entries(policyPresets) as [PresetName, (typeof policyPresets)[PresetName]][]).map(
            ([name, preset]) => {
              const isActive = activePreset === name
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => applyPreset(name)}
                  className={`rounded-xl border px-3 py-3 text-left text-sm shadow-subtle transition ${
                    isActive
                      ? 'border-ink bg-ink text-white'
                      : 'border-border bg-white text-ink hover:bg-muted'
                  }`}
                >
                  <p className="font-semibold">{preset.label}{isActive ? ' ✓' : ''}</p>
                  <p className={`mt-1 text-xs ${isActive ? 'text-white/80' : 'text-steel'}`}>{preset.description}</p>
                </button>
              )
            }
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 shadow-subtle">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-2xl border border-border bg-muted p-5 text-sm text-steel shadow-subtle">
          {message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <PolicyForm policy={policy} onChange={setPolicy} />
        <YamlPreview yaml={yamlPreview} />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void savePolicy()}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving && <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
          Save Policy
        </button>
        <button
          type="button"
          onClick={() => void testPolicy()}
          disabled={testing}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 py-3 text-sm font-semibold text-ink shadow-subtle transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          {testing && <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-steel border-t-transparent" />}
          Test Policy
        </button>
        <button
          type="button"
          onClick={() => downloadTextFile('sapperai.config.yaml', `${yamlPreview}\n`)}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 py-3 text-sm font-semibold text-ink shadow-subtle transition hover:bg-muted"
        >
          Export YAML
        </button>
      </div>

      {testResult && <TestResults result={testResult} />}
    </div>
  )
}
