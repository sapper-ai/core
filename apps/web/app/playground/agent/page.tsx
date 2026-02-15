import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'

import { AgentDemoSection } from '../_components/demos/agent-demo-section'
import { agentScenarios } from '../_components/demos/presets'

export const metadata: Metadata = {
  title: 'Playground: Agent',
  alternates: { canonical: '/playground/agent' },
}

export default function PlaygroundAgentPage() {
  const hasOpenAiApiKey = Boolean(process.env.OPENAI_API_KEY?.trim())

  return (
    <div className="grid gap-6">
      {!hasOpenAiApiKey && (
        <section className="rounded-2xl border border-border bg-muted p-5 text-sm text-steel shadow-subtle">
          <p className="font-semibold text-ink">OPENAI_API_KEY가 설정되지 않았습니다.</p>
          <p className="mt-1">
            Agent SDK 실행 단계는 생략되고 rules-only 시뮬레이션으로 동작합니다. 더 풍부한 분석을 원하면 서버 환경 변수에
            OPENAI_API_KEY를 설정하세요.
          </p>
        </section>
      )}
      <section className="rounded-2xl border border-border bg-white p-6 shadow-subtle">
        <p className="text-sm font-semibold text-ink">Deep links</p>
        <p className="mt-1 text-xs text-steel">
          Supports <code className="rounded bg-muted px-1 py-0.5">?scenario=&lt;id&gt;&amp;autorun=1</code> and cleans the
          URL after hydration.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {agentScenarios.map((scenario) => (
            <Link
              key={scenario.id}
              href={{ pathname: '/playground/agent', query: { scenario: scenario.id, autorun: '1' } }}
              className="rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-white"
            >
              Run {scenario.title}
            </Link>
          ))}
        </div>
      </section>

      <Suspense fallback={<div className="rounded-2xl border border-border bg-white p-6 text-sm text-steel shadow-subtle">Loading...</div>}>
        <AgentDemoSection />
      </Suspense>
    </div>
  )
}
