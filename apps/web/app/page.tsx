'use client'

import { AgentDemoSection } from './components/agent-demo-section'
import { CampaignSection } from './components/campaign-section'
import { Footer } from './components/footer'
import { HeroSection } from './components/hero-section'
import { InteractiveDemoSection } from './components/interactive-demo-section'
import { UploadSection } from './components/upload-section'

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-12 px-6 pb-16 pt-12 md:px-12">
      <HeroSection />
      <UploadSection />
      <InteractiveDemoSection />
      <AgentDemoSection />
      <CampaignSection />

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

      <Footer />
    </main>
  )
}
