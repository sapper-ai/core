import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'

import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  ),
  title: {
    default: 'SapperAI | AI 에이전트 보안 가드레일',
    template: '%s | SapperAI',
  },
  description:
    'SapperAI는 MCP/Agent 환경에서 프롬프트 인젝션, 명령어 인젝션, 경로 탐색 공격을 실시간으로 감지하고 차단합니다.',
  openGraph: {
    title: 'SapperAI | AI 에이전트 보안 가드레일',
    description:
      'SapperAI는 MCP/Agent 환경에서 프롬프트 인젝션, 명령어 인젝션, 경로 탐색 공격을 실시간으로 감지하고 차단합니다.',
    siteName: 'SapperAI',
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
