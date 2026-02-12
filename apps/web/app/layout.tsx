import type { Metadata } from 'next'
import { Space_Grotesk, Noto_Sans_KR } from 'next/font/google'
import type { ReactNode } from 'react'

import './globals.css'

const heading = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-heading',
  weight: ['500', '700'],
})

const body = Noto_Sans_KR({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '700'],
})

export const metadata: Metadata = {
  title: 'SapperAI | AI 에이전트 보안 가드레일',
  description:
    'SapperAI는 MCP/Agent 환경에서 프롬프트 인젝션, 명령어 인젝션, 경로 탐색 공격을 실시간으로 감지하고 차단합니다.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body className={`${heading.variable} ${body.variable}`}>{children}</body>
    </html>
  )
}
