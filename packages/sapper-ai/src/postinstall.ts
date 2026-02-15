import pkg from '../package.json'

import { createColors } from './utils/format'

export function runPostinstall(): void {
  try {
    const colors = createColors()
    const version = typeof pkg.version === 'string' ? pkg.version : ''

    const name = colors.olive ? `${colors.olive}sapper-ai${colors.reset}` : 'sapper-ai'
    const ver = version ? `${colors.dim}v${version}${colors.reset}` : ''

    console.log(`\n  ${name} ${ver}\n`)
    console.log('  Run npx sapper-ai scan to get started.\n')
  } catch {
  }
}

if (require.main === module) {
  runPostinstall()
}
