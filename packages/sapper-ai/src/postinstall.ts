import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import pkg from '../package.json'

import { createColors } from './utils/format'

export function runPostinstall(): void {
  try {
    const homeDir = process.env.HOME ?? process.env.USERPROFILE ?? os.homedir()
    fs.mkdirSync(path.join(homeDir, '.sapper-ai'), { recursive: true })

    const colors = createColors()
    const version = typeof pkg.version === 'string' ? pkg.version : ''

    const name = colors.olive ? `${colors.olive}sapper-ai${colors.reset}` : 'sapper-ai'
    const ver = version ? `${colors.dim}v${version}${colors.reset}` : ''

    console.log(`\n  ${name} ${ver}\n`)
    console.log('  SapperAI 설치 완료. Skill Guard 활성화: sapper-ai setup\n')
  } catch {
    // Postinstall failure must not block package installation.
  }
}

if (require.main === module) {
  runPostinstall()
}
