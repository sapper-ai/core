import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'

import { CampaignSection } from '../_components/demos/campaign-section'

export const metadata: Metadata = {
  title: 'Playground: Adversary',
  alternates: { canonical: '/playground/adversary' },
}

export default function PlaygroundAdversaryPage() {
  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-border bg-surface p-6">
        <p className="text-sm font-semibold text-ink">Deep links</p>
        <p className="mt-1 text-xs text-steel">
          Supports <code className="rounded bg-muted px-1 py-0.5">?autorun=1</code> and{' '}
          <code className="rounded bg-muted px-1 py-0.5">?useDefaultPolicy=1</code>, then cleans the URL after hydration.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={{ pathname: '/playground/adversary', query: { autorun: '1' } }}
            className="rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-surface"
          >
            Autorun (config policy)
          </Link>
          <Link
            href={{ pathname: '/playground/adversary', query: { autorun: '1', useDefaultPolicy: '1' } }}
            className="rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-surface"
          >
            Autorun (default policy)
          </Link>
        </div>
      </section>

      <Suspense fallback={<div className="rounded-2xl border border-border bg-surface p-6 text-sm text-steel">Loading...</div>}>
        <CampaignSection />
      </Suspense>
    </div>
  )
}
