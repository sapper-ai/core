#!/usr/bin/env node

import { existsSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import * as readline from 'node:readline'

import select from '@inquirer/select'

import { presets, type PresetName } from './presets'
import { runScan, type ScanOptions } from './scan'

export async function runCli(argv: string[] = process.argv.slice(2)): Promise<number> {
  if (argv[0] === '--help' || argv[0] === '-h') {
    printUsage()
    return 0
  }

  if (argv[0] === 'scan') {
    const parsed = parseScanArgs(argv.slice(1))
    if (!parsed) {
      printUsage()
      return 1
    }

    const scanOptions = await resolveScanOptions(parsed)
    if (!scanOptions) {
      printUsage()
      return 1
    }

    return runScan(scanOptions)
  }

  if (argv[0] === 'dashboard') {
    return runDashboard()
  }

  if (argv[0] !== 'init') {
    printUsage()
    return 1
  }

  await runInitWizard()
  return 0
}

function printUsage(): void {
  console.log(`
sapper-ai - AI security guardrails

Usage:
  sapper-ai scan              Interactive scan scope (TTY only)
  sapper-ai scan .            Current directory only (no subdirectories)
  sapper-ai scan --deep       Current directory + subdirectories
  sapper-ai scan --system     AI system paths (~/.claude, ~/.cursor, ...)
  sapper-ai scan ./path       Scan a specific file/directory
  sapper-ai scan --fix        Quarantine blocked files
  sapper-ai scan --ai         Deep scan with AI analysis (requires OPENAI_API_KEY)
  sapper-ai scan --report     Generate HTML report and open in browser
  sapper-ai scan --no-save    Skip saving scan results to ~/.sapperai/scans/
  sapper-ai init          Interactive setup wizard
  sapper-ai dashboard     Launch web dashboard
  sapper-ai --help        Show this help

Learn more: https://github.com/sapper-ai/sapperai
`)
}

function parseScanArgs(
  argv: string[]
): {
  targets: string[]
  fix: boolean
  deep: boolean
  system: boolean
  ai: boolean
  report: boolean
  noSave: boolean
} | null {
  const targets: string[] = []
  let fix = false
  let deep = false
  let system = false
  let ai = false
  let report = false
  let noSave = false

  for (const arg of argv) {
    if (arg === '--fix') {
      fix = true
      continue
    }

    if (arg === '--deep') {
      deep = true
      continue
    }

    if (arg === '--system') {
      system = true
      continue
    }

    if (arg === '--ai') {
      ai = true
      continue
    }

    if (arg === '--report') {
      report = true
      continue
    }

    if (arg === '--no-save') {
      noSave = true
      continue
    }

    if (arg.startsWith('-')) {
      return null
    }

    targets.push(arg)
  }

  return { targets, fix, deep, system, ai, report, noSave }
}

function displayPath(path: string): string {
  const home = homedir()
  if (path === home) return '~'
  return path.startsWith(home + '/') ? `~/${path.slice(home.length + 1)}` : path
}

async function promptScanScope(cwd: string): Promise<'shallow' | 'deep' | 'system'> {
  const answer = await select({
    message: 'Scan scope:',
    choices: [
      { name: `Current directory only     ${displayPath(cwd)}`, value: 'shallow' as const },
      { name: `Current + subdirectories   ${displayPath(join(cwd, '**'))}`, value: 'deep' as const },
      {
        name: 'AI system scan              ~/.claude, ~/.cursor, ~/.vscode ...',
        value: 'system' as const,
      },
    ],
    default: 'deep',
  })
  return answer
}

async function promptScanDepth(): Promise<boolean> {
  const answer = await select({
    message: 'Scan depth:',
    choices: [
      { name: 'Quick scan (rules only)      Fast regex pattern matching', value: false as const },
      {
        name: 'Deep scan (rules + AI)       AI-powered analysis (requires OPENAI_API_KEY)',
        value: true as const,
      },
    ],
    default: false,
  })
  return answer
}

async function resolveScanOptions(args: {
  targets: string[]
  fix: boolean
  deep: boolean
  system: boolean
  ai: boolean
  report: boolean
  noSave: boolean
}): Promise<ScanOptions | null> {
  const cwd = process.cwd()

  const common = {
    fix: args.fix,
    report: args.report,
    noSave: args.noSave,
  }

  if (args.system) {
    if (args.targets.length > 0) {
      return null
    }

    return { ...common, system: true, ai: args.ai, scopeLabel: 'AI system scan' }
  }

  if (args.targets.length > 0) {
    if (args.targets.length === 1 && args.targets[0] === '.' && !args.deep) {
      return {
        ...common,
        targets: [cwd],
        deep: false,
        ai: args.ai,
        scopeLabel: 'Current directory only',
      }
    }

    return {
      ...common,
      targets: args.targets,
      deep: true,
      ai: args.ai,
      scopeLabel: args.targets.length === 1 && args.targets[0] === '.' ? 'Current + subdirectories' : 'Custom path',
    }
  }

  if (args.deep) {
    return { ...common, targets: [cwd], deep: true, ai: args.ai, scopeLabel: 'Current + subdirectories' }
  }

  if (process.stdout.isTTY !== true) {
    return { ...common, targets: [cwd], deep: true, ai: false, scopeLabel: 'Current + subdirectories' }
  }

  const scope = await promptScanScope(cwd)

  const ai = args.ai ? true : await promptScanDepth()

  if (scope === 'system') {
    return { ...common, system: true, ai, scopeLabel: 'AI system scan' }
  }
  if (scope === 'shallow') {
    return { ...common, targets: [cwd], deep: false, ai, scopeLabel: 'Current directory only' }
  }
  return { ...common, targets: [cwd], deep: true, ai, scopeLabel: 'Current + subdirectories' }
}

async function runDashboard(): Promise<number> {
  const configuredPort = process.env.PORT
  const standalonePort = configuredPort ?? '4100'
  const devPort = configuredPort ?? '3000'

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const startPath = require.resolve('@sapper-ai/dashboard/bin/start')
    process.env.PORT = standalonePort
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require(startPath)

    return await new Promise<number>((resolveExit) => {
      const stop = () => resolveExit(0)
      process.once('SIGINT', stop)
      process.once('SIGTERM', stop)
    })
  } catch {
  }

  const webDir = resolve(__dirname, '../../../apps/web')

  if (existsSync(resolve(webDir, 'package.json'))) {
    console.log(`\n  SapperAI Dashboard (dev): http://localhost:${devPort}/dashboard\n`)
    console.log('  Press Ctrl+C to stop\n')

    const child = spawn('npx', ['next', 'dev', '--port', devPort], {
      cwd: webDir,
      stdio: 'inherit',
      env: process.env,
    })

    process.on('SIGINT', () => child.kill('SIGINT'))
    process.on('SIGTERM', () => child.kill('SIGTERM'))

    return await new Promise<number>((resolveExit) => {
      child.on('close', (code) => resolveExit(code ?? 0))
    })
  }

  console.error('\n  Install @sapper-ai/dashboard for standalone mode:')
  console.error('  pnpm add @sapper-ai/dashboard\n')
  return 1
}

async function runInitWizard(): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const ask = (q: string): Promise<string> => new Promise((res) => rl.question(q, res))

  console.log('\n  SapperAI Setup\n')

  console.log('  Available presets:\n')
  const entries = Object.entries(presets) as [
    PresetName,
    (typeof presets)[PresetName],
  ][]
  entries.forEach(([key, p], i) => {
    const marker = key === 'standard' ? ' (default)' : ''
    console.log(`    ${i + 1}) ${key}${marker} - ${p.description}`)
  })
  console.log()

  const presetAnswer = await ask(`  Choose preset [1-${entries.length}] (default: 2): `)
  const presetIndex = (Number.parseInt(presetAnswer, 10) || 2) - 1
  const clampedIndex = Math.max(0, Math.min(presetIndex, entries.length - 1))
  const selectedPreset = entries[clampedIndex]![0]

  const auditAnswer = await ask('  Audit log file path (enter to skip): ')
  const auditLogPath = auditAnswer.trim() || undefined

  const outputPath = resolve(process.cwd(), 'sapperai.config.yaml')
  if (existsSync(outputPath)) {
    const overwrite = await ask('  sapperai.config.yaml exists. Overwrite? [y/N]: ')
    if (overwrite.trim().toLowerCase() !== 'y') {
      console.log('  Aborted.')
      rl.close()
      return
    }
  }

  const lines: string[] = [
    '# SapperAI Configuration',
    '# Generated by: sapper-ai init',
    '# Docs: https://github.com/sapper-ai/sapperai',
    '',
    ...buildPolicyYaml(selectedPreset, auditLogPath),
  ]

  writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8')

  console.log(`\n  Created ${outputPath}\n`)
  console.log('  Quick start:\n')
  console.log("    import { createGuard } from 'sapper-ai'")
  console.log('    const guard = createGuard()')
  console.log('    const decision = await guard.check(toolCall)')
  console.log()

  rl.close()
}

function buildPolicyYaml(preset: PresetName, auditLogPath?: string): string[] {
  const p = presets[preset].policy
  const lines: string[] = []

  lines.push(`mode: ${p.mode}`)
  lines.push(`defaultAction: ${p.defaultAction}`)
  lines.push(`failOpen: ${p.failOpen}`)
  lines.push('')
  lines.push('detectors:')

  const detectors = p.detectors ?? ['rules']
  for (const d of detectors) {
    lines.push(`  - ${d}`)
  }

  lines.push('')
  lines.push('thresholds:')
  const thresholds = p.thresholds ?? {}
  lines.push(`  riskThreshold: ${thresholds.riskThreshold ?? 0.7}`)
  lines.push(`  blockMinConfidence: ${thresholds.blockMinConfidence ?? 0.5}`)

  if (auditLogPath) {
    lines.push('')
    lines.push(`auditLogPath: ${auditLogPath}`)
  }

  return lines
}

function isDirectExecution(argv: string[]): boolean {
  const entry = argv[1]
  if (!entry) {
    return false
  }

  return entry.endsWith('/cli.js') || entry.endsWith('\\cli.js') || entry.endsWith('/cli.ts')
}

if (isDirectExecution(process.argv)) {
  runCli().then(
    (exitCode) => {
      process.exit(exitCode)
    },
    (error) => {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(msg)
      process.exit(1)
    }
  )
}
