'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

type ThemeMode = 'system' | 'light' | 'dark'

const THEME_ORDER: ThemeMode[] = ['system', 'light', 'dark']

const THEME_LABELS: Record<ThemeMode, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
}

function MonitorIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2">
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 20h8" />
      <path d="M12 17v3" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3c0.54 0 0.81 0.66 0.43 1.04A7 7 0 1 0 19.96 12c0.38-0.38 1.04-0.11 1.04 0.43Z" />
    </svg>
  )
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const resolvedTheme: ThemeMode = theme === 'light' || theme === 'dark' ? theme : 'system'
  const currentTheme: ThemeMode = mounted ? resolvedTheme : 'system'
  const nextTheme = THEME_ORDER[(THEME_ORDER.indexOf(currentTheme) + 1) % THEME_ORDER.length]

  const label = mounted
    ? `Theme: ${THEME_LABELS[currentTheme]}. Switch to ${THEME_LABELS[nextTheme]}.`
    : 'Theme toggle'

  const icon =
    currentTheme === 'light' ? <SunIcon /> : currentTheme === 'dark' ? <MoonIcon /> : <MonitorIcon />

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => setTheme(nextTheme)}
      disabled={!mounted}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-steel transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/50 disabled:cursor-not-allowed"
    >
      {icon}
    </button>
  )
}
