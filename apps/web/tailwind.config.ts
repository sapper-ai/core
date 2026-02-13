import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0a0a0a',
        steel: '#4b5563',
        frost: '#fafafa',
        mint: '#22c55e',
        ember: '#ef4444',
        signal: '#3b82f6',
        warn: '#f59e0b',
        border: '#e5e7eb',
        surface: '#ffffff',
        muted: '#f3f4f6',
      },
      boxShadow: {
        subtle: '0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.06)',
        lifted: '0 4px 24px -4px rgba(0, 0, 0, 0.08)',
      },
    },
  },
  plugins: [],
}

export default config
