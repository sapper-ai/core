import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { access, mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import type { Honeytoken } from '@sapper-ai/types'

const DEFAULT_IMAGE_TAG = 'sapper-openclaw-test:latest'
const DEFAULT_RUN_TIMEOUT_MS = 60_000
const DEFAULT_READY_TIMEOUT_MS = 30_000
const DEFAULT_BUILD_TIMEOUT_MS = 300_000
const DEFAULT_TRAFFIC_TIMEOUT_MS = 15_000

const REQUIRED_ASSET_FILES = ['Dockerfile', 'docker-compose.yml', 'test-runner.sh', 'install-ca.sh'] as const

interface ComposeInvocation {
  command: string
  baseArgs: string[]
  projectNameArg: '--project-name' | '-p'
}

interface SandboxRecord {
  sandboxId: string
  projectName: string
  assetsDir: string
  composeFilePath: string
  composeEnvPath: string
  honeytokenEnvPath: string
  personaRootPath: string
  workDir: string
  skillPath: string
  openclawContainerId?: string
  proxyContainerId?: string
}

export interface DockerCommandRunOptions {
  cwd?: string
  env?: NodeJS.ProcessEnv
  timeoutMs?: number
}

export interface DockerCommandRunResult {
  ok: boolean
  exitCode: number | null
  stdout: string
  stderr: string
  timedOut: boolean
}

export type DockerCommandRunner = (
  command: string,
  args: string[],
  options?: DockerCommandRunOptions
) => Promise<DockerCommandRunResult>

export interface DockerSandboxOptions {
  commandRunner?: DockerCommandRunner
  assetsDir?: string
  imageTag?: string
  runTimeoutMs?: number
  readyTimeoutMs?: number
  buildTimeoutMs?: number
}

export interface DockerSandboxRunResult {
  sandboxId: string
  projectName: string
  openclawContainerId: string
  proxyContainerId: string
  durationMs: number
  ready: true
}

function toCommandErrorMessage(prefix: string, result: DockerCommandRunResult): string {
  if (result.stderr.trim().length > 0) {
    return `${prefix}: ${result.stderr.trim()}`
  }

  if (result.stdout.trim().length > 0) {
    return `${prefix}: ${result.stdout.trim()}`
  }

  if (result.timedOut) {
    return `${prefix}: command timed out`
  }

  if (result.exitCode !== null) {
    return `${prefix}: exit code ${result.exitCode}`
  }

  return `${prefix}: command failed`
}

function encodeEnvValue(value: string): string {
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\n')
  if (/[\s"#$]/.test(escaped)) {
    return `"${escaped}"`
  }

  return escaped
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms)
  })
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function defaultDockerCommandRunner(
  command: string,
  args: string[],
  options: DockerCommandRunOptions = {}
): Promise<DockerCommandRunResult> {
  return new Promise((resolveResult) => {
    execFile(
      command,
      args,
      {
        encoding: 'utf8',
        cwd: options.cwd,
        env: options.env,
        timeout: options.timeoutMs,
        maxBuffer: 16 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        const normalizedStdout = typeof stdout === 'string' ? stdout : ''
        const normalizedStderr = typeof stderr === 'string' ? stderr : ''

        if (!error) {
          resolveResult({
            ok: true,
            exitCode: 0,
            stdout: normalizedStdout,
            stderr: normalizedStderr,
            timedOut: false,
          })
          return
        }

        const commandError = error as NodeJS.ErrnoException & {
          code?: number | string
          killed?: boolean
          signal?: NodeJS.Signals | null
        }

        const timeoutDetected =
          typeof options.timeoutMs === 'number' &&
          (commandError.message.toLowerCase().includes('timed out') || commandError.signal === 'SIGTERM')

        resolveResult({
          ok: false,
          exitCode: typeof commandError.code === 'number' ? commandError.code : null,
          stdout: normalizedStdout,
          stderr: normalizedStderr.length > 0 ? normalizedStderr : commandError.message,
          timedOut: timeoutDetected,
        })
      }
    )
  })
}

export class DockerSandbox {
  private readonly commandRunner: DockerCommandRunner
  private readonly imageTag: string
  private readonly runTimeoutMs: number
  private readonly readyTimeoutMs: number
  private readonly buildTimeoutMs: number
  private readonly configuredAssetsDir?: string
  private readonly sandboxes = new Map<string, SandboxRecord>()
  private composeInvocation: ComposeInvocation | null = null

  constructor(options: DockerSandboxOptions = {}) {
    this.commandRunner = options.commandRunner ?? defaultDockerCommandRunner
    this.imageTag = options.imageTag ?? DEFAULT_IMAGE_TAG
    this.runTimeoutMs = options.runTimeoutMs ?? DEFAULT_RUN_TIMEOUT_MS
    this.readyTimeoutMs = options.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS
    this.buildTimeoutMs = options.buildTimeoutMs ?? DEFAULT_BUILD_TIMEOUT_MS
    this.configuredAssetsDir = options.assetsDir
  }

  async prepare(skillPath: string, honeytokens: Honeytoken[]): Promise<string> {
    const normalizedSkillPath = resolve(skillPath)
    const skillInfo = await stat(normalizedSkillPath).catch(() => null)
    if (!skillInfo || !skillInfo.isFile()) {
      throw new Error(`Skill file not found: ${normalizedSkillPath}`)
    }

    await this.assertDockerAvailable()
    await this.resolveComposeInvocation()

    const assetsDir = await this.resolveAssetsDir()
    const composeFilePath = join(assetsDir, 'docker-compose.yml')

    const sandboxId = randomUUID()
    const projectName = `openclaw${sandboxId.replace(/-/g, '').slice(0, 12)}`

    const workDir = await mkdtemp(join(tmpdir(), 'openclaw-run-'))
    const honeytokenEnvPath = join(workDir, 'honeytokens.env')
    const composeEnvPath = join(workDir, '.env')
    const personaRootPath = join(workDir, 'persona')

    await this.writePersonaProfile(personaRootPath)

    const honeytokenEnvContent = this.renderHoneytokenEnvFile(honeytokens)
    await writeFile(honeytokenEnvPath, honeytokenEnvContent, 'utf8')

    const composeEnvContent = [
      `TARGET_SKILL_PATH=${encodeEnvValue(normalizedSkillPath)}`,
      `HONEYTOKEN_ENV_FILE=${encodeEnvValue(honeytokenEnvPath)}`,
      `PERSONA_ROOT_PATH=${encodeEnvValue(personaRootPath)}`,
      'CONTAINER_HOSTNAME=users-macbook',
      '',
    ].join('\n')

    await writeFile(composeEnvPath, composeEnvContent, 'utf8')

    const record: SandboxRecord = {
      sandboxId,
      projectName,
      assetsDir,
      composeFilePath,
      composeEnvPath,
      honeytokenEnvPath,
      personaRootPath,
      workDir,
      skillPath: normalizedSkillPath,
    }

    this.sandboxes.set(sandboxId, record)

    try {
      await this.ensureOpenClawImage(record)
      return sandboxId
    } catch (error) {
      this.sandboxes.delete(sandboxId)
      await rm(workDir, { recursive: true, force: true })
      throw error
    }
  }

  async run(sandboxId: string, timeoutMs?: number): Promise<DockerSandboxRunResult> {
    const record = this.sandboxes.get(sandboxId)
    if (!record) {
      throw new Error(`Unknown sandbox id: ${sandboxId}`)
    }

    const effectiveTimeout = timeoutMs ?? this.runTimeoutMs
    const startedAt = Date.now()

    const upResult = await this.runCompose(record, ['up', '-d', 'proxy', 'openclaw'], {
      timeoutMs: effectiveTimeout,
    })
    if (!upResult.ok) {
      throw new Error(toCommandErrorMessage('Failed to start docker compose services', upResult))
    }

    const openclawContainerId = await this.resolveContainerId(record, 'openclaw')
    const proxyContainerId = await this.resolveContainerId(record, 'proxy')

    await this.waitForReady(openclawContainerId, Math.min(this.readyTimeoutMs, effectiveTimeout))

    record.openclawContainerId = openclawContainerId
    record.proxyContainerId = proxyContainerId

    return {
      sandboxId,
      projectName: record.projectName,
      openclawContainerId,
      proxyContainerId,
      durationMs: Date.now() - startedAt,
      ready: true,
    }
  }

  async getTrafficLog(sandboxId: string): Promise<string> {
    const record = this.sandboxes.get(sandboxId)
    if (!record) {
      throw new Error(`Unknown sandbox id: ${sandboxId}`)
    }

    const proxyContainerId = record.proxyContainerId ?? (await this.resolveContainerId(record, 'proxy'))
    record.proxyContainerId = proxyContainerId

    const execResult = await this.commandRunner(
      'docker',
      [
        'exec',
        proxyContainerId,
        'sh',
        '-lc',
        'cat /captures/traffic.log 2>/dev/null || cat /captures/traffic.flow 2>/dev/null || true',
      ],
      { timeoutMs: DEFAULT_TRAFFIC_TIMEOUT_MS }
    )

    if (execResult.ok && execResult.stdout.trim().length > 0) {
      return execResult.stdout
    }

    const logsResult = await this.runCompose(record, ['logs', '--no-color', 'proxy'], {
      timeoutMs: DEFAULT_TRAFFIC_TIMEOUT_MS,
    })
    if (!logsResult.ok) {
      throw new Error(toCommandErrorMessage('Failed to read proxy traffic logs', logsResult))
    }

    return logsResult.stdout.length > 0 ? logsResult.stdout : logsResult.stderr
  }

  async cleanup(sandboxId: string): Promise<void> {
    const record = this.sandboxes.get(sandboxId)
    if (!record) {
      return
    }

    let composeDownResult: DockerCommandRunResult | null = null
    let composeDownError: Error | null = null

    try {
      composeDownResult = await this.runCompose(record, ['down', '--volumes', '--remove-orphans'], {
        timeoutMs: 30_000,
      })
    } catch (error) {
      composeDownError = error as Error
    } finally {
      this.sandboxes.delete(sandboxId)
      await rm(record.workDir, { recursive: true, force: true })
    }

    if (composeDownError) {
      throw composeDownError
    }

    if (composeDownResult && !composeDownResult.ok) {
      throw new Error(toCommandErrorMessage('Failed to clean up docker compose resources', composeDownResult))
    }
  }

  getOpenclawContainerId(sandboxId: string): string | undefined {
    return this.sandboxes.get(sandboxId)?.openclawContainerId
  }

  getProxyContainerId(sandboxId: string): string | undefined {
    return this.sandboxes.get(sandboxId)?.proxyContainerId
  }

  private async writePersonaProfile(personaRootPath: string): Promise<void> {
    const gitDir = join(personaRootPath, '.git')
    const browserDir = join(personaRootPath, '.config', 'chromium', 'Default')
    await mkdir(gitDir, { recursive: true })
    await mkdir(browserDir, { recursive: true })

    await writeFile(
      join(gitDir, 'config'),
      ['[core]', '\trepositoryformatversion = 0', '\tbare = false', '\tfilemode = true', ''].join('\n'),
      'utf8'
    )
    await writeFile(
      join(personaRootPath, '.bashrc'),
      ['export PATH="$HOME/.local/bin:$PATH"', 'alias ll="ls -la"', ''].join('\n'),
      'utf8'
    )
    await writeFile(join(browserDir, 'History'), 'https://docs.example.local\n', 'utf8')
  }

  private renderHoneytokenEnvFile(honeytokens: Honeytoken[]): string {
    const lines: string[] = ['# Auto-generated honeytoken environment', '']
    const seen = new Set<string>()

    for (const token of honeytokens) {
      const envVar = token.envVar.trim()
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(envVar)) {
        continue
      }

      if (seen.has(envVar)) {
        continue
      }
      seen.add(envVar)

      lines.push(`${envVar}=${encodeEnvValue(token.value)}`)
    }

    lines.push('')
    return lines.join('\n')
  }

  private async ensureOpenClawImage(record: SandboxRecord): Promise<void> {
    const inspectResult = await this.commandRunner('docker', ['image', 'inspect', this.imageTag], {
      timeoutMs: 15_000,
    })
    if (inspectResult.ok) {
      return
    }

    const buildResult = await this.runCompose(record, ['build', 'openclaw'], { timeoutMs: this.buildTimeoutMs })
    if (!buildResult.ok) {
      throw new Error(toCommandErrorMessage('Failed to build OpenClaw docker image', buildResult))
    }
  }

  private async assertDockerAvailable(): Promise<void> {
    const infoResult = await this.commandRunner('docker', ['info'], { timeoutMs: 15_000 })
    if (!infoResult.ok) {
      throw new Error(toCommandErrorMessage('Docker daemon is unavailable', infoResult))
    }
  }

  private async resolveComposeInvocation(): Promise<ComposeInvocation> {
    if (this.composeInvocation) {
      return this.composeInvocation
    }

    const composePluginResult = await this.commandRunner('docker', ['compose', 'version'], { timeoutMs: 10_000 })
    if (composePluginResult.ok) {
      this.composeInvocation = {
        command: 'docker',
        baseArgs: ['compose'],
        projectNameArg: '--project-name',
      }
      return this.composeInvocation
    }

    const legacyComposeResult = await this.commandRunner('docker-compose', ['version'], { timeoutMs: 10_000 })
    if (legacyComposeResult.ok) {
      this.composeInvocation = {
        command: 'docker-compose',
        baseArgs: [],
        projectNameArg: '-p',
      }
      return this.composeInvocation
    }

    throw new Error('Docker Compose is required but was not found')
  }

  private async resolveAssetsDir(): Promise<string> {
    const candidateDirs = [
      this.configuredAssetsDir ? resolve(this.configuredAssetsDir) : null,
      resolve(__dirname),
      resolve(__dirname, '../../../src/openclaw/docker'),
      resolve(process.cwd(), 'src/openclaw/docker'),
      resolve(process.cwd(), 'packages/sapper-ai/src/openclaw/docker'),
    ].filter((entry): entry is string => typeof entry === 'string')

    const checked = new Set<string>()
    for (const candidateDir of candidateDirs) {
      if (checked.has(candidateDir)) {
        continue
      }
      checked.add(candidateDir)

      if (await this.isAssetDirectory(candidateDir)) {
        return candidateDir
      }
    }

    throw new Error('Unable to locate OpenClaw docker assets directory')
  }

  private async isAssetDirectory(candidateDir: string): Promise<boolean> {
    for (const assetFile of REQUIRED_ASSET_FILES) {
      if (!(await fileExists(join(candidateDir, assetFile)))) {
        return false
      }
    }

    return true
  }

  private async runCompose(
    record: SandboxRecord,
    composeArgs: string[],
    runOptions: DockerCommandRunOptions = {}
  ): Promise<DockerCommandRunResult> {
    const composeInvocation = await this.resolveComposeInvocation()

    const args = [
      ...composeInvocation.baseArgs,
      '-f',
      record.composeFilePath,
      composeInvocation.projectNameArg,
      record.projectName,
      '--env-file',
      record.composeEnvPath,
      ...composeArgs,
    ]

    return this.commandRunner(composeInvocation.command, args, {
      cwd: record.assetsDir,
      timeoutMs: runOptions.timeoutMs,
      env: runOptions.env,
    })
  }

  private async resolveContainerId(record: SandboxRecord, serviceName: 'openclaw' | 'proxy'): Promise<string> {
    const psResult = await this.runCompose(record, ['ps', '-q', serviceName], { timeoutMs: 10_000 })
    if (!psResult.ok) {
      throw new Error(toCommandErrorMessage(`Failed to resolve container for service ${serviceName}`, psResult))
    }

    const containerId = psResult.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0)

    if (!containerId) {
      throw new Error(`Container for service ${serviceName} is not running`)
    }

    return containerId
  }

  private async waitForReady(containerId: string, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs

    while (Date.now() <= deadline) {
      const readyResult = await this.commandRunner('docker', ['exec', containerId, 'test', '-f', '/run/openclaw/ready'], {
        timeoutMs: 2_000,
      })
      if (readyResult.ok) {
        return
      }

      await sleep(1_000)
    }

    throw new Error(`OpenClaw container did not become ready within ${timeoutMs}ms`)
  }
}
