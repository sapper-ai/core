#!/usr/bin/env node

import { AuditLogger, PolicyManager } from '@sapper-ai/core'
import type { Policy } from '@sapper-ai/types'

import {
  runBlocklistCheckCommand,
  runBlocklistListCommand,
  runBlocklistStatusCommand,
  runBlocklistSyncCommand,
} from './commands/blocklist'
import { runQuarantineListCommand, runQuarantineRestoreCommand } from './commands/quarantine'
import { runAdversaryReplayCommand, runAdversaryRunCommand } from './commands/adversary'
import { runWatchCommand } from './commands/watch'
import { StdioSecurityProxy } from './StdioSecurityProxy'

interface ProxyCliArgs {
  command: 'proxy'
  policyPath?: string
  upstreamCommand: string
  upstreamArgs: string[]
}

interface WatchCliArgs {
  command: 'watch'
  policyPath?: string
  watchPaths?: string[]
}

interface QuarantineListCliArgs {
  command: 'quarantine_list'
  quarantineDir?: string
}

interface QuarantineRestoreCliArgs {
  command: 'quarantine_restore'
  quarantineDir?: string
  id: string
}

interface BlocklistSyncCliArgs {
  command: 'blocklist_sync'
  policyPath?: string
  sources?: string[]
  cachePath?: string
}

interface BlocklistStatusCliArgs {
  command: 'blocklist_status'
  cachePath?: string
}

interface BlocklistListCliArgs {
  command: 'blocklist_list'
  cachePath?: string
}

interface BlocklistCheckCliArgs {
  command: 'blocklist_check'
  indicator: string
  cachePath?: string
}

interface AdversaryRunCliArgs {
  command: 'adversary_run'
  policyPath?: string
  outDir: string
  agentConfigPath?: string
  maxCases?: number
  maxDurationMs?: number
  seed?: string
}

interface AdversaryReplayCliArgs {
  command: 'adversary_replay'
  policyPath?: string
  reproPath: string
}

type CliArgs =
  | ProxyCliArgs
  | WatchCliArgs
  | QuarantineListCliArgs
  | QuarantineRestoreCliArgs
  | BlocklistSyncCliArgs
  | BlocklistStatusCliArgs
  | BlocklistListCliArgs
  | BlocklistCheckCliArgs
  | AdversaryRunCliArgs
  | AdversaryReplayCliArgs

const DEFAULT_POLICY: Policy = {
  mode: 'enforce',
  defaultAction: 'allow',
  failOpen: true,
}

export function parseCliArgs(argv: string[], env: NodeJS.ProcessEnv = process.env): CliArgs {
  if (argv[0] === 'watch') {
    const watchArgs = argv.slice(1)
    return parseWatchArgs(watchArgs, env)
  }

  if (argv[0] === 'quarantine') {
    const quarantineArgs = argv.slice(1)
    return parseQuarantineArgs(quarantineArgs, env)
  }

  if (argv[0] === 'blocklist') {
    const blocklistArgs = argv.slice(1)
    return parseBlocklistArgs(blocklistArgs, env)
  }

  if (argv[0] === 'adversary') {
    const adversaryArgs = argv.slice(1)
    return parseAdversaryArgs(adversaryArgs, env)
  }

  return parseProxyArgs(argv, env)
}

function parseProxyArgs(argv: string[], env: NodeJS.ProcessEnv): ProxyCliArgs {
  const separatorIndex = argv.indexOf('--')

  const preSeparatorArgs = separatorIndex >= 0 ? argv.slice(0, separatorIndex) : argv
  const postSeparatorArgs = separatorIndex >= 0 ? argv.slice(separatorIndex + 1) : []

  let policyPath = env.SAPPERAI_POLICY_PATH
  for (let index = 0; index < preSeparatorArgs.length; index += 1) {
    const arg = preSeparatorArgs[index]

    if (arg === '--policy') {
      const nextArg = preSeparatorArgs[index + 1]
      if (!nextArg) {
        throw new Error('Missing value for --policy')
      }

      policyPath = nextArg
      index += 1
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  const upstreamFromCli = postSeparatorArgs
  const upstreamFromEnv = (env.SAPPERAI_PROXY_UPSTREAM ?? '')
    .trim()
    .split(/\s+/)
    .filter((value) => value.length > 0)

  const upstream = upstreamFromCli.length > 0 ? upstreamFromCli : upstreamFromEnv
  if (upstream.length === 0) {
    throw new Error('Missing upstream command. Expected: sapperai-proxy [--policy <path>] -- <command> [args...]')
  }

  return {
    command: 'proxy',
    policyPath,
    upstreamCommand: upstream[0] as string,
    upstreamArgs: upstream.slice(1),
  }
}

function parseWatchArgs(argv: string[], env: NodeJS.ProcessEnv): WatchCliArgs {
  let policyPath = env.SAPPERAI_POLICY_PATH
  const watchPaths: string[] = []

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--policy') {
      const nextArg = argv[index + 1]
      if (!nextArg) {
        throw new Error('Missing value for --policy')
      }

      policyPath = nextArg
      index += 1
      continue
    }

    if (arg === '--path') {
      const nextArg = argv[index + 1]
      if (!nextArg) {
        throw new Error('Missing value for --path')
      }

      watchPaths.push(nextArg)
      index += 1
      continue
    }

    throw new Error(`Unknown argument for watch: ${arg}`)
  }

  return {
    command: 'watch',
    policyPath,
    watchPaths: watchPaths.length > 0 ? watchPaths : undefined,
  }
}

function parseQuarantineArgs(argv: string[], env: NodeJS.ProcessEnv): QuarantineListCliArgs | QuarantineRestoreCliArgs {
  const subcommand = argv[0]
  const rest = argv.slice(1)

  if (!subcommand) {
    throw new Error('Missing quarantine subcommand. Expected: quarantine list|restore')
  }

  let quarantineDir = env.SAPPERAI_QUARANTINE_DIR

  if (subcommand === 'list') {
    for (let index = 0; index < rest.length; index += 1) {
      const arg = rest[index]
      if (arg === '--quarantine-dir') {
        const nextArg = rest[index + 1]
        if (!nextArg) {
          throw new Error('Missing value for --quarantine-dir')
        }

        quarantineDir = nextArg
        index += 1
        continue
      }

      throw new Error(`Unknown argument for quarantine list: ${arg}`)
    }

    return {
      command: 'quarantine_list',
      quarantineDir,
    }
  }

  if (subcommand === 'restore') {
    let id: string | undefined

    for (let index = 0; index < rest.length; index += 1) {
      const arg = rest[index]
      if (arg === '--quarantine-dir') {
        const nextArg = rest[index + 1]
        if (!nextArg) {
          throw new Error('Missing value for --quarantine-dir')
        }

        quarantineDir = nextArg
        index += 1
        continue
      }

      if (arg === '--id') {
        const nextArg = rest[index + 1]
        if (!nextArg) {
          throw new Error('Missing value for --id')
        }

        id = nextArg
        index += 1
        continue
      }

      if (!arg.startsWith('-') && !id) {
        id = arg
        continue
      }

      throw new Error(`Unknown argument for quarantine restore: ${arg}`)
    }

    if (!id) {
      throw new Error('Missing quarantine id. Expected: quarantine restore <id> or --id <id>')
    }

    return {
      command: 'quarantine_restore',
      quarantineDir,
      id,
    }
  }

  throw new Error(`Unknown quarantine subcommand: ${subcommand}`)
}

function parseBlocklistArgs(
  argv: string[],
  env: NodeJS.ProcessEnv
): BlocklistSyncCliArgs | BlocklistStatusCliArgs | BlocklistListCliArgs | BlocklistCheckCliArgs {
  const subcommand = argv[0]
  const rest = argv.slice(1)

  if (!subcommand) {
    throw new Error('Missing blocklist subcommand. Expected: blocklist sync|status|list|check')
  }

  let cachePath = env.SAPPERAI_THREAT_FEED_CACHE
  let policyPath = env.SAPPERAI_POLICY_PATH
  const sources: string[] = []

  if (subcommand === 'sync') {
    for (let index = 0; index < rest.length; index += 1) {
      const arg = rest[index]
      if (arg === '--policy') {
        const nextArg = rest[index + 1]
        if (!nextArg) {
          throw new Error('Missing value for --policy')
        }

        policyPath = nextArg
        index += 1
        continue
      }

      if (arg === '--source') {
        const nextArg = rest[index + 1]
        if (!nextArg) {
          throw new Error('Missing value for --source')
        }

        sources.push(nextArg)
        index += 1
        continue
      }

      if (arg === '--cache-path') {
        const nextArg = rest[index + 1]
        if (!nextArg) {
          throw new Error('Missing value for --cache-path')
        }

        cachePath = nextArg
        index += 1
        continue
      }

      throw new Error(`Unknown argument for blocklist sync: ${arg}`)
    }

    return {
      command: 'blocklist_sync',
      policyPath,
      sources: sources.length > 0 ? sources : undefined,
      cachePath,
    }
  }

  if (subcommand === 'status' || subcommand === 'list') {
    for (let index = 0; index < rest.length; index += 1) {
      const arg = rest[index]
      if (arg === '--cache-path') {
        const nextArg = rest[index + 1]
        if (!nextArg) {
          throw new Error('Missing value for --cache-path')
        }

        cachePath = nextArg
        index += 1
        continue
      }

      throw new Error(`Unknown argument for blocklist ${subcommand}: ${arg}`)
    }

    if (subcommand === 'status') {
      return {
        command: 'blocklist_status',
        cachePath,
      }
    }

    return {
      command: 'blocklist_list',
      cachePath,
    }
  }

  if (subcommand === 'check') {
    let indicator: string | undefined

    for (let index = 0; index < rest.length; index += 1) {
      const arg = rest[index]
      if (arg === '--cache-path') {
        const nextArg = rest[index + 1]
        if (!nextArg) {
          throw new Error('Missing value for --cache-path')
        }

        cachePath = nextArg
        index += 1
        continue
      }

      if (!arg.startsWith('-') && !indicator) {
        indicator = arg
        continue
      }

      throw new Error(`Unknown argument for blocklist check: ${arg}`)
    }

    if (!indicator) {
      throw new Error('Missing indicator. Expected: blocklist check <indicator>')
    }

    return {
      command: 'blocklist_check',
      indicator,
      cachePath,
    }
  }

  throw new Error(`Unknown blocklist subcommand: ${subcommand}`)
}

function parseAdversaryArgs(argv: string[], env: NodeJS.ProcessEnv): AdversaryRunCliArgs | AdversaryReplayCliArgs {
  const subcommand = argv[0]
  const rest = argv.slice(1)
  if (!subcommand) {
    throw new Error('Missing adversary subcommand. Expected: adversary run|replay')
  }

  if (subcommand === 'run') {
    let policyPath = env.SAPPERAI_POLICY_PATH
    let outDir: string | undefined
    let agentConfigPath: string | undefined
    let maxCases: number | undefined
    let maxDurationMs: number | undefined
    let seed: string | undefined

    for (let index = 0; index < rest.length; index += 1) {
      const arg = rest[index]
      const nextArg = rest[index + 1]

      if (arg === '--policy') {
        if (!nextArg) throw new Error('Missing value for --policy')
        policyPath = nextArg
        index += 1
        continue
      }

      if (arg === '--out') {
        if (!nextArg) throw new Error('Missing value for --out')
        outDir = nextArg
        index += 1
        continue
      }

      if (arg === '--agent') {
        if (!nextArg) throw new Error('Missing value for --agent')
        agentConfigPath = nextArg
        index += 1
        continue
      }

      if (arg === '--max-cases') {
        if (!nextArg) throw new Error('Missing value for --max-cases')
        maxCases = Number.parseInt(nextArg, 10)
        index += 1
        continue
      }

      if (arg === '--max-duration-ms') {
        if (!nextArg) throw new Error('Missing value for --max-duration-ms')
        maxDurationMs = Number.parseInt(nextArg, 10)
        index += 1
        continue
      }

      if (arg === '--seed') {
        if (!nextArg) throw new Error('Missing value for --seed')
        seed = nextArg
        index += 1
        continue
      }

      throw new Error(`Unknown argument for adversary run: ${arg}`)
    }

    if (!outDir) {
      throw new Error('Missing output directory. Expected: adversary run --out <directory>')
    }

    return {
      command: 'adversary_run',
      policyPath,
      outDir,
      agentConfigPath,
      maxCases,
      maxDurationMs,
      seed,
    }
  }

  if (subcommand === 'replay') {
    let policyPath = env.SAPPERAI_POLICY_PATH
    let reproPath: string | undefined

    for (let index = 0; index < rest.length; index += 1) {
      const arg = rest[index]
      const nextArg = rest[index + 1]

      if (arg === '--policy') {
        if (!nextArg) throw new Error('Missing value for --policy')
        policyPath = nextArg
        index += 1
        continue
      }

      if (arg === '--repro') {
        if (!nextArg) throw new Error('Missing value for --repro')
        reproPath = nextArg
        index += 1
        continue
      }

      throw new Error(`Unknown argument for adversary replay: ${arg}`)
    }

    if (!reproPath) {
      throw new Error('Missing repro path. Expected: adversary replay --repro <file>')
    }

    return {
      command: 'adversary_replay',
      policyPath,
      reproPath,
    }
  }

  throw new Error(`Unknown adversary subcommand: ${subcommand}`)
}

export function resolvePolicy(policyPath: string | undefined, env: NodeJS.ProcessEnv = process.env): Policy {
  const manager = new PolicyManager()

  if (policyPath) {
    return manager.loadFromFile(policyPath)
  }

  const mode = env.SAPPERAI_POLICY_MODE === 'monitor' ? 'monitor' : DEFAULT_POLICY.mode
  const defaultAction = env.SAPPERAI_DEFAULT_ACTION === 'block' ? 'block' : DEFAULT_POLICY.defaultAction
  const failOpen = parseBoolean(env.SAPPERAI_FAIL_OPEN, DEFAULT_POLICY.failOpen)

  return {
    mode,
    defaultAction,
    failOpen,
  }
}

export async function runCli(argv: string[] = process.argv.slice(2), env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const args = parseCliArgs(argv, env)

  if (args.command === 'blocklist_sync') {
    const policy = resolvePolicy(args.policyPath, env)
    await runBlocklistSyncCommand({
      policy,
      sources: args.sources,
      cachePath: args.cachePath,
    })
    return
  }

  if (args.command === 'blocklist_status') {
    await runBlocklistStatusCommand({ cachePath: args.cachePath })
    return
  }

  if (args.command === 'blocklist_list') {
    await runBlocklistListCommand({ cachePath: args.cachePath })
    return
  }

  if (args.command === 'blocklist_check') {
    await runBlocklistCheckCommand({
      indicator: args.indicator,
      cachePath: args.cachePath,
    })
    return
  }

  if (args.command === 'adversary_run') {
    const policy = resolvePolicy(args.policyPath, env)
    await runAdversaryRunCommand({
      policy,
      outDir: args.outDir,
      agentConfigPath: args.agentConfigPath,
      maxCases: args.maxCases,
      maxDurationMs: args.maxDurationMs,
      seed: args.seed,
    })
    return
  }

  if (args.command === 'adversary_replay') {
    const policy = resolvePolicy(args.policyPath, env)
    await runAdversaryReplayCommand({
      policy,
      reproPath: args.reproPath,
    })
    return
  }

  if (args.command === 'quarantine_list') {
    await runQuarantineListCommand({ quarantineDir: args.quarantineDir })
    return
  }

  if (args.command === 'quarantine_restore') {
    await runQuarantineRestoreCommand({
      id: args.id,
      quarantineDir: args.quarantineDir,
    })
    return
  }

  if (args.command === 'watch') {
    const policy = resolvePolicy(args.policyPath, env)
    await runWatchCommand({
      policy,
      watchPaths: args.watchPaths,
      env,
    })
    return
  }

  const policy = resolvePolicy(args.policyPath, env)
  const auditLogger = new AuditLogger({ filePath: env.SAPPERAI_AUDIT_LOG_PATH ?? '/tmp/sapperai-proxy.audit.log' })

  const proxy = new StdioSecurityProxy({
    policy,
    upstreamCommand: args.upstreamCommand,
    upstreamArgs: args.upstreamArgs,
    auditLogger,
  })

  const closeProxy = async () => {
    await proxy.close()
    process.exit(0)
  }

  process.once('SIGINT', () => {
    void closeProxy()
  })
  process.once('SIGTERM', () => {
    void closeProxy()
  })

  await proxy.start()
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback
  }

  const normalized = value.trim().toLowerCase()
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true
  }

  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false
  }

  return fallback
}

function isDirectExecution(argv: string[]): boolean {
  const entry = argv[1]
  if (!entry) {
    return false
  }

  return entry.endsWith('/cli.js') || entry.endsWith('\\cli.js') || entry.endsWith('/cli.ts')
}

if (isDirectExecution(process.argv)) {
  runCli().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    process.exit(1)
  })
}
