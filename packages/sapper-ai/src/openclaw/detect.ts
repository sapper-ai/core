import { execFile } from 'node:child_process'
import { readFile, readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'

export interface OpenClawEnvironment {
  installed: boolean
  version?: string
  skillsPaths: string[]
  skillCount: number
  dockerAvailable: boolean
  dockerComposeAvailable: boolean
}

interface CommandRunResult {
  ok: boolean
  stdout: string
  stderr: string
}

type CommandRunner = (command: string, args: string[]) => Promise<CommandRunResult>

export interface DetectOpenClawEnvironmentOptions {
  cwd?: string
  homeDir?: string
  commandRunner?: CommandRunner
}

function whichCommand(): string {
  return process.platform === 'win32' ? 'where' : 'which'
}

async function defaultCommandRunner(command: string, args: string[]): Promise<CommandRunResult> {
  return new Promise<CommandRunResult>((resolveResult) => {
    execFile(command, args, { encoding: 'utf8' }, (error, stdout, stderr) => {
      resolveResult({
        ok: !error,
        stdout: typeof stdout === 'string' ? stdout : '',
        stderr: typeof stderr === 'string' ? stderr : '',
      })
    })
  })
}

async function hasCommand(binary: string, runCommand: CommandRunner): Promise<boolean> {
  const result = await runCommand(whichCommand(), [binary])
  return result.ok
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    const info = await stat(path)
    return info.isDirectory()
  } catch {
    return false
  }
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values))
}

function expandHomePath(value: string, homeDir: string): string {
  if (value === '~') {
    return homeDir
  }

  if (value.startsWith('~/')) {
    return join(homeDir, value.slice(2))
  }

  return value
}

function normalizeCandidatePath(value: string, baseDir: string, homeDir: string): string {
  const expanded = expandHomePath(value.trim(), homeDir)
  if (isAbsolute(expanded)) {
    return resolve(expanded)
  }

  return resolve(baseDir, expanded)
}

function extractExtraSkillDirs(config: unknown): string[] {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return []
  }

  const skills = (config as { skills?: unknown }).skills
  if (!skills || typeof skills !== 'object' || Array.isArray(skills)) {
    return []
  }

  const load = (skills as { load?: unknown }).load
  if (!load || typeof load !== 'object' || Array.isArray(load)) {
    return []
  }

  const extraDirs = (load as { extraDirs?: unknown }).extraDirs
  if (!Array.isArray(extraDirs)) {
    return []
  }

  return extraDirs.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
}

async function readConfigSkillDirs(configPath: string, homeDir: string): Promise<string[]> {
  const exists = await pathExists(configPath)
  if (!exists) {
    return []
  }

  let raw = ''
  try {
    raw = await readFile(configPath, 'utf8')
  } catch {
    return []
  }

  if (raw.trim().length === 0) {
    return []
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }

  const baseDir = dirname(configPath)
  return extractExtraSkillDirs(parsed).map((entry) => normalizeCandidatePath(entry, baseDir, homeDir))
}

async function collectExistingSkillPaths(candidates: string[]): Promise<string[]> {
  const uniqueCandidates = uniqueStrings(candidates.map((candidate) => resolve(candidate)))
  const existingPaths: string[] = []

  for (const candidate of uniqueCandidates) {
    if (await isDirectory(candidate)) {
      existingPaths.push(candidate)
    }
  }

  return existingPaths
}

async function collectMarkdownFiles(rootPath: string): Promise<string[]> {
  const markdownFiles: string[] = []
  const stack: string[] = [rootPath]

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) {
      continue
    }

    let entries
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      const fullPath = join(current, entry.name)

      if (entry.isDirectory()) {
        stack.push(fullPath)
        continue
      }

      if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        markdownFiles.push(fullPath)
      }
    }
  }

  return markdownFiles
}

async function countSkillFiles(skillPaths: string[]): Promise<number> {
  const seen = new Set<string>()

  for (const skillPath of skillPaths) {
    const files = await collectMarkdownFiles(skillPath)
    for (const file of files) {
      seen.add(file)
    }
  }

  return seen.size
}

function parseOpenClawVersion(output: string): string | undefined {
  const line = output
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry.length > 0)

  if (!line) {
    return undefined
  }

  const matchedVersion = line.match(/(\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?)/)
  return matchedVersion?.[1] ?? line
}

async function resolveOpenClawVersion(runCommand: CommandRunner, hasOpenClawBinary: boolean): Promise<string | undefined> {
  if (!hasOpenClawBinary) {
    return undefined
  }

  const versionResult = await runCommand('openclaw', ['--version'])
  if (!versionResult.ok) {
    return undefined
  }

  return parseOpenClawVersion(versionResult.stdout)
}

async function resolveDockerAvailability(runCommand: CommandRunner): Promise<{
  dockerAvailable: boolean
  dockerComposeAvailable: boolean
}> {
  const dockerInstalled = await hasCommand('docker', runCommand)
  if (!dockerInstalled) {
    return {
      dockerAvailable: false,
      dockerComposeAvailable: false,
    }
  }

  const dockerInfoResult = await runCommand('docker', ['info'])
  if (!dockerInfoResult.ok) {
    return {
      dockerAvailable: false,
      dockerComposeAvailable: false,
    }
  }

  const dockerComposeResult = await runCommand('docker', ['compose', 'version'])
  return {
    dockerAvailable: true,
    dockerComposeAvailable: dockerComposeResult.ok,
  }
}

export async function detectOpenClawEnvironment(
  options: DetectOpenClawEnvironmentOptions = {}
): Promise<OpenClawEnvironment> {
  const runCommand = options.commandRunner ?? defaultCommandRunner
  const homeDir = options.homeDir ?? homedir()
  const cwd = options.cwd ?? process.cwd()

  const openClawHomeDir = join(homeDir, '.openclaw')
  const hasOpenClawBinary = await hasCommand('openclaw', runCommand)
  const hasOpenClawHomeDir = await isDirectory(openClawHomeDir)

  const version = await resolveOpenClawVersion(runCommand, hasOpenClawBinary)

  const configSkillDirs = await readConfigSkillDirs(join(openClawHomeDir, 'config.json'), homeDir)
  const skillPathCandidates = [join(openClawHomeDir, 'skills'), join(cwd, 'skills'), ...configSkillDirs]
  const skillsPaths = await collectExistingSkillPaths(skillPathCandidates)
  const skillCount = await countSkillFiles(skillsPaths)

  const docker = await resolveDockerAvailability(runCommand)

  return {
    installed: hasOpenClawBinary || hasOpenClawHomeDir || skillsPaths.length > 0,
    version,
    skillsPaths,
    skillCount,
    dockerAvailable: docker.dockerAvailable,
    dockerComposeAvailable: docker.dockerComposeAvailable,
  }
}
