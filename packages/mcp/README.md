# @sapper-ai/mcp

Model Context Protocol (MCP) security proxy for SapperAI. Wraps any MCP server with real-time threat detection.

## Installation

```bash
pnpm add @sapper-ai/mcp
```

## Quick Start

### CLI Usage

```bash
# Run security proxy in front of any MCP server
sapperai-proxy -- npx @modelcontextprotocol/server-example

# With custom policy
sapperai-proxy --policy ./policy.yaml -- npx mcp-server

# Watch local skill/plugin/config files and auto-quarantine blocked content
sapperai-proxy watch

# Override watched paths (repeatable)
sapperai-proxy watch --path ~/.claude/plugins --path ~/.config/claude-code

# List quarantined files
sapperai-proxy quarantine list

# Restore quarantined file
sapperai-proxy quarantine restore <id>
```

### Programmatic Usage

```typescript
import { StdioSecurityProxy } from '@sapper-ai/mcp'
import { RulesDetector, DecisionEngine } from '@sapper-ai/core'
import type { Policy } from '@sapper-ai/types'

const policy: Policy = {
  mode: 'enforce',
  defaultAction: 'allow',
  failOpen: true,
}

const detector = new RulesDetector()
const engine = new DecisionEngine([detector])

const proxy = new StdioSecurityProxy({
  policy,
  upstreamCommand: 'npx',
  upstreamArgs: ['@modelcontextprotocol/server-example'],
})

await proxy.start()
```

### Watch + Quarantine Behavior

- `watch` monitors `~/.claude/plugins`, `~/.config/claude-code`, and current working directory by default.
- On file add/change, SapperAI scans text/config surfaces via install-scan pipeline.
- If decision is `block` and policy mode is `enforce`, file is moved to `~/.sapperai/quarantine`.
- Quarantine records are stored in `~/.sapperai/quarantine/index.json`.

## Policy Configuration

Create `policy.yaml`:

```yaml
mode: enforce
defaultAction: allow
failOpen: true

toolOverrides:
  executeCommand:
    mode: enforce
    detectors: [rules]
    thresholds:
      blockMinConfidence: 0.8
```

## API Summary

- **`StdioSecurityProxy`** - Transparent MCP proxy with security scanning
- **`FileWatcher`** - Real-time file monitor for skill/plugin/config scanning
- **`runCli()`** - CLI entrypoint for standalone proxy
- **`parseCliArgs(argv)`** - CLI argument parser
- **`resolvePolicy(path)`** - Load policy from YAML/JSON file
- **`runWatchCommand()`** - Starts watch mode
- **`runQuarantineListCommand()`** - Prints quarantine records
- **`runQuarantineRestoreCommand()`** - Restores one quarantine record by id

## License

MIT
