#!/usr/bin/env node

import { existsSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import * as readline from 'node:readline'

import select from '@inquirer/select'

import { presets, type PresetName } from './presets'
import { renderPolicyYaml } from './policyYaml'
import { getHardenPlanSummary, runHarden } from './harden'
import { runQuarantineList, runQuarantineRestore } from './quarantine'
import { unwrapMcpConfigFile, wrapMcpConfigFile, checkNpxAvailable, resolveInstalledPackageVersion } from './mcp/wrapConfig'
import { runScan, type ScanOptions } from './scan'
import { detectOpenClawEnvironment } from './openclaw/detect'
import { resolveOpenClawPolicy, scanSkills, type OpenClawScanProgressEvent } from './openclaw/scanner'
import { isCiEnv } from './utils/env'
import { getStatus as getSetupStatus, registerHooks, removeHooks } from './guard/setup'

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

    const scanExitCode = await runScan(scanOptions)

    const shouldOfferHarden =
      parsed.noPrompt !== true &&
      process.stdout.isTTY === true &&
      process.stdin.isTTY === true &&
      isCiEnv(process.env) !== true &&
      (parsed.harden === true || (await getHardenPlanSummary({ includeSystem: true })).actions.length > 0)

    if (shouldOfferHarden) {
      const hardenExitCode = await runHarden({
        apply: true,
        includeSystem: true,
      })

      if (scanExitCode === 0 && hardenExitCode !== 0) {
        return hardenExitCode
      }
    }

    return scanExitCode
  }

  if (argv[0] === 'openclaw') {
    if (argv[1] === '--help' || argv[1] === '-h') {
      printUsage()
      return 0
    }

    if (argv.length > 1) {
      printUsage()
      return 1
    }

    return runOpenClawWizard()
  }

  if (argv[0] === 'setup') {
    if (argv[1] === '--help' || argv[1] === '-h') {
      printUsage()
      return 0
    }

    const parsed = parseSetupArgs(argv.slice(1))
    if (!parsed) {
      printUsage()
      return 1
    }

    return runSetupCommand(parsed)
  }

  if (argv[0] === 'guard') {
    if (argv[1] === '--help' || argv[1] === '-h') {
      printUsage()
      return 0
    }

    const parsed = parseGuardArgs(argv.slice(1))
    if (!parsed) {
      printUsage()
      return 1
    }

    return runGuardCommand(parsed)
  }

  if (argv[0] === 'harden') {
    const parsed = parseHardenArgs(argv.slice(1))
    if (!parsed) {
      printUsage()
      return 1
    }

    return runHarden(parsed)
  }

  if (argv[0] === 'mcp') {
    const parsed = parseMcpArgs(argv.slice(1))
    if (!parsed) {
      printUsage()
      return 1
    }

    return runMcpCommand(parsed)
  }

  if (argv[0] === 'quarantine') {
    const parsed = parseQuarantineArgs(argv.slice(1))
    if (!parsed) {
      printUsage()
      return 1
    }

    if (parsed.command === 'quarantine_list') {
      return runQuarantineList({ quarantineDir: parsed.quarantineDir })
    }

    return runQuarantineRestore({ id: parsed.id, quarantineDir: parsed.quarantineDir, force: parsed.force })
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
  sapper-ai scan --policy ./sapperai.config.yaml  Use explicit policy path (fatal if invalid)
  sapper-ai scan --fix        Quarantine blocked files
  sapper-ai scan --ai         Deep scan with AI analysis (OpenAI; prompts for key in a TTY)
  sapper-ai scan --no-color   Disable ANSI colors
  sapper-ai scan --no-prompt  Disable all prompts (CI-safe)
  sapper-ai scan --harden     After scan, offer to apply recommended hardening
  sapper-ai scan --no-open    Skip opening report in browser
  sapper-ai scan --no-save    Skip saving scan results to ~/.sapperai/scans/
  sapper-ai openclaw          OpenClaw skill security scanner
  sapper-ai harden            Plan recommended setup changes (no writes)
  sapper-ai harden --apply    Apply recommended project changes
  sapper-ai harden --include-system   Include system changes (home directory)
  sapper-ai setup             Register Claude Code hooks for Skill Guard
  sapper-ai setup --remove    Remove only sapper-ai Skill Guard hooks
  sapper-ai setup --status    Show current Skill Guard hook registration status
  sapper-ai guard scan        Run SessionStart guard scan hook
  sapper-ai guard check       Run UserPromptSubmit guard check hook
  sapper-ai guard dismiss <name>   Dismiss warning by skill name
  sapper-ai guard rescan      Clear guard cache, then scan again
  sapper-ai guard cache list  Show guard cache entries
  sapper-ai guard cache clear Clear guard cache entries
  sapper-ai mcp wrap-config   Wrap MCP servers to run behind sapperai-proxy (defaults to Claude Code config)
  sapper-ai mcp unwrap-config Undo MCP wrapping
  sapper-ai quarantine list   List quarantined files
  sapper-ai quarantine restore <id> [--force]  Restore quarantined file by id
  sapper-ai init          Interactive setup wizard
  sapper-ai --help        Show this help

Learn more: https://github.com/sapper-ai/sapperai
`)
}

function parseScanArgs(
  argv: string[]
): {
  targets: string[]
  policyPath?: string
  fix: boolean
  deep: boolean
  system: boolean
  ai: boolean
  noSave: boolean
  noOpen: boolean
  noColor: boolean
  noPrompt: boolean
  harden: boolean
} | null {
  const targets: string[] = []
  let policyPath: string | undefined
  let fix = false
  let deep = false
  let system = false
  let ai = false
  let noSave = false
  let noOpen = false
  let noColor = false
  let noPrompt = false
  let harden = false

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!
    const nextArg = argv[index + 1]

    if (arg === '--fix') {
      fix = true
      continue
    }

    if (arg === '--policy') {
      if (!nextArg || nextArg.startsWith('-')) {
        return null
      }
      policyPath = nextArg
      index += 1
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

    if (arg === '--no-color') {
      noColor = true
      continue
    }

    if (arg === '--no-prompt') {
      noPrompt = true
      continue
    }

    if (arg === '--harden') {
      harden = true
      continue
    }

    if (arg === '--no-open') {
      noOpen = true
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

  return { targets, policyPath, fix, deep, system, ai, noSave, noOpen, noColor, noPrompt, harden }
}

function parseHardenArgs(
  argv: string[]
): {
  apply?: boolean
  includeSystem?: boolean
  yes?: boolean
  noColor?: boolean
  noPrompt?: boolean
  force?: boolean
  workflowVersion?: string
  mcpVersion?: string
} | null {
  let apply = false
  let includeSystem = false
  let yes = false
  let noColor = false
  let noPrompt = false
  let force = false
  let workflowVersion: string | undefined
  let mcpVersion: string | undefined

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!
    const nextArg = argv[index + 1]

    if (arg === '--dry-run') {
      apply = false
      continue
    }

    if (arg === '--apply') {
      apply = true
      continue
    }

    if (arg === '--include-system') {
      includeSystem = true
      continue
    }

    if (arg === '--yes') {
      yes = true
      continue
    }

    if (arg === '--no-color') {
      noColor = true
      continue
    }

    if (arg === '--no-prompt') {
      noPrompt = true
      continue
    }

    if (arg === '--force') {
      force = true
      continue
    }

    if (arg === '--workflow-version') {
      if (!nextArg || nextArg.startsWith('-')) return null
      workflowVersion = nextArg
      index += 1
      continue
    }

    if (arg === '--mcp-version') {
      if (!nextArg || nextArg.startsWith('-')) return null
      mcpVersion = nextArg
      index += 1
      continue
    }

    return null
  }

  return {
    apply,
    includeSystem,
    yes,
    noColor,
    noPrompt,
    force,
    workflowVersion,
    mcpVersion,
  }
}

type SetupCommandArgs = { command: 'setup_register' } | { command: 'setup_remove' } | { command: 'setup_status' }

function parseSetupArgs(argv: string[]): SetupCommandArgs | null {
  if (argv.length === 0) {
    return { command: 'setup_register' }
  }

  if (argv.length > 1) {
    return null
  }

  if (argv[0] === '--remove') {
    return { command: 'setup_remove' }
  }

  if (argv[0] === '--status') {
    return { command: 'setup_status' }
  }

  return null
}

function printSetupStatus(): void {
  const status = getSetupStatus()

  console.log('Skill Guard setup status:')
  console.log(
    `  Claude directory: ${displayPath(status.claudeDirPath)} ${status.claudeDirExists ? '(found)' : '(missing)'}`
  )
  console.log(
    `  Settings file: ${displayPath(status.settingsPath)} ${status.settingsExists ? '(found)' : '(missing)'}`
  )

  for (const commandStatus of status.commands) {
    const state = commandStatus.registered ? 'registered' : 'not registered'
    console.log(`  ${commandStatus.event}: ${state} (${commandStatus.matchCount})`)
  }
}

async function runSetupCommand(args: SetupCommandArgs): Promise<number> {
  if (args.command === 'setup_status') {
    printSetupStatus()
    return 0
  }

  if (args.command === 'setup_register') {
    const result = registerHooks()
    if (!result.ok) {
      console.error(`Claude directory not found: ${displayPath(result.status.claudeDirPath)}`)
      return 1
    }

    if (result.action === 'already_registered') {
      console.log('Skill Guard hooks are already registered.')
      return 0
    }

    console.log(`Registered Skill Guard hooks in ${displayPath(result.status.settingsPath)}.`)
    return 0
  }

  const result = removeHooks()
  if (!result.ok) {
    console.error(`Claude directory not found: ${displayPath(result.status.claudeDirPath)}`)
    return 1
  }

  if (result.removedCount === 0) {
    console.log('No sapper-ai Skill Guard hooks were registered.')
    return 0
  }

  console.log(`Removed ${result.removedCount} sapper-ai Skill Guard hook(s).`)
  return 0
}

type GuardCommandArgs =
  | { command: 'guard_scan' }
  | { command: 'guard_check' }
  | { command: 'guard_dismiss'; name: string }
  | { command: 'guard_rescan' }
  | { command: 'guard_cache_list' }
  | { command: 'guard_cache_clear' }

function parseGuardArgs(argv: string[]): GuardCommandArgs | null {
  const subcommand = argv[0]
  if (!subcommand) {
    return null
  }

  if (subcommand === 'scan') {
    return argv.length === 1 ? { command: 'guard_scan' } : null
  }

  if (subcommand === 'check') {
    return argv.length === 1 ? { command: 'guard_check' } : null
  }

  if (subcommand === 'dismiss') {
    if (argv.length !== 2) return null
    const name = argv[1]?.trim()
    if (!name) return null
    return { command: 'guard_dismiss', name }
  }

  if (subcommand === 'rescan') {
    return argv.length === 1 ? { command: 'guard_rescan' } : null
  }

  if (subcommand === 'cache') {
    if (argv.length !== 2) return null
    if (argv[1] === 'list') return { command: 'guard_cache_list' }
    if (argv[1] === 'clear') return { command: 'guard_cache_clear' }
    return null
  }

  return null
}

type GenericGuardMethod = (...args: unknown[]) => unknown

function resolveNamedExport(
  moduleExports: Record<string, unknown>,
  names: readonly string[],
  label: string
): GenericGuardMethod {
  for (const name of names) {
    const candidate = moduleExports[name]
    if (typeof candidate === 'function') {
      return candidate as GenericGuardMethod
    }
  }

  throw new Error(`Missing export for ${label}`)
}

type GuardModuleLoader = (modulePath: string) => Promise<Record<string, unknown>>

const defaultGuardModuleLoader: GuardModuleLoader = async (modulePath) => {
  const fullModulePath = `./guard/${modulePath}`
  return (await import(fullModulePath)) as Record<string, unknown>
}

let guardModuleLoader: GuardModuleLoader = defaultGuardModuleLoader

export function __setGuardModuleLoaderForTests(loader: GuardModuleLoader | null): void {
  guardModuleLoader = loader ?? defaultGuardModuleLoader
}

async function loadGuardModule(modulePath: string): Promise<Record<string, unknown>> {
  if (modulePath.includes('..')) {
    throw new Error(`Invalid guard module path: ${modulePath}`)
  }
  return guardModuleLoader(modulePath)
}

function toExitCode(value: unknown): number {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value
  }

  if (isObject(value) && typeof value.exitCode === 'number' && Number.isInteger(value.exitCode)) {
    return value.exitCode
  }

  return 0
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function runGuardScanHook(): Promise<number> {
  const moduleExports = await loadGuardModule('hooks/guardScan')
  const hook = resolveNamedExport(moduleExports, ['guardScan', 'runGuardScan', 'default'], 'guard scan hook')
  const result = await hook()
  return toExitCode(result)
}

async function runGuardCheckHook(): Promise<number> {
  const moduleExports = await loadGuardModule('hooks/guardCheck')
  const hook = resolveNamedExport(moduleExports, ['guardCheck', 'runGuardCheck', 'default'], 'guard check hook')
  const result = await hook()
  return toExitCode(result)
}

async function createGuardClassInstance(modulePath: string, classNames: readonly string[]): Promise<Record<string, unknown>> {
  const moduleExports = await loadGuardModule(modulePath)
  const Constructor = resolveNamedExport(moduleExports, classNames, modulePath)
  const GuardConstructor = Constructor as unknown as new () => Record<string, unknown>
  return new GuardConstructor()
}

async function clearGuardCache(): Promise<void> {
  const scanCache = await createGuardClassInstance('ScanCache', ['ScanCache', 'default'])
  const clearMethod = scanCache.clear
  if (typeof clearMethod !== 'function') {
    throw new Error('ScanCache.clear() is not available')
  }
  await clearMethod.call(scanCache)
}

async function listGuardCacheEntries(): Promise<unknown[]> {
  const scanCache = await createGuardClassInstance('ScanCache', ['ScanCache', 'default'])
  const listMethod = scanCache.list
  if (typeof listMethod !== 'function') {
    throw new Error('ScanCache.list() is not available')
  }

  const listResult = await listMethod.call(scanCache)
  return Array.isArray(listResult) ? listResult : []
}

async function dismissGuardWarning(name: string): Promise<unknown> {
  const warningStore = await createGuardClassInstance('WarningStore', ['WarningStore', 'default'])
  const dismissMethod = warningStore.dismiss
  if (typeof dismissMethod !== 'function') {
    throw new Error('WarningStore.dismiss() is not available')
  }

  return dismissMethod.call(warningStore, name)
}

function printGuardCacheList(entries: unknown[]): void {
  if (entries.length === 0) {
    console.log('Guard cache is empty.')
    return
  }

  console.log('Guard cache entries:')
  for (const entry of entries) {
    if (!isObject(entry)) {
      console.log(`  - ${String(entry)}`)
      continue
    }

    const nestedEntry = isObject(entry.entry) ? entry.entry : undefined
    const pathValue =
      typeof entry.path === 'string'
        ? entry.path
        : nestedEntry && typeof nestedEntry.path === 'string'
          ? nestedEntry.path
          : undefined
    const skillName =
      typeof entry.skillName === 'string'
        ? entry.skillName
        : nestedEntry && typeof nestedEntry.skillName === 'string'
          ? nestedEntry.skillName
          : undefined
    const path = typeof pathValue === 'string' ? displayPath(pathValue) : undefined
    const hash = typeof entry.contentHash === 'string' ? entry.contentHash.slice(0, 12) : undefined
    const display = [skillName, path, hash].filter(Boolean).join(' | ')
    if (display.length > 0) {
      console.log(`  - ${display}`)
      continue
    }

    console.log(`  - ${JSON.stringify(entry)}`)
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function runGuardCommand(args: GuardCommandArgs): Promise<number> {
  try {
    if (args.command === 'guard_scan') {
      return runGuardScanHook()
    }

    if (args.command === 'guard_check') {
      return runGuardCheckHook()
    }

    if (args.command === 'guard_dismiss') {
      await dismissGuardWarning(args.name)
      console.log(`Dismissed warning for "${args.name}".`)
      return 0
    }

    if (args.command === 'guard_rescan') {
      await clearGuardCache()
      console.log('Guard cache cleared.')
      return runGuardScanHook()
    }

    if (args.command === 'guard_cache_list') {
      const entries = await listGuardCacheEntries()
      printGuardCacheList(entries)
      return 0
    }

    await clearGuardCache()
    console.log('Guard cache cleared.')
    return 0
  } catch (error) {
    console.error(`Guard command failed: ${toErrorMessage(error)}`)
    return 1
  }
}

type McpCommandArgs =
  | {
      command: 'mcp_wrap_config'
      configPath: string
      format: 'json' | 'jsonc'
      dryRun: boolean
      mcpVersion?: string
    }
  | {
      command: 'mcp_unwrap_config'
      configPath: string
      format: 'json' | 'jsonc'
      dryRun: boolean
    }

function parseMcpArgs(argv: string[]): McpCommandArgs | null {
  const subcommand = argv[0]
  const rest = argv.slice(1)
  if (!subcommand) return null

  const defaultConfigPath = join(homedir(), '.config', 'claude-code', 'config.json')

  let configPath = defaultConfigPath
  let format: 'json' | 'jsonc' = 'jsonc'
  let dryRun = false
  let mcpVersion: string | undefined

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index]!
    const nextArg = rest[index + 1]

    if (arg === '--config') {
      if (!nextArg || nextArg.startsWith('-')) return null
      configPath = nextArg
      format = 'json'
      index += 1
      continue
    }

    if (arg === '--jsonc') {
      format = 'jsonc'
      continue
    }

    if (arg === '--dry-run') {
      dryRun = true
      continue
    }

    if (arg === '--mcp-version') {
      if (!nextArg || nextArg.startsWith('-')) return null
      mcpVersion = nextArg
      index += 1
      continue
    }

    return null
  }

  if (subcommand === 'wrap-config') {
    return { command: 'mcp_wrap_config', configPath, format, dryRun, mcpVersion }
  }

  if (subcommand === 'unwrap-config') {
    return { command: 'mcp_unwrap_config', configPath, format, dryRun }
  }

  return null
}

async function runMcpCommand(args: McpCommandArgs): Promise<number> {
  if (args.command === 'mcp_unwrap_config') {
    const result = await unwrapMcpConfigFile({
      filePath: args.configPath,
      format: args.format,
      dryRun: args.dryRun,
    })

    if (!result.changed) {
      console.log('No changes needed.')
      return 0
    }

    if (result.restoredFromBackupPath) {
      if (args.dryRun) {
        console.log(`Config parse failed; would restore from backup: ${result.restoredFromBackupPath}`)
        return 0
      }

      console.log(`Config parse failed; restored from backup: ${result.restoredFromBackupPath}`)
      if (result.backupPath) console.log(`Backup: ${result.backupPath}`)
      return 0
    }

    if (args.dryRun) {
      console.log(`Would unwrap ${result.changedServers.length} server(s): ${result.changedServers.join(', ')}`)
      return 0
    }

    console.log(`Unwrapped ${result.changedServers.length} server(s): ${result.changedServers.join(', ')}`)
    if (result.backupPath) console.log(`Backup: ${result.backupPath}`)
    return 0
  }

  if (!checkNpxAvailable()) {
    console.error("npx is not available on PATH. Install Node.js/npm and retry.")
    return 1
  }

  const envVersion = process.env.SAPPERAI_MCP_VERSION?.trim()
  const installedVersion = resolveInstalledPackageVersion('@sapper-ai/mcp')
  const mcpVersion = (args.mcpVersion ?? envVersion ?? installedVersion ?? '').trim()
  if (!mcpVersion) {
    console.error("Missing MCP version. Provide '--mcp-version <semver>' or install @sapper-ai/mcp.")
    return 1
  }

  const result = await wrapMcpConfigFile({
    filePath: args.configPath,
    mcpVersion,
    format: args.format,
    dryRun: args.dryRun,
  })

  if (!result.changed) {
    console.log('No changes needed.')
    return 0
  }

  if (args.dryRun) {
    console.log(`Would wrap ${result.changedServers.length} server(s): ${result.changedServers.join(', ')}`)
    return 0
  }

  console.log(`Wrapped ${result.changedServers.length} server(s): ${result.changedServers.join(', ')}`)
  if (result.backupPath) console.log(`Backup: ${result.backupPath}`)
  return 0
}

type QuarantineCommandArgs =
  | { command: 'quarantine_list'; quarantineDir?: string }
  | { command: 'quarantine_restore'; quarantineDir?: string; id: string; force: boolean }

function parseQuarantineArgs(argv: string[]): QuarantineCommandArgs | null {
  const subcommand = argv[0]
  const rest = argv.slice(1)
  if (!subcommand) return null

  let quarantineDir: string | undefined
  let force = false

  if (subcommand === 'list') {
    for (let index = 0; index < rest.length; index += 1) {
      const arg = rest[index]!
      const nextArg = rest[index + 1]

      if (arg === '--quarantine-dir') {
        if (!nextArg || nextArg.startsWith('-')) return null
        quarantineDir = nextArg
        index += 1
        continue
      }

      return null
    }

    return { command: 'quarantine_list', quarantineDir }
  }

  if (subcommand === 'restore') {
    const id = rest[0]
    if (!id) return null
    const tail = rest.slice(1)

    for (let index = 0; index < tail.length; index += 1) {
      const arg = tail[index]!
      const nextArg = tail[index + 1]

      if (arg === '--force') {
        force = true
        continue
      }

      if (arg === '--quarantine-dir') {
        if (!nextArg || nextArg.startsWith('-')) return null
        quarantineDir = nextArg
        index += 1
        continue
      }

      return null
    }

    return { command: 'quarantine_restore', id, quarantineDir, force }
  }

  return null
}

function displayPath(path: string): string {
  const home = homedir()
  if (path === home) return '~'
  return path.startsWith(home + '/') ? `~/${path.slice(home.length + 1)}` : path
}

type OpenClawMenuAction = 'scan_static_dynamic' | 'scan_static_only' | 'harden'

function defaultOpenClawAction(dockerAvailable: boolean): OpenClawMenuAction {
  return dockerAvailable ? 'scan_static_dynamic' : 'scan_static_only'
}

function isOpenClawPromptEnabled(): boolean {
  return process.stdout.isTTY === true && process.stdin.isTTY === true && isCiEnv(process.env) !== true
}

async function promptOpenClawAction(dockerAvailable: boolean): Promise<OpenClawMenuAction> {
  if (!isOpenClawPromptEnabled()) {
    return defaultOpenClawAction(dockerAvailable)
  }

  const choices: Array<{ name: string; value: OpenClawMenuAction }> = []

  if (dockerAvailable) {
    choices.push({
      name: 'Scan all skills (static + dynamic analysis)',
      value: 'scan_static_dynamic',
    })
  }

  choices.push({
    name: 'Scan all skills (static only)',
    value: 'scan_static_only',
  })
  choices.push({
    name: 'Harden configuration',
    value: 'harden',
  })

  return select({
    message: 'What would you like to do?',
    choices,
    default: defaultOpenClawAction(dockerAvailable),
  })
}

function createOpenClawProgressHandler(): (event: OpenClawScanProgressEvent) => void {
  if (process.stdout.isTTY !== true) {
    return () => {}
  }

  let previousPhase: OpenClawScanProgressEvent['phase'] | null = null

  return (event: OpenClawScanProgressEvent): void => {
    const label = event.phase === 'static' ? '  Phase 1 - Static analysis' : '  Phase 2 - Dynamic analysis'

    if (previousPhase !== null && previousPhase !== event.phase) {
      process.stdout.write('\n')
    }

    previousPhase = event.phase
    process.stdout.write(`\r${label}: ${event.completed}/${event.total}`)

    if (event.completed >= event.total) {
      process.stdout.write('\n')
    }
  }
}

async function runOpenClawWizard(): Promise<number> {
  console.log('\n  Detecting your environment...\n')

  const environment = await detectOpenClawEnvironment({ cwd: process.cwd() })

  console.log('  Found:')
  if (environment.installed) {
    const versionSuffix = environment.version ? ` (v${environment.version})` : ''
    console.log(`    OpenClaw Gateway${versionSuffix}`)
  } else {
    console.log('    OpenClaw Gateway: not detected')
  }

  if (environment.skillsPaths.length === 0) {
    console.log('    Skills directory: not detected')
  } else {
    console.log(`    Skills directories: ${environment.skillsPaths.length}`)
    for (const skillPath of environment.skillsPaths) {
      console.log(`      - ${displayPath(skillPath)}`)
    }
  }

  console.log(`    Skills discovered: ${environment.skillCount}`)
  if (environment.dockerAvailable) {
    const composeStatus = environment.dockerComposeAvailable ? 'yes' : 'no'
    console.log(`    Docker: available (compose: ${composeStatus})`)
  } else {
    console.log('    Docker: not available')
  }
  console.log()

  if (!environment.installed && environment.skillsPaths.length === 0) {
    console.log('  OpenClaw not detected. Add skills under ~/.openclaw/skills or ./skills and rerun.\n')
    return 1
  }

  const action = await promptOpenClawAction(environment.dockerAvailable)
  if (action === 'harden') {
    return runHarden({
      apply: true,
      includeSystem: true,
    })
  }

  if (environment.skillCount === 0) {
    console.log('  No skill markdown files found in detected paths.\n')
    return 0
  }

  const dynamicRequested = action === 'scan_static_dynamic' && environment.dockerAvailable
  const policy = resolveOpenClawPolicy({ cwd: process.cwd() })

  const scanResult = await scanSkills(environment.skillsPaths, policy, {
    dynamicAnalysis: dynamicRequested,
    quarantineOnRisk: true,
    quarantineDir: process.env.SAPPERAI_QUARANTINE_DIR ?? join(homedir(), '.openclaw', 'quarantine'),
    onProgress: createOpenClawProgressHandler(),
  })

  const safeCount = scanResult.results.filter((entry) => entry.decision === 'safe').length
  const suspiciousCount = scanResult.results.filter((entry) => entry.decision === 'suspicious').length
  const quarantinedCount = scanResult.results.filter((entry) => entry.decision === 'quarantined').length

  console.log('\n  Results:')
  console.log(`    ${safeCount} skills safe`)
  console.log(`    ${suspiciousCount} skills suspicious`)
  console.log(`    ${quarantinedCount} skills quarantined`)

  if (dynamicRequested && scanResult.dynamicStatus === 'skipped_unconfigured') {
    console.log('\n  Dynamic analysis requested but no dynamic analyzer is configured yet.')
    console.log('  Static analysis results are shown.\n')
  }

  if (dynamicRequested && scanResult.dynamicStatus === 'skipped_unavailable') {
    console.log('\n  Dynamic analysis requested but the dynamic analyzer is unavailable in this environment.')
    console.log('  Static analysis results are shown.\n')
  }

  if (quarantinedCount > 0) {
    console.log('\n  Quarantined skills:')
    const quarantined = scanResult.results.filter((entry) => entry.decision === 'quarantined')
    for (const entry of quarantined) {
      const reasons = entry.dynamicResult?.findings?.length
        ? entry.dynamicResult.findings.map((finding) => `${finding.honeytoken.envVar} -> ${finding.destination}`)
        : entry.staticResult?.reasons ?? []
      const reasonText = reasons.length > 0 ? reasons[0] : 'High-risk behavior detected'
      console.log(`    - ${entry.skillName} (${displayPath(entry.skillPath)}): ${reasonText}`)
    }
  }

  if (suspiciousCount > 0) {
    console.log('\n  Suspicious skills require manual review.\n')
  } else {
    console.log('\n  Scan complete.\n')
  }

  return quarantinedCount > 0 || suspiciousCount > 0 ? 1 : 0
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
        name: 'Deep scan (rules + AI)       AI-powered analysis (OpenAI)',
        value: true as const,
      },
    ],
    default: false,
  })
  return answer
}

async function resolveScanOptions(args: {
  targets: string[]
  policyPath?: string
  fix: boolean
  deep: boolean
  system: boolean
  ai: boolean
  noSave: boolean
  noOpen: boolean
  noColor: boolean
  noPrompt: boolean
  harden: boolean
}): Promise<ScanOptions | null> {
  const cwd = process.cwd()

  const common = {
    fix: args.fix,
    noSave: args.noSave,
    noOpen: args.noOpen,
    noColor: args.noColor,
    noPrompt: args.noPrompt,
    policyPath: args.policyPath,
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

  if (args.noPrompt === true || process.stdout.isTTY !== true) {
    return { ...common, targets: [cwd], deep: true, ai: args.ai, scopeLabel: 'Current + subdirectories' }
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
  ]

  const body = renderPolicyYaml(selectedPreset, auditLogPath)
  writeFileSync(outputPath, `${lines.join('\n')}\n${body}`, 'utf8')

  console.log(`\n  Created ${outputPath}\n`)
  console.log('  Quick start:\n')
  console.log("    import { createGuard } from 'sapper-ai'")
  console.log('    const guard = createGuard()')
  console.log('    const decision = await guard.check(toolCall)')
  console.log()

  rl.close()
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
