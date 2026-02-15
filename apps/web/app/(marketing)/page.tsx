import Link from 'next/link'

import { DemoPreview } from './components/demo-preview'
import { QuickstartPreview } from './components/quickstart-preview'

const heroStats = ['96% 악성 샘플 차단', '0% 정상 샘플 오탐', 'Rules-only p99 0.0018ms'] as const

export default function MarketingHomePage() {
  return (
    <main className="flex flex-col gap-12">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-white p-8 shadow-subtle md:p-12">
        <div className="relative z-10 grid gap-8">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-muted px-4 py-1.5 text-xs font-medium text-steel">
            <span className="h-1.5 w-1.5 rounded-full bg-mint" />
            MCP + Agents Security Guardrails
          </span>

          <div className="grid gap-4">
            <h1 className="max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight text-ink md:text-5xl lg:text-6xl">
              AI 에이전트 공격을
              <br className="hidden md:block" />
              정책 기반으로 실시간 차단하는&nbsp;
              <span className="text-signal">SapperAI</span>
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-steel md:text-lg">
              MCP/Agent 환경에서 프롬프트 인젝션, 명령어 인젝션, 경로 탐색 공격을 감지하고
              정책 임계치에 따라 즉시 차단합니다.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {heroStats.map((stat) => (
              <div
                key={stat}
                className="rounded-xl border border-border bg-white px-5 py-3 text-sm font-medium text-steel"
              >
                {stat}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/playground/detect?sample=prompt-injection&autorun=1"
              className="inline-flex items-center justify-center rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-white shadow-subtle transition hover:bg-gray-800"
            >
              Try Playground
            </Link>
            <Link
              href="/quickstart/sdk"
              className="inline-flex items-center justify-center rounded-lg border border-border bg-white px-4 py-3 text-sm font-semibold text-ink shadow-subtle transition hover:bg-muted"
            >
              Quickstart
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-lg border border-border bg-white px-4 py-3 text-sm font-semibold text-ink shadow-subtle transition hover:bg-muted"
            >
              Dashboard
            </Link>
          </div>
        </div>

        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-signal/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-mint/10 blur-3xl" />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <DemoPreview />
        <QuickstartPreview />
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        <article className="rounded-2xl border border-border bg-white p-6 shadow-subtle">
          <h3 className="text-lg font-semibold text-ink">어떻게 동작하나요?</h3>
          <p className="mt-2 text-sm leading-relaxed text-steel">
            ToolCall 입력이 들어오면 RulesDetector가 공격 패턴을 탐지하고, DecisionEngine이 정책 임계치에 따라 최종
            차단/허용을 결정합니다.
          </p>
        </article>
        <article className="rounded-2xl border border-border bg-white p-6 shadow-subtle">
          <h3 className="text-lg font-semibold text-ink">탐지 범위</h3>
          <p className="mt-2 text-sm leading-relaxed text-steel">
            Prompt Injection, Command Injection, Path Traversal, Data Exfiltration, Code Injection을 포함한 60+
            룰을 제공합니다.
          </p>
        </article>
        <article className="rounded-2xl border border-border bg-white p-6 shadow-subtle">
          <h3 className="text-lg font-semibold text-ink">연동 방식</h3>
          <p className="mt-2 text-sm leading-relaxed text-steel">
            MCP Proxy, OpenAI Agents Guardrail, Direct SDK 세 가지로 통합할 수 있습니다. 팀 상황에 따라 최소한의
            변경으로 적용 가능합니다.
          </p>
        </article>
      </section>
    </main>
  )
}

