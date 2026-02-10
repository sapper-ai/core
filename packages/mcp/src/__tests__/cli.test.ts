import { describe, expect, it } from 'vitest'

import { parseCliArgs } from '../cli'

describe('parseCliArgs', () => {
  it('parses watch subcommand arguments', () => {
    const args = parseCliArgs(['watch', '--policy', '/tmp/policy.yaml', '--path', '/tmp/a', '--path', '/tmp/b'])

    expect(args).toMatchObject({
      command: 'watch',
      policyPath: '/tmp/policy.yaml',
      watchPaths: ['/tmp/a', '/tmp/b'],
    })
  })

  it('parses proxy mode with separator command', () => {
    const args = parseCliArgs(['--policy', '/tmp/policy.yaml', '--', 'npx', '@modelcontextprotocol/server-example'])

    expect(args).toMatchObject({
      command: 'proxy',
      policyPath: '/tmp/policy.yaml',
      upstreamCommand: 'npx',
      upstreamArgs: ['@modelcontextprotocol/server-example'],
    })
  })

  it('parses quarantine list subcommand', () => {
    const args = parseCliArgs(['quarantine', 'list', '--quarantine-dir', '/tmp/quarantine'])

    expect(args).toMatchObject({
      command: 'quarantine_list',
      quarantineDir: '/tmp/quarantine',
    })
  })

  it('parses quarantine restore subcommand with positional id', () => {
    const args = parseCliArgs(['quarantine', 'restore', 'abc-123', '--quarantine-dir', '/tmp/quarantine'])

    expect(args).toMatchObject({
      command: 'quarantine_restore',
      id: 'abc-123',
      quarantineDir: '/tmp/quarantine',
    })
  })

  it('parses blocklist sync arguments', () => {
    const args = parseCliArgs([
      'blocklist',
      'sync',
      '--policy',
      '/tmp/policy.yaml',
      '--source',
      'https://example.com/feed1.json',
      '--source',
      'https://example.com/feed2.json',
      '--cache-path',
      '/tmp/intel.json',
    ])

    expect(args).toMatchObject({
      command: 'blocklist_sync',
      policyPath: '/tmp/policy.yaml',
      sources: ['https://example.com/feed1.json', 'https://example.com/feed2.json'],
      cachePath: '/tmp/intel.json',
    })
  })

  it('parses adversary run arguments', () => {
    const args = parseCliArgs([
      'adversary',
      'run',
      '--out',
      '/tmp/adversary',
      '--agent',
      '/tmp/agent.json',
      '--max-cases',
      '25',
      '--max-duration-ms',
      '60000',
      '--seed',
      'sapper',
    ])

    expect(args).toMatchObject({
      command: 'adversary_run',
      outDir: '/tmp/adversary',
      agentConfigPath: '/tmp/agent.json',
      maxCases: 25,
      maxDurationMs: 60000,
      seed: 'sapper',
    })
  })

  it('parses adversary replay arguments', () => {
    const args = parseCliArgs(['adversary', 'replay', '--repro', '/tmp/repro.json'])

    expect(args).toMatchObject({
      command: 'adversary_replay',
      reproPath: '/tmp/repro.json',
    })
  })
})
