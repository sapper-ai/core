// MCP integration for SapperAI
import { coreVersion } from '@sapperai/core'

export const mcpVersion = coreVersion

export { StdioSecurityProxy } from './StdioSecurityProxy'
export { parseCliArgs, resolvePolicy, runCli } from './cli'
