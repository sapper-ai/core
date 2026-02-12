import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#11131f',
        steel: '#1d2335',
        frost: '#f4f8ff',
        mint: '#0fb889',
        ember: '#ff6a3d',
        signal: '#2a7fff',
      },
      boxShadow: {
        aura: '0 22px 80px rgba(29, 35, 53, 0.18)',
      },
    },
  },
  plugins: [],
}

export default config
