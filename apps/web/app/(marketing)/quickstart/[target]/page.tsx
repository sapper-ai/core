import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { QuickstartCodeBlock } from '../../_components/quickstart/quickstart-code-block'
import { QuickstartTargetNav } from '../../_components/quickstart/quickstart-target-nav'
import {
  quickstartTargetOrder,
  quickstartTargets,
  resolveQuickstartTarget,
  type QuickstartTarget,
} from '../config'

export function generateStaticParams(): { target: QuickstartTarget }[] {
  return quickstartTargetOrder.map((target) => ({ target }))
}

export function generateMetadata({ params }: { params: { target: string } }): Metadata {
  const resolved = resolveQuickstartTarget(params.target)
  if (!resolved) {
    return {
      title: 'Quickstart | SapperAI',
      description: 'SapperAI Quickstart 가이드',
    }
  }

  const config = quickstartTargets[resolved]
  return {
    title: `${config.pageTitle} | SapperAI`,
    description: config.pageDescription,
  }
}

export default function QuickstartTargetPage({ params }: { params: { target: string } }) {
  const resolved = resolveQuickstartTarget(params.target)
  if (!resolved) {
    redirect('/quickstart/sdk')
  }

  const config = quickstartTargets[resolved]

  return (
    <main className="flex flex-col gap-10">
      <header className="grid gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-steel">Quickstart</p>
        <h1 className="text-3xl font-bold tracking-tight text-ink md:text-4xl">{config.pageTitle}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-steel md:text-base">{config.intro}</p>
      </header>

      <QuickstartTargetNav currentTarget={resolved} />

      <section className="grid gap-3 md:grid-cols-3">
        {config.highlights.map((item) => (
          <article key={item.title} className="rounded-lg border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold text-ink">{item.title}</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-steel">{item.description}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4">
        {config.steps.map((step) => (
          <article key={step.title} className="rounded-lg border border-border bg-surface p-6 md:p-8">
            <div className="grid gap-1">
              <h2 className="text-lg font-semibold text-ink">{step.title}</h2>
              {step.description && <p className="text-sm leading-relaxed text-steel">{step.description}</p>}
            </div>

            <div className="mt-4 grid gap-3">
              {step.blocks.map((block) => (
                <QuickstartCodeBlock
                  key={`${step.title}-${block.title ?? block.language}`}
                  code={block.code}
                  language={block.language}
                  title={block.title}
                />
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}
