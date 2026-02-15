'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import type { AgentDemoResponse, AgentScenarioPreset } from '@/app/components/types'
import { RiskBar } from '@/app/components/risk-bar'
import { StatusBadge } from '@/app/components/status-badge'
import { formatPercent, formatTimestamp } from '@/app/components/utils'

import { agentScenarios } from './presets'
import { SectionHeader } from './section-header'

function isTruthyParam(value: string | null): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

export function AgentDemoSection() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const handledSearchRef = useRef<string | null>(null)

  const [selectedAgentScenarioId, setSelectedAgentScenarioId] = useState<AgentScenarioPreset['id']>(agentScenarios[0].id)
  const [agentLoading, setAgentLoading] = useState(false)
  const [agentError, setAgentError] = useState<string | null>(null)
  const [agentResult, setAgentResult] = useState<AgentDemoResponse | null>(null)
  const [scenarioNotice, setScenarioNotice] = useState<{ invalid: string; fallback: string } | null>(null)

  const selectedAgentScenario = useMemo(
    () => agentScenarios.find((scenario) => scenario.id === selectedAgentScenarioId) ?? agentScenarios[0],
    [selectedAgentScenarioId]
  )

  const runAgentDemo = useCallback(async (input: { scenarioId: AgentScenarioPreset['id']; executeBlocked: boolean }): Promise<void> => {
    setAgentLoading(true)
    setAgentError(null)

    try {
      const response = await fetch('/api/agent-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId: input.scenarioId, executeBlocked: input.executeBlocked }),
      })

      const payload = (await response.json()) as AgentDemoResponse | { error?: string }

      if (!response.ok) {
        const message = 'error' in payload && payload.error ? payload.error : '에이전트 데모 실행에 실패했습니다.'
        throw new Error(message)
      }

      setAgentResult(payload as AgentDemoResponse)
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : '알 수 없는 오류가 발생했습니다.'
      setAgentError(message)
      setAgentResult(null)
    } finally {
      setAgentLoading(false)
    }
  }, [])

  useEffect(() => {
    const raw = searchParams.toString()
    const scenario = (searchParams.get('scenario') ?? searchParams.get('sample'))?.trim() ?? null
    const autorun = isTruthyParam(searchParams.get('autorun'))
    const executeBlocked = isTruthyParam(searchParams.get('executeBlocked'))

    const hasAnySupportedParam = Boolean(scenario || autorun || executeBlocked)
    if (!hasAnySupportedParam) {
      handledSearchRef.current = null
      return
    }
    if (handledSearchRef.current === raw) return
    handledSearchRef.current = raw

    const defaultScenario = agentScenarios[0]
    const matchedScenario = scenario ? agentScenarios.find((entry) => entry.id === scenario) ?? null : null
    const scenarioId = matchedScenario?.id ?? (scenario ? defaultScenario.id : selectedAgentScenarioId)

    if (scenario && !matchedScenario) {
      setScenarioNotice({ invalid: scenario, fallback: defaultScenario.id })
    } else {
      setScenarioNotice(null)
    }

    if (scenario) {
      setSelectedAgentScenarioId(scenarioId)
      setAgentResult(null)
      setAgentError(null)
    }

    if (autorun) {
      void runAgentDemo({ scenarioId, executeBlocked })
    }

    const cleaned = new URLSearchParams(raw)
    for (const key of ['scenario', 'sample', 'autorun', 'executeBlocked']) {
      cleaned.delete(key)
    }
    const cleanedRaw = cleaned.toString()
    if (cleanedRaw !== raw) {
      router.replace(cleanedRaw ? `${pathname}?${cleanedRaw}` : pathname, { scroll: false })
    }
  }, [searchParams, pathname, router, runAgentDemo, selectedAgentScenarioId])

  return (
    <section className="grid gap-6 rounded-2xl border border-border bg-white p-7 shadow-subtle md:p-10">
      <SectionHeader
        title="OpenAI Agent Live Demo"
        description="OpenAI Agents SDK guardrail 흐름을 실시간으로 시뮬레이션합니다. 각 tool call은 SapperAI 파이프라인을 거쳐 차단/허용됩니다."
      />

      {scenarioNotice && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <p className="font-semibold">지원하지 않는 scenario 값이 들어왔습니다.</p>
          <p className="mt-1">
            scenario=<span className="font-mono">{scenarioNotice.invalid}</span> → fallback=
            <span className="font-mono">{scenarioNotice.fallback}</span>
          </p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {agentScenarios.map((scenario) => {
              const isActive = scenario.id === selectedAgentScenarioId
              return (
                <button
                  key={scenario.id}
                  type="button"
                  className={`rounded-xl border px-4 py-3 text-left transition ${
                    isActive ? 'border-ink bg-ink text-white shadow-lifted' : 'border-border bg-white text-ink hover:bg-muted'
                  }`}
                  onClick={() => {
                    setScenarioNotice(null)
                    setSelectedAgentScenarioId(scenario.id)
                    setAgentResult(null)
                    setAgentError(null)
                  }}
                >
                  <p className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-ink'}`}>{scenario.title}</p>
                  <p className={`mt-1 text-xs ${isActive ? 'text-gray-300' : 'text-steel'}`}>{scenario.summary}</p>
                </button>
              )
            })}
          </div>

          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void runAgentDemo({ scenarioId: selectedAgentScenario.id, executeBlocked: false })}
            disabled={agentLoading}
          >
            {agentLoading && <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
            {agentLoading ? '에이전트 실행 중...' : 'Agent Live Run 시작'}
          </button>

          {agentResult?.halted && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
              <p className="font-semibold">고위험 요청이 차단되어 실행이 멈췄습니다.</p>
              <p className="mt-1">데모를 계속하려면 아래 버튼으로 차단된 요청까지 강행 실행할 수 있습니다.</p>
              <button
                type="button"
                className="mt-3 inline-flex items-center justify-center rounded-lg bg-ember px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-600"
                onClick={() => void runAgentDemo({ scenarioId: selectedAgentScenario.id, executeBlocked: true })}
                disabled={agentLoading}
              >
                Execute anyway
              </button>
            </div>
          )}

          <p className="text-xs text-steel">
            선택된 시나리오: <span className="font-medium text-ink">{selectedAgentScenario.title}</span>
          </p>
        </div>

        <div className="rounded-xl border border-border bg-muted p-5">
          {!agentResult && !agentError && (
            <div className="grid gap-2 text-sm text-steel">
              <p className="font-medium text-ink">실행 결과 대기 중</p>
              <p>Agent Live Run을 시작하면 각 tool call의 차단/허용 결과와 GPT 기반 설명이 타임라인으로 표시됩니다.</p>
            </div>
          )}

          {agentError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
              <p className="font-semibold">에이전트 데모 오류</p>
              <p className="mt-1 whitespace-pre-wrap">{agentError}</p>
            </div>
          )}

          {agentResult && (
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border border-border bg-white px-3 py-1 font-medium text-steel">
                  {agentResult.model}
                </span>
                <span className="rounded-full border border-border bg-white px-3 py-1 font-medium text-steel">
                  Block {agentResult.blockedCount}
                </span>
                <span className="rounded-full border border-border bg-white px-3 py-1 font-medium text-steel">
                  Allow {agentResult.allowedCount}
                </span>
              </div>

              <p className="text-sm text-steel">{agentResult.summary}</p>

              <ol className="relative grid gap-3 border-l-2 border-gray-200 pl-6">
                {agentResult.steps.map((step, index) => (
                  <li key={step.stepId} className="relative rounded-xl border border-border bg-white p-4">
                    <span className="absolute -left-[31px] top-5 h-3 w-3 rounded-full border-2 border-gray-300 bg-white" />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-ink">
                        {index + 1}. {step.label}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <StatusBadge variant={step.blocked ? 'block' : 'allow'} />
                        <StatusBadge variant={step.executed ? 'executed' : 'stopped'} />
                      </div>
                    </div>

                    <p className="mt-2 text-xs font-medium text-steel">{step.toolName}</p>
                    <p className="mt-1.5 rounded-md bg-[#0a0a0a] px-3 py-2 font-mono text-[11px] leading-relaxed text-gray-100">
                      {step.argumentsPreview}
                    </p>

                    <div className="mt-3">
                      <RiskBar value={step.decision.risk} height="sm" />
                    </div>

                    <p className="mt-1.5 text-[11px] tabular-nums text-steel">
                      Risk {formatPercent(step.decision.risk)} / Confidence {formatPercent(step.decision.confidence)} /{' '}
                      {formatTimestamp(step.timestamp)} / {step.durationMs}ms
                    </p>
                    <p className="mt-1 text-xs text-steel">{step.decision.reasons[0] ?? '탐지 사유 없음'}</p>
                    <p className="mt-2 rounded-md border border-border bg-muted px-3 py-2 text-xs text-steel">
                      {step.analysis}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
