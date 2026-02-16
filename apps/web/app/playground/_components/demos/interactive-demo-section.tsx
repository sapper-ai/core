'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import type { DetectionResponse } from '@/app/components/types'
import { StatusBadge } from '@/app/components/status-badge'

import { DetectionVisualization } from './detection-visualization'
import { presets } from './presets'
import { SectionHeader } from './section-header'

const CUSTOM_PRESET_ID = '__custom__'

function isTruthyParam(value: string | null): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

export function InteractiveDemoSection() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const handledSearchRef = useRef<string | null>(null)

  const [toolName, setToolName] = useState(presets[0].toolName)
  const [payloadText, setPayloadText] = useState(presets[0].payload)
  const [selectedPresetId, setSelectedPresetId] = useState<string>(presets[0].id)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<DetectionResponse | null>(null)
  const [sampleNotice, setSampleNotice] = useState<{ invalid: string; fallback: string } | null>(null)

  const selectedPreset = useMemo(() => {
    return presets.find((preset) => preset.id === selectedPresetId) ?? null
  }, [selectedPresetId])

  const handlePresetChange = (preset: (typeof presets)[number]): void => {
    setSampleNotice(null)
    setSelectedPresetId(preset.id)
    setToolName(preset.toolName)
    setPayloadText(preset.payload)
    setResult(null)
    setError(null)
  }

  const runDetection = useCallback(
    async (input: { toolName: string; payloadText: string }): Promise<void> => {
      const trimmedToolName = input.toolName.trim()
      if (!trimmedToolName) {
        setError('toolName은 필수입니다.')
        setResult(null)
        return
      }

      setLoading(true)
      setError(null)

      let parsedPayload: unknown = input.payloadText
      try {
        parsedPayload = JSON.parse(input.payloadText)
      } catch {
        // Keep raw string payload when JSON parsing fails.
      }

      try {
        const response = await fetch('/api/detect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ toolName: trimmedToolName, arguments: parsedPayload }),
        })

        if (!response.ok) {
          const message = await response.text()
          throw new Error(message || '탐지 API 호출에 실패했습니다.')
        }

        const data = (await response.json()) as DetectionResponse
        setResult(data)
      } catch (requestError) {
        const message = requestError instanceof Error ? requestError.message : '알 수 없는 오류가 발생했습니다.'
        setError(message)
        setResult(null)
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    const raw = searchParams.toString()
    const sample = searchParams.get('sample')?.trim() ?? null
    const autorun = isTruthyParam(searchParams.get('autorun'))
    const toolFromParam = (searchParams.get('tool') ?? searchParams.get('toolName'))?.trim() ?? null
    const payloadFromParam = searchParams.get('args') ?? searchParams.get('payload')

    const hasAnySupportedParam = Boolean(sample || autorun || toolFromParam || payloadFromParam !== null)
    if (!hasAnySupportedParam) {
      handledSearchRef.current = null
      return
    }
    if (handledSearchRef.current === raw) return
    handledSearchRef.current = raw

    const defaultPreset = presets[0]
    const preset = sample ? presets.find((entry) => entry.id === sample) ?? null : null

    if (sample && !preset) {
      setSampleNotice({ invalid: sample, fallback: defaultPreset.id })
    } else {
      setSampleNotice(null)
    }

    let nextToolName = toolFromParam
    let nextPayloadText = payloadFromParam

    if (preset) {
      setSelectedPresetId(preset.id)
      setToolName(preset.toolName)
      setPayloadText(preset.payload)
      setResult(null)
      setError(null)
      nextToolName = preset.toolName
      nextPayloadText = preset.payload
    } else if (sample) {
      // Unknown sample: fall back to the default preset and keep the demo runnable.
      setSelectedPresetId(defaultPreset.id)
      setToolName(defaultPreset.toolName)
      setPayloadText(defaultPreset.payload)
      setResult(null)
      setError(null)
      nextToolName = defaultPreset.toolName
      nextPayloadText = defaultPreset.payload
    } else {
      if (toolFromParam) setToolName(toolFromParam)
      if (payloadFromParam !== null) setPayloadText(payloadFromParam)

      if (toolFromParam || payloadFromParam !== null) {
        setSelectedPresetId(CUSTOM_PRESET_ID)
        setResult(null)
        setError(null)
      }
    }

    if (autorun && nextToolName) {
      void runDetection({
        toolName: nextToolName,
        payloadText: typeof nextPayloadText === 'string' ? nextPayloadText : payloadText,
      })
    }

    const cleaned = new URLSearchParams(raw)
    for (const key of ['sample', 'autorun', 'tool', 'toolName', 'args', 'payload']) {
      cleaned.delete(key)
    }
    const cleanedRaw = cleaned.toString()
    if (cleanedRaw !== raw) {
      router.replace(cleanedRaw ? `${pathname}?${cleanedRaw}` : pathname, { scroll: false })
    }
  }, [searchParams, pathname, router, payloadText, runDetection])

  return (
    <section className="grid gap-6 rounded-2xl border border-border bg-surface p-7 md:p-10">
      <SectionHeader
        title="인터랙티브 보안 데모"
        description="공격 시나리오를 선택하거나 직접 payload를 입력해 SapperAI 탐지 결과를 확인하세요."
      />

      {sampleNotice && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <p className="font-semibold">지원하지 않는 sample 값이 들어왔습니다.</p>
          <p className="mt-1">
            sample=<span className="font-mono">{sampleNotice.invalid}</span> → fallback=
            <span className="font-mono">{sampleNotice.fallback}</span>
          </p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {presets.map((preset) => {
          const isActive = preset.id === selectedPresetId
          return (
            <button
              key={preset.id}
              type="button"
              className={`rounded-xl border px-4 py-3 text-left transition ${
                isActive ? 'border-ink bg-ink text-white' : 'border-border bg-surface text-ink hover:bg-muted'
              }`}
              onClick={() => handlePresetChange(preset)}
            >
              <p className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-ink'}`}>{preset.title}</p>
              <p className={`mt-1 text-xs ${isActive ? 'text-gray-300' : 'text-steel'}`}>{preset.summary}</p>
            </button>
          )
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <div className="grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-steel">
            Tool 이름
            <input
              className="rounded-lg border border-border bg-surface px-3 py-2 text-base text-ink outline-none transition focus:border-ink focus:ring-1 focus:ring-ink"
              value={toolName}
              onChange={(event) => setToolName(event.target.value)}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-steel">
            Tool arguments(JSON 권장)
            <textarea
              className="min-h-64 rounded-lg border-none bg-[#0a0a0a] px-4 py-3 font-mono text-sm leading-relaxed text-gray-100 outline-none transition focus:ring-2 focus:ring-signal"
              value={payloadText}
              onChange={(event) => setPayloadText(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void runDetection({ toolName, payloadText })}
            disabled={loading}
          >
            {loading && <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
            {loading ? '탐지 엔진 실행 중...' : 'SapperAI 탐지 실행'}
          </button>
          <p className="text-xs text-steel">
            현재 선택된 예시:{' '}
            <span className="font-medium text-ink">{selectedPreset?.title ?? 'Custom input'}</span>
          </p>
        </div>

        <div className="rounded-xl border border-border bg-muted p-5">
          {!result && !error && (
            <div className="grid gap-2 text-sm text-steel">
              <p className="font-medium text-ink">결과 대기 중</p>
              <p>왼쪽에서 공격/정상 시나리오를 실행하면 차단 여부와 탐지 사유가 표시됩니다.</p>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
              <p className="font-semibold">오류가 발생했습니다.</p>
              <p className="mt-1 whitespace-pre-wrap">{error}</p>
            </div>
          )}

          {result && (
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  variant={result.action === 'block' ? 'block' : 'allow'}
                  label={result.action === 'block' ? 'BLOCK' : 'ALLOW'}
                />
                <span className="rounded-full border border-border bg-surface px-3 py-0.5 text-xs font-medium tabular-nums text-steel">
                  Risk {(result.risk * 100).toFixed(1)}%
                </span>
                <span className="rounded-full border border-border bg-surface px-3 py-0.5 text-xs font-medium tabular-nums text-steel">
                  Confidence {(result.confidence * 100).toFixed(1)}%
                </span>
              </div>

              <div className="grid gap-2">
                <p className="text-sm font-semibold text-ink">판단 이유</p>
                <ul className="grid gap-1.5">
                  {result.reasons.map((reason) => (
                    <li key={reason} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-steel">
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>

              <DetectionVisualization data={result} />

              <div className="grid gap-2">
                <p className="text-sm font-semibold text-ink">탐지기 근거</p>
                <div className="grid gap-1.5">
                  {result.evidence.map((entry) => (
                    <div key={entry.detectorId} className="rounded-lg border border-border bg-surface p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-steel">{entry.detectorId}</p>
                      <p className="mt-1 text-xs tabular-nums text-steel">
                        Risk {(entry.risk * 100).toFixed(1)}% / Confidence {(entry.confidence * 100).toFixed(1)}%
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
