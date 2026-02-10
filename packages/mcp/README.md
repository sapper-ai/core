# @sapperai/mcp

Model Context Protocol (MCP) security proxy for SapperAI. Wraps any MCP server with real-time threat detection.

## Installation

```bash
pnpm add @sapperai/mcp
```

## Quick Start

### CLI Usage

```bash
# Run security proxy in front of any MCP server
sapperai-proxy --target npx @modelcontextprotocol/server-example

# With custom policy
sapperai-proxy --target "npx mcp-server" --policy ./policy.yaml
```

### Programmatic Usage

```typescript
import { StdioSecurityProxy } from '@sapperai/mcp'
import { RulesDetector, DecisionEngine } from '@sapperai/core'
import type { Policy } from '@sapperai/types'

const policy: Policy = {
  mode: 'enforce',
  defaultAction: 'allow',
  failOpen: true,
}

const detector = new RulesDetector()
const engine = new DecisionEngine([detector])

const proxy = new StdioSecurityProxy(
  'npx @modelcontextprotocol/server-example',
  engine,
  policy
)

await proxy.start()
```

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
- **`runCli()`** - CLI entrypoint for standalone proxy
- **`parseCliArgs(argv)`** - CLI argument parser
- **`resolvePolicy(path)`** - Load policy from YAML/JSON file

## License

MIT
