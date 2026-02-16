import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { PlaygroundNav } from './_components/playground-nav'

export const metadata: Metadata = {
  title: 'SapperAI Playground',
  robots: {
    index: false,
    follow: true,
  },
}

const tabs = [
  { href: '/playground/runtime', label: 'Runtime' },
  { href: '/playground/skill-scan', label: 'Skill Scan' },
  { href: '/playground/adversary', label: 'Adversary' },
  { href: '/playground/config', label: 'Config' },
] as const

export default function PlaygroundLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 pb-16 pt-8 md:px-12">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">SapperAI Playground</h1>
          <p className="mt-1 text-sm text-steel">Runnable demos with deep links and policy configuration.</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/" className="font-medium text-signal hover:underline">
            Marketing
          </Link>
        </div>
      </header>

      <PlaygroundNav tabs={tabs} />
      <main className="mt-6 flex-1">{children}</main>
    </div>
  )
}
