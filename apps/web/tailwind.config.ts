import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        olive: {
          50: '#f5f7f0',
          100: '#e8eddb',
          200: '#d1dbb8',
          300: '#b3c48a',
          400: '#8fa85c',
          500: '#6b8e3a',
          600: '#5e7a3a',
          700: '#4B5320',
          800: '#3d4420',
          900: '#343a1e',
          950: '#1a1f0e',
        },
        frost: 'rgb(var(--color-frost) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        steel: 'rgb(var(--color-steel) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        signal: 'rgb(var(--color-signal) / <alpha-value>)',
        mint: 'rgb(var(--color-mint) / <alpha-value>)',
        ember: 'rgb(var(--color-ember) / <alpha-value>)',
        warn: 'rgb(var(--color-warn) / <alpha-value>)',
      },
      fontFamily: {
        heading: ['var(--font-heading)'],
        mono: ['var(--font-mono)'],
      },
    },
  },
  plugins: [],
}

export default config
