import type { ReactNode } from 'react'

import { Footer } from '../components/footer'
import { SiteHeader } from './components/site-header'

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-frost">
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 pb-16 pt-10 md:px-12">
        {children}
        <Footer />
      </div>
    </div>
  )
}

