#!/usr/bin/env node

import { AuditLogger, PolicyManager } from '@sapperai/core'
import type { Policy } from '@sapperai/types'

import { StdioSecurityProxy } from './StdioSecurityProxy'

interface CliArgs {
  policyPath?: string
  upstreamCommand: string
  upstreamArgs: string[]
}

const DEFAULT_POLICY: Policy = {
  mode: 'enforce',
  defaultAction: 'allow',
  failOpen: true,
}

export function parseCliArgs(argv: string[], env: NodeJS.ProcessEnv = process.env): CliArgs {
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
    policyPath,
    upstreamCommand: upstream[0] as string,
    upstreamArgs: upstream.slice(1),
  }
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
