import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import type { Honeytoken } from '@sapper-ai/types'

import {
  DockerSandbox,
  type DockerCommandRunResult,
  type DockerCommandRunner,
} from '../../openclaw/docker/DockerSandbox'

function ok(stdout = ''): DockerCommandRunResult {
  return {
    ok: true,
    exitCode: 0,
    stdout,
    stderr: '',
    timedOut: false,
  }
}

function fail(stderr: string, exitCode = 1): DockerCommandRunResult {
  return {
    ok: false,
    exitCode,
    stdout: '',
    stderr,
    timedOut: false,
  }
}

function createAssetFixtures(root: string): string {
  const assetsDir = join(root, 'assets')
  mkdirSync(assetsDir, { recursive: true })
  writeFileSync(join(root, 'assets', 'Dockerfile'), 'FROM node:20-slim\n', 'utf8')
  writeFileSync(join(root, 'assets', 'docker-compose.yml'), 'services: {}\n', 'utf8')
  writeFileSync(join(root, 'assets', 'test-runner.sh'), '#!/bin/sh\n', 'utf8')
  writeFileSync(join(root, 'assets', 'install-ca.sh'), '#!/bin/sh\n', 'utf8')
  return assetsDir
}

describe('openclaw/docker/DockerSandbox', () => {
  it('prepares and runs docker-compose lifecycle with secure defaults', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sapper-ai-docker-sandbox-'))

    try {
      const skillPath = join(dir, 'skill.md')
      writeFileSync(skillPath, '# demo skill\n', 'utf8')

      const assetsDir = createAssetFixtures(dir)
      const commandRunner = vi.fn<DockerCommandRunner>(async (command, args) => {
        if (command === 'docker' && args[0] === 'info') return ok()
        if (command === 'docker' && args[0] === 'compose' && args[1] === 'version') return ok('v2.24.0')
        if (command === 'docker' && args[0] === 'image' && args[1] === 'inspect') return fail('image not found')
        if (command === 'docker' && args.includes('build') && args.includes('openclaw')) return ok('build ok')
        if (command === 'docker' && args.includes('up') && args.includes('openclaw')) return ok('up ok')
        if (command === 'docker' && args.includes('ps') && args.includes('openclaw')) return ok('openclaw-container-1\n')
        if (command === 'docker' && args.includes('ps') && args.includes('proxy')) return ok('proxy-container-1\n')
        if (command === 'docker' && args[0] === 'exec' && args[1] === 'openclaw-container-1') return ok()
        if (command === 'docker' && args.includes('down')) return ok('down ok')

        return ok()
      })

      const sandbox = new DockerSandbox({
        assetsDir,
        commandRunner,
        imageTag: 'custom-openclaw-image:latest',
      })

      const honeytokens: Honeytoken[] = [
        {
          type: 'api_key',
          envVar: 'OPENAI_API_KEY',
          value: 'sk-proj-abc123',
          searchPattern: 'A1B2C3D4E5F6G7H8',
        },
      ]

      const sandboxId = await sandbox.prepare(skillPath, honeytokens)
      const runResult = await sandbox.run(sandboxId)

      expect(runResult.ready).toBe(true)
      expect(runResult.openclawContainerId).toBe('openclaw-container-1')
      expect(runResult.proxyContainerId).toBe('proxy-container-1')

      const commandLines = commandRunner.mock.calls.map(([command, args]) => `${command} ${args.join(' ')}`)
      expect(commandLines.some((line) => line.includes('compose -f') && line.includes('--project-name'))).toBe(true)
      expect(commandLines.some((line) => line.includes('up -d proxy openclaw'))).toBe(true)

      await sandbox.cleanup(sandboxId)
      expect(sandbox.getOpenclawContainerId(sandboxId)).toBeUndefined()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('returns proxy traffic log and removes temp workdir on cleanup', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sapper-ai-docker-traffic-'))

    try {
      const skillPath = join(dir, 'skill.md')
      writeFileSync(skillPath, '# demo skill\n', 'utf8')

      const assetsDir = createAssetFixtures(dir)
      const commandRunner = vi.fn<DockerCommandRunner>(async (command, args) => {
        if (command === 'docker' && args[0] === 'info') return ok()
        if (command === 'docker' && args[0] === 'compose' && args[1] === 'version') return ok('v2.24.0')
        if (command === 'docker' && args[0] === 'image' && args[1] === 'inspect') return ok('exists')
        if (command === 'docker' && args.includes('up')) return ok()
        if (command === 'docker' && args.includes('ps') && args.includes('openclaw')) return ok('openclaw-ready\n')
        if (command === 'docker' && args.includes('ps') && args.includes('proxy')) return ok('proxy-ready\n')
        if (command === 'docker' && args[0] === 'exec' && args[1] === 'openclaw-ready') return ok()
        if (command === 'docker' && args[0] === 'exec' && args[1] === 'proxy-ready') return ok('captured traffic\n')
        if (command === 'docker' && args.includes('down')) return ok()
        return ok()
      })

      const sandbox = new DockerSandbox({
        assetsDir,
        commandRunner,
      })

      const sandboxId = await sandbox.prepare(skillPath, [])
      await sandbox.run(sandboxId)

      const traffic = await sandbox.getTrafficLog(sandboxId)
      expect(traffic).toContain('captured traffic')

      const envFileArg = commandRunner.mock.calls
        .flatMap(([, args]) => {
          const index = args.indexOf('--env-file')
          return index >= 0 ? [args[index + 1]] : []
        })
        .find((entry): entry is string => typeof entry === 'string' && entry.length > 0)
      expect(envFileArg).toBeDefined()

      const workDir = dirname(envFileArg!)
      expect(existsSync(workDir)).toBe(true)

      await sandbox.cleanup(sandboxId)
      expect(existsSync(workDir)).toBe(false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('fails prepare when docker daemon is not available', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sapper-ai-docker-daemon-missing-'))

    try {
      const skillPath = join(dir, 'skill.md')
      writeFileSync(skillPath, '# demo skill\n', 'utf8')

      const assetsDir = createAssetFixtures(dir)
      const commandRunner = vi.fn<DockerCommandRunner>(async () => fail('docker info failed'))

      const sandbox = new DockerSandbox({
        assetsDir,
        commandRunner,
      })

      await expect(sandbox.prepare(skillPath, [])).rejects.toThrow('Docker daemon is unavailable')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
