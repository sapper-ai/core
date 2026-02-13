'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Tab = { href: string; label: string }

export function DashboardNav({ tabs }: { tabs: readonly Tab[] }) {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 border-b border-border">
      {tabs.map((tab) => {
        const isActive = tab.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(tab.href)

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              isActive ? 'border-ink text-ink' : 'border-transparent text-steel hover:text-ink'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
