'use client'

import type { DetectionResponse } from '@/app/components/types'

import { CircularGauge } from '@/app/components/circular-gauge'
import { RiskBar } from '@/app/components/risk-bar'
import { StatusBadge } from '@/app/components/status-badge'
import { buildPipeline, clampRisk, formatPercent } from '@/app/components/utils'

export function DetectionVisualization({ data }: { data: DetectionResponse }) {
  const pipeline = buildPipeline(data)
  const risk = clampRisk(data.risk)
  const timeline = [
    { id: 'ingest', title: 'ToolCall 수신', detail: '요청 파싱 및 정책 로드' },
    ...pipeline.map((step, index) => ({
      id: `pipeline-${step.id}`,
      title: `${index + 1}. ${step.title}`,
      detail: `${step.status.toUpperCase()} · Risk ${formatPercent(step.risk)}`,
    })),
    {
      id: 'decision',
      title: 'DecisionEngine',
      detail: `최종 판정 ${data.action.toUpperCase()} · Confidence ${formatPercent(data.confidence)}`,
    },
  ]

  return (
    <div className="grid gap-4 rounded-xl border border-border bg-muted p-4">
      <div className="grid gap-3 rounded-xl border border-border bg-surface p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-1">
            <p className="text-sm font-semibold text-ink">Risk Gauge</p>
            <p className="text-xs text-steel">최종 위험도 및 정책 판정 결과</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge variant={data.action === 'block' ? 'block' : 'allow'} />
            <span className="rounded-full border border-border bg-muted px-3 py-0.5 text-[10px] font-semibold tabular-nums text-steel">
              conf {formatPercent(data.confidence)}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CircularGauge value={risk} label="risk" />
          <div className="grid w-full gap-2 sm:max-w-[340px]">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-steel">Signal</p>
              <p className="mt-1 text-xs text-ink">{data.reasons[0] ?? '탐지 사유 없음'}</p>
            </div>
            <RiskBar value={risk} height="md" />
            <p className="text-[11px] tabular-nums text-steel">
              Risk {formatPercent(risk)} / Confidence {formatPercent(data.confidence)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-2">
        <p className="text-sm font-semibold text-ink">Detection Pipeline</p>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-between sm:gap-2">
            {pipeline.map((step, index) => (
              <div key={step.id} className="flex items-center gap-2 sm:flex-1">
                <div className="flex-1 rounded-xl border border-border bg-muted p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-steel">{step.title}</p>
                    <StatusBadge
                      variant={step.status === 'critical' ? 'critical' : step.status === 'warning' ? 'warning' : 'clear'}
                      label={step.status}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-steel">{step.detail}</p>
                  <div className="mt-2">
                    <RiskBar value={step.risk} height="sm" />
                  </div>
                  <p className="mt-1.5 text-[11px] tabular-nums text-steel">
                    Risk {formatPercent(step.risk)} · Conf {formatPercent(step.confidence)}
                  </p>
                </div>
                {index < pipeline.length - 1 && (
                  <div className="hidden items-center justify-center sm:flex">
                    <span className="text-gray-300">&#8594;</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-steel">DecisionEngine</p>
            <p className="text-xs text-steel">최종 판정: {data.action.toUpperCase()}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-2">
        <p className="text-sm font-semibold text-ink">Timeline</p>
        <ol className="relative grid gap-2 pl-8 before:absolute before:bottom-2 before:left-3 before:top-2 before:w-px before:bg-border">
          {timeline.map((entry, index) => {
            const isTerminal = index === timeline.length - 1
            return (
              <li key={entry.id} className="relative rounded-lg border border-border bg-surface px-3 py-2">
                <span
                  className={`absolute left-3 top-4 h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 ${
                    isTerminal ? 'border-ember bg-ember' : 'border-gray-300 bg-surface'
                  }`}
                />
                <p className="text-xs font-semibold uppercase tracking-wide text-steel">{entry.title}</p>
                <p className="mt-1 text-xs text-steel">{entry.detail}</p>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
