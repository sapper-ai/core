import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'

import { InteractiveDemoSection } from '../_components/demos/interactive-demo-section'
import { presets } from '../_components/demos/presets'

export const metadata: Metadata = {
  title: 'Playground: Runtime',
  alternates: { canonical: '/playground/runtime' },
}

export default function PlaygroundRuntimePage() {
  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-border bg-surface p-6">
        <p className="text-sm font-semibold text-ink">Deep links</p>
        <p className="mt-1 text-xs text-steel">
          Supports <code className="rounded bg-muted px-1 py-0.5">?sample=&lt;id&gt;&amp;autorun=1</code> and cleans the
          URL after hydration.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {presets.map((preset) => (
            <Link
              key={preset.id}
              href={{ pathname: '/playground/runtime', query: { sample: preset.id, autorun: '1' } }}
              className="rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-surface"
            >
              Run {preset.title}
            </Link>
          ))}
        </div>
      </section>

      <Suspense fallback={<div className="rounded-2xl border border-border bg-surface p-6 text-sm text-steel">Loading...</div>}>
        <InteractiveDemoSection />
      </Suspense>
    </div>
  )
}
