// MCP integration for SapperAI
import { coreVersion } from '@sapper-ai/core'

export const mcpVersion = coreVersion

export { StdioSecurityProxy } from './StdioSecurityProxy'
export { FileWatcher } from './services/FileWatcher'
export { AdversaryCampaignRunner } from './services/AdversaryCampaignRunner'
export { parseCliArgs, resolvePolicy, runCli } from './cli'
export { runWatchCommand } from './commands/watch'
export { runQuarantineListCommand, runQuarantineRestoreCommand } from './commands/quarantine'
export {
  runBlocklistCheckCommand,
  runBlocklistListCommand,
  runBlocklistStatusCommand,
  runBlocklistSyncCommand,
} from './commands/blocklist'
export { runAdversaryReplayCommand, runAdversaryRunCommand } from './commands/adversary'
