import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { Policy } from '@sapper-ai/types'

import { PolicyManager } from '../../engine/PolicyManager'

const policyBase: Policy = {
  mode: 'enforce',
  defaultAction: 'allow',
  failOpen: true,
}

describe('PolicyManager', () => {
  it('resolves tool-specific override on top of base policy', () => {
    const manager = new PolicyManager()

    const policyWithOverrides = {
      ...policyBase,
      toolOverrides: {
        bash: {
          mode: 'monitor',
          detectors: ['rules'],
          thresholds: {
            blockMinConfidence: 0.9,
          },
        },
      },
      detectors: ['rules', 'llm'],
      thresholds: {
        blockMinConfidence: 0.5,
      },
    } as Policy & {
      detectors: string[]
      thresholds: { blockMinConfidence: number }
    }

    const resolved = manager.resolvePolicy('bash', policyWithOverrides) as Policy & {
      detectors?: string[]
      thresholds?: { blockMinConfidence?: number }
    }

    expect(resolved.mode).toBe('monitor')
    expect(resolved.detectors).toEqual(['rules'])
    expect(resolved.thresholds?.blockMinConfidence).toBe(0.9)
  })

  it('returns base policy when no override exists for tool', () => {
    const manager = new PolicyManager()
    const resolved = manager.resolvePolicy('unknown-tool', policyBase)

    expect(resolved).toEqual(policyBase)
  })

  it('loads policy object with defaults via zod validation', () => {
    const manager = new PolicyManager()
    const policy = manager.loadFromObject({
      mode: 'enforce',
      defaultAction: 'allow',
    })

    expect(policy.failOpen).toBe(true)
  })

  it('throws on invalid policy object', () => {
    const manager = new PolicyManager()

    expect(() =>
      manager.loadFromObject({
        defaultAction: 'allow',
      })
    ).toThrow()
  })

  it('loads policy from json file', () => {
    const manager = new PolicyManager()
    const tempDir = mkdtempSync(join(tmpdir(), 'policy-json-'))
    const filePath = join(tempDir, 'policy.json')

    writeFileSync(
      filePath,
      JSON.stringify({
        mode: 'monitor',
        defaultAction: 'allow',
      }),
      'utf8'
    )

    const policy = manager.loadFromFile(filePath)
    rmSync(tempDir, { recursive: true, force: true })

    expect(policy.mode).toBe('monitor')
    expect(policy.failOpen).toBe(true)
  })

  it('loads policy from yaml file', () => {
    const manager = new PolicyManager()
    const tempDir = mkdtempSync(join(tmpdir(), 'policy-yaml-'))
    const filePath = join(tempDir, 'policy.yaml')

    writeFileSync(
      filePath,
      [
        'mode: enforce',
        'defaultAction: allow',
        'toolOverrides:',
        '  shell:',
        '    mode: monitor',
        '    thresholds:',
        '      blockMinConfidence: 0.8',
      ].join('\n'),
      'utf8'
    )

    const policy = manager.loadFromFile(filePath)
    rmSync(tempDir, { recursive: true, force: true })

    expect(policy.mode).toBe('enforce')
    expect(policy.toolOverrides?.shell?.mode).toBe('monitor')
    expect(policy.toolOverrides?.shell?.thresholds?.blockMinConfidence).toBe(0.8)
  })

  it('merges allowlist and blocklist from tool override', () => {
    const manager = new PolicyManager()
    const resolved = manager.resolvePolicy(
      'echo',
      {
        ...policyBase,
        allowlist: {
          toolNames: ['safe-global'],
        },
        blocklist: {
          contentPatterns: ['global-pattern'],
        },
        toolOverrides: {
          echo: {
            allowlist: {
              toolNames: ['echo'],
            },
            blocklist: {
              contentPatterns: ['echo-pattern'],
            },
          },
        },
      } as Policy
    ) as Policy & {
      allowlist?: { toolNames?: string[] }
      blocklist?: { contentPatterns?: string[] }
    }

    expect(resolved.allowlist?.toolNames).toContain('echo')
    expect(resolved.allowlist?.toolNames).toContain('safe-global')
    expect(resolved.blocklist?.contentPatterns).toContain('global-pattern')
    expect(resolved.blocklist?.contentPatterns).toContain('echo-pattern')
  })
})
