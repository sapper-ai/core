import Link from 'next/link'

import { DemoPreview } from './components/demo-preview'
import { QuickstartPreview } from './components/quickstart-preview'

export default function MarketingHomePage() {
  return (
    <main className="flex flex-col gap-12">
      <section className="rounded-lg border border-border bg-surface p-8 md:p-12">
        <div className="grid gap-8">
          <div className="grid gap-4">
            <h1 className="max-w-3xl break-keep font-heading text-4xl font-semibold leading-[1.1] text-ink md:text-5xl lg:text-6xl">
              AI 에이전트 공격을 실시간으로{' '}
              <span className="inline-block whitespace-nowrap">
                차단하는 <span className="text-signal">SapperAI</span>
              </span>
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-steel md:text-lg">
              MCP/Agent 환경에서 프롬프트 인젝션, 명령어 인젝션, 경로 탐색 공격을 감지하고
              정책 임계치에 따라 즉시 차단합니다.
            </p>
          </div>

          <p className="font-mono text-sm text-steel md:text-base">
            <span className="font-semibold text-ink">96%</span> blocked <span className="px-1.5">·</span>
            <span className="font-semibold text-ink">0%</span> false positive <span className="px-1.5">·</span> p99{' '}
            <span className="font-semibold text-ink">0.002ms</span>
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/playground/detect?sample=prompt-injection&autorun=1"
              className="inline-flex items-center justify-center rounded-lg bg-olive-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-olive-700 dark:bg-olive-400 dark:text-ink dark:hover:bg-olive-300"
            >
              Try Playground
            </Link>
            <Link
              href="/quickstart/sdk"
              className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-3 text-sm font-semibold text-ink transition hover:bg-muted"
            >
              Quickstart
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <DemoPreview />
        <QuickstartPreview />
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="rounded-lg border border-border border-l-2 border-l-ember bg-surface p-6 transition-colors hover:border-steel">
          <h3 className="font-heading text-lg font-semibold text-ink">어떻게 동작하나요?</h3>
          <p className="mt-2 text-sm leading-relaxed text-steel">
            ToolCall 입력이 들어오면 RulesDetector가 공격 패턴을 탐지하고, DecisionEngine이 정책 임계치에 따라 최종
            차단/허용을 결정합니다.
          </p>
        </article>
        <article className="rounded-lg border border-border border-l-2 border-l-warn bg-surface p-6 transition-colors hover:border-steel">
          <h3 className="font-heading text-lg font-semibold text-ink">탐지 범위</h3>
          <p className="mt-2 text-sm leading-relaxed text-steel">
            Prompt Injection, Command Injection, Path Traversal, Data Exfiltration, Code Injection을 포함한 60+
            룰을 제공합니다.
          </p>
        </article>
        <article className="rounded-lg border border-border border-l-2 border-l-signal bg-surface p-6 transition-colors hover:border-steel">
          <h3 className="font-heading text-lg font-semibold text-ink">연동 방식</h3>
          <p className="mt-2 text-sm leading-relaxed text-steel">
            MCP Proxy, OpenAI Agents Guardrail, Direct SDK 세 가지로 통합할 수 있습니다. 팀 상황에 따라 최소한의
            변경으로 적용 가능합니다.
          </p>
        </article>
      </section>
    </main>
  )
}
