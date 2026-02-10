import { describe, expect, it } from 'vitest'

import {
  buildEntryName,
  classifyTargetType,
  collectMcpTargetsFromJson,
  isConfigLikeFile,
  normalizeSurfaceText,
} from '../../discovery/DiscoveryUtils'

describe('DiscoveryUtils', () => {
  it('recognizes configuration-like files', () => {
    expect(isConfigLikeFile('/tmp/skill.md')).toBe(true)
    expect(isConfigLikeFile('/tmp/.mcp.json')).toBe(true)
    expect(isConfigLikeFile('/tmp/random.txt')).toBe(false)
  })

  it('classifies target types from path', () => {
    expect(classifyTargetType('/Users/test/.claude/plugins/example/skill.md')).toBe('skill')
    expect(classifyTargetType('/Users/test/.claude/agents/agents.md')).toBe('agent')
    expect(classifyTargetType('/Users/test/.config/mcp/settings.mcp.json')).toBe('mcp_server')
    expect(classifyTargetType('/Users/test/project/config.json')).toBe('config')
  })

  it('normalizes long text and redacts secrets', () => {
    const source = `token=sk-1234567890abcdef and apiKey=secret-value ${'a'.repeat(5000)}`
    const normalized = normalizeSurfaceText(source)

    expect(normalized).toContain('***REDACTED***')
    expect(normalized.length).toBeLessThanOrEqual(4003)
  })

  it('collects mcp targets from json config', () => {
    const targets = collectMcpTargetsFromJson('/tmp/.mcp.json', {
      mcpServers: {
        filesystem: {
          command: 'npx',
          args: ['@modelcontextprotocol/server-filesystem'],
        },
      },
    })

    expect(targets).toHaveLength(1)
    expect(targets[0]).toMatchObject({
      type: 'mcp_server',
      name: 'filesystem',
      source: '/tmp/.mcp.json',
    })
  })

  it('builds compact entry names', () => {
    expect(buildEntryName('/a/b/c/skill.md')).toBe('c/skill.md')
  })
})
