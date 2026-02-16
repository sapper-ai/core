'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import type { AdversaryCampaignResponse } from '@/app/components/types'

import { CircularGauge } from '@/app/components/circular-gauge'
import { RiskBar } from '@/app/components/risk-bar'
import { StatusBadge } from '@/app/components/status-badge'
import { clampRisk, formatPercent, severityLabels, typeLabels } from '@/app/components/utils'

import { SectionHeader } from './section-header'

function isTruthyParam(value: string | null): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

export function CampaignSection() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const handledSearchRef = useRef<string | null>(null)

  const [campaignLoading, setCampaignLoading] = useState(false)
  const [campaignError, setCampaignError] = useState<string | null>(null)
  const [campaignResult, setCampaignResult] = useState<AdversaryCampaignResponse | null>(null)

  const runCampaign = useCallback(async (input: { useDefaultPolicy: boolean }): Promise<void> => {
    setCampaignLoading(true)
    setCampaignError(null)

    try {
      const response = await fetch('/api/adversary-campaign', {
        method: 'POST',
        headers: input.useDefaultPolicy ? { 'content-type': 'application/json' } : undefined,
        body: input.useDefaultPolicy ? JSON.stringify({ useDefaultPolicy: true }) : undefined,
      })
      const payload = (await response.json()) as AdversaryCampaignResponse | { error?: string }

      if (!response.ok) {
        const message = 'error' in payload && payload.error ? payload.error : '캠페인 실행에 실패했습니다.'
        throw new Error(message)
      }

      setCampaignResult(payload as AdversaryCampaignResponse)
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : '알 수 없는 오류가 발생했습니다.'
      setCampaignError(message)
      setCampaignResult(null)
    } finally {
      setCampaignLoading(false)
    }
  }, [])

  useEffect(() => {
    const raw = searchParams.toString()
    const autorun = isTruthyParam(searchParams.get('autorun'))
    const useDefaultPolicy =
      isTruthyParam(searchParams.get('useDefaultPolicy')) || searchParams.get('policy')?.trim() === 'default'

    const hasAnySupportedParam = Boolean(autorun || useDefaultPolicy)
    if (!hasAnySupportedParam) {
      handledSearchRef.current = null
      return
    }
    if (handledSearchRef.current === raw) return
    handledSearchRef.current = raw

    if (autorun) {
      void runCampaign({ useDefaultPolicy })
    }

    const cleaned = new URLSearchParams(raw)
    for (const key of ['autorun', 'useDefaultPolicy', 'policy']) {
      cleaned.delete(key)
    }
    const cleanedRaw = cleaned.toString()
    if (cleanedRaw !== raw) {
      router.replace(cleanedRaw ? `${pathname}?${cleanedRaw}` : pathname, { scroll: false })
    }
  }, [searchParams, pathname, router, runCampaign])

  return (
    <section className="grid gap-6 rounded-2xl border border-border bg-surface p-7 md:p-10">
      <SectionHeader
        title="Adversary Campaign Demo"
        description="원클릭으로 공격 캠페인을 실행해 탐지율, 유형 분포, 심각도 분포를 자동 리포트합니다."
      />

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="grid gap-4">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void runCampaign({ useDefaultPolicy: false })}
            disabled={campaignLoading}
          >
            {campaignLoading && <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
            {campaignLoading ? '캠페인 실행 중...' : '원클릭 캠페인 실행'}
          </button>

          {campaignError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
              <p className="font-semibold">캠페인 실행 오류</p>
              <p className="mt-1 whitespace-pre-wrap">{campaignError}</p>
            </div>
          )}

          {campaignResult && (
            <div className="grid gap-3">
              <div className="rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <CircularGauge value={campaignResult.detectionRate} label="detect" />
                    <div className="grid gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-steel">Campaign Stats</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-border bg-muted px-3 py-1 text-[11px] font-medium text-steel">
                          Total {campaignResult.totalCases}
                        </span>
                        <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-medium text-red-600">
                          Blocked {campaignResult.blockedCases}
                        </span>
                        <span className="rounded-full border border-border bg-muted px-3 py-1 text-[11px] font-medium text-steel">
                          Model {campaignResult.model}
                        </span>
                      </div>
                      <p className="text-xs text-steel">
                        Run ID: <span className="font-medium text-ink">{campaignResult.runId}</span>
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2 rounded-xl border border-border bg-muted p-3 sm:min-w-[220px]">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-steel">Blocked / Total</p>
                    <p className="text-2xl font-bold tabular-nums text-ink">
                      {campaignResult.blockedCases}/{campaignResult.totalCases}
                    </p>
                    <RiskBar
                      value={campaignResult.totalCases > 0 ? campaignResult.blockedCases / campaignResult.totalCases : 0}
                      height="md"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-muted p-5">
          {!campaignResult && !campaignError && (
            <div className="grid gap-2 text-sm text-steel">
              <p className="font-medium text-ink">리포트 대기 중</p>
              <p>원클릭 실행 후 공격 유형별 차단율과 상위 탐지 사유를 자동으로 요약합니다.</p>
            </div>
          )}

          {campaignResult && (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <p className="text-sm font-semibold text-ink">Type Distribution</p>
                {campaignResult.typeDistribution.map((item) => {
                  const ratio = item.total > 0 ? item.blocked / item.total : 0
                  return (
                    <div key={item.key} className="grid gap-1">
                      <div className="flex items-center justify-between text-xs text-steel">
                        <span>{typeLabels[item.key] ?? item.key}</span>
                        <span className="tabular-nums">
                          {item.blocked}/{item.total}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                          <div className="h-2.5 rounded-full bg-signal transition-all" style={{ width: `${ratio * 100}%` }} />
                        </div>
                        <span className="w-14 text-right text-[11px] font-medium tabular-nums text-steel">
                          {formatPercent(ratio)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="grid gap-2">
                <p className="text-sm font-semibold text-ink">Severity Distribution</p>
                {campaignResult.severityDistribution.map((item) => {
                  const ratio = item.total > 0 ? item.blocked / item.total : 0
                  return (
                    <div key={item.key} className="grid gap-1">
                      <div className="flex items-center justify-between text-xs text-steel">
                        <span>{severityLabels[item.key] ?? item.key}</span>
                        <span className="tabular-nums">
                          {item.blocked}/{item.total}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                          <div className="h-2.5 rounded-full bg-ember transition-all" style={{ width: `${ratio * 100}%` }} />
                        </div>
                        <span className="w-14 text-right text-[11px] font-medium tabular-nums text-steel">
                          {formatPercent(ratio)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="grid gap-2">
                <p className="text-sm font-semibold text-ink">Top Detection Reasons</p>
                <ul className="grid gap-1.5">
                  {campaignResult.topReasons.map((reason) => (
                    <li key={reason} className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-steel">
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">Cases</p>
                  <p className="text-xs text-steel">{campaignResult.cases.length}건</p>
                </div>

                <div className="max-h-80 overflow-auto rounded-xl border border-border bg-surface">
                  <div className="min-w-[860px]">
                    <div className="sticky top-0 z-10 grid grid-cols-[minmax(260px,1.2fr)_160px_120px_110px_1fr] gap-3 border-b border-border bg-muted px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-steel">
                      <div>Label</div>
                      <div>Type</div>
                      <div>Severity</div>
                      <div>Action</div>
                      <div>Risk</div>
                    </div>

                    <ul className="divide-y divide-border">
                      {campaignResult.cases.map((entry) => {
                        const riskValue = clampRisk(entry.decision.risk)
                        const severityVariant =
                          entry.severity === 'critical' || entry.severity === 'high'
                            ? 'critical'
                            : entry.severity === 'medium'
                              ? 'warning'
                              : 'clear'

                        return (
                          <li
                            key={entry.id}
                            className="grid grid-cols-[minmax(260px,1.2fr)_160px_120px_110px_1fr] gap-3 px-4 py-3 text-xs transition hover:bg-muted/50"
                          >
                            <div className="grid gap-1">
                              <p className="font-medium text-ink">{entry.label}</p>
                              <p className="text-[11px] text-steel">{entry.decision.reasons[0] ?? '탐지 사유 없음'}</p>
                            </div>
                            <div className="flex items-center text-steel">{typeLabels[entry.type] ?? entry.type}</div>
                            <div className="flex items-center">
                              <StatusBadge variant={severityVariant} label={severityLabels[entry.severity] ?? entry.severity} />
                            </div>
                            <div className="flex items-center">
                              <StatusBadge variant={entry.decision.action === 'block' ? 'block' : 'allow'} />
                            </div>
                            <div className="grid gap-1">
                              <div className="flex items-center justify-between text-[11px] text-steel">
                                <span className="font-medium tabular-nums">{formatPercent(riskValue)}</span>
                                <span className="tabular-nums">conf {formatPercent(entry.decision.confidence)}</span>
                              </div>
                              <RiskBar value={riskValue} height="sm" />
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
