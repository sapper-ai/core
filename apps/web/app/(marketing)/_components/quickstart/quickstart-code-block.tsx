'use client'

import { useEffect, useMemo, useState } from 'react'

type CopyState = 'idle' | 'copied' | 'error'

export function QuickstartCodeBlock({
  code,
  language,
  title,
}: {
  code: string
  language: string
  title?: string
}) {
  const [copyState, setCopyState] = useState<CopyState>('idle')

  const headerLabel = useMemo(() => (title ? `${title}` : language.toUpperCase()), [language, title])

  useEffect(() => {
    if (copyState === 'idle') return
    const id = window.setTimeout(() => setCopyState('idle'), 1400)
    return () => window.clearTimeout(id)
  }, [copyState])

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(code)
      setCopyState('copied')
    } catch {
      setCopyState('error')
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-[#0a0a0a]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/60">{headerLabel}</p>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="rounded-lg border border-white/15 bg-steel/20 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-steel/30"
          aria-label="Copy code"
        >
          {copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Copy failed' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3 text-[12px] leading-relaxed text-gray-100">
        <code>{code}</code>
      </pre>
    </div>
  )
}
