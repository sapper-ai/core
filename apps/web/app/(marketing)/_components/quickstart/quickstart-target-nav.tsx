import Link from 'next/link'

import { quickstartTargetOrder, quickstartTargets, type QuickstartTarget } from '../../quickstart/config'

export function QuickstartTargetNav({ currentTarget }: { currentTarget: QuickstartTarget }) {
  return (
    <nav aria-label="Quickstart targets" className="grid gap-3 md:grid-cols-3">
      {quickstartTargetOrder.map((targetId) => {
        const target = quickstartTargets[targetId]
        const isActive = targetId === currentTarget

        return (
          <Link
            key={targetId}
            href={`/quickstart/${targetId}`}
            className={`rounded-lg border p-5 transition-colors ${
              isActive ? 'border-ink bg-ink text-white' : 'border-border bg-surface text-ink hover:bg-muted'
            }`}
          >
            <p className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-ink'}`}>{target.label}</p>
            <p className={`mt-1 text-xs leading-relaxed ${isActive ? 'text-white/70' : 'text-steel'}`}>
              {target.tagline}
            </p>
          </Link>
        )
      })}
    </nav>
  )
}
