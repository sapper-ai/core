import { AuditLogger } from '@sapper-ai/core'
import type { Policy } from '@sapper-ai/types'

import { FileWatcher } from '../services/FileWatcher'

interface WatchCommandOptions {
  policy: Policy
  watchPaths?: string[]
  env?: NodeJS.ProcessEnv
}

export async function runWatchCommand(options: WatchCommandOptions): Promise<void> {
  const env = options.env ?? process.env
  const auditLogger = new AuditLogger({ filePath: env.SAPPERAI_AUDIT_LOG_PATH ?? '/tmp/sapperai-proxy.audit.log' })

  const watcher = new FileWatcher({
    policy: options.policy,
    auditLogger,
    watchPaths: options.watchPaths,
  })

  const closeWatcher = async () => {
    await watcher.close()
    process.exit(0)
  }

  process.once('SIGINT', () => {
    void closeWatcher()
  })

  process.once('SIGTERM', () => {
    void closeWatcher()
  })

  await watcher.start()
}
