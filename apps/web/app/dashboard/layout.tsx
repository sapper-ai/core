import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { DashboardNav } from './components/dashboard-nav'

export const metadata: Metadata = {
  title: 'SapperAI Dashboard',
}

const tabs = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/threat-intel', label: 'Threat Intel' },
  { href: '/dashboard/campaign', label: 'Campaign' },
  { href: '/dashboard/policy', label: 'Policy' },
  { href: '/dashboard/audit', label: 'Audit Log' },
] as const

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 pb-16 pt-8 md:px-12">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">SapperAI Dashboard</h1>
          <p className="mt-1 text-sm text-steel">Security guardrail management</p>
        </div>
        <a href="/" className="text-sm font-medium text-signal hover:underline">
          Demo &rarr;
        </a>
      </header>
      <DashboardNav tabs={tabs} />
      <main className="mt-6 flex-1">{children}</main>
    </div>
  )
}
