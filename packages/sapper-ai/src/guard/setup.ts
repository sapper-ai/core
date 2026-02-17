import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export const SESSION_START_COMMAND = 'sapper-ai guard scan'
export const USER_PROMPT_SUBMIT_COMMAND = 'sapper-ai guard check'

const SESSION_START_TIMEOUT_SECONDS = 30
const USER_PROMPT_SUBMIT_TIMEOUT_SECONDS = 5

type HookEvent = 'SessionStart' | 'UserPromptSubmit'

const MANAGED_HOOKS: ReadonlyArray<{
  event: HookEvent
  command: string
  timeoutSeconds: number
}> = [
  {
    event: 'SessionStart',
    command: SESSION_START_COMMAND,
    timeoutSeconds: SESSION_START_TIMEOUT_SECONDS,
  },
  {
    event: 'UserPromptSubmit',
    command: USER_PROMPT_SUBMIT_COMMAND,
    timeoutSeconds: USER_PROMPT_SUBMIT_TIMEOUT_SECONDS,
  },
]

type SetupAction = 'registered' | 'already_registered' | 'removed' | 'not_registered' | 'missing_claude_dir'

export interface SetupPathOptions {
  homeDir?: string
  claudeDirPath?: string
  settingsPath?: string
}

export interface SetupCommandStatus {
  event: HookEvent
  command: string
  timeoutSeconds: number
  registered: boolean
  matchCount: number
}

export interface SetupStatusResult {
  claudeDirPath: string
  settingsPath: string
  claudeDirExists: boolean
  settingsExists: boolean
  fullyRegistered: boolean
  commands: SetupCommandStatus[]
}

export interface RegisterHooksResult {
  ok: boolean
  action: Extract<SetupAction, 'registered' | 'already_registered' | 'missing_claude_dir'>
  changed: boolean
  added: HookEvent[]
  status: SetupStatusResult
}

export interface RemoveHooksResult {
  ok: boolean
  action: Extract<SetupAction, 'removed' | 'not_registered' | 'missing_claude_dir'>
  changed: boolean
  removedCount: number
  removedByEvent: Record<HookEvent, number>
  status: SetupStatusResult
}

interface SettingsReadResult {
  settings: Record<string, unknown>
  settingsExists: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function resolvePaths(options?: SetupPathOptions): {
  claudeDirPath: string
  settingsPath: string
} {
  const homePath = options?.homeDir ?? homedir()
  const claudeDirPath = options?.claudeDirPath ?? join(homePath, '.claude')
  const settingsPath = options?.settingsPath ?? join(claudeDirPath, 'settings.json')
  return { claudeDirPath, settingsPath }
}

function readSettings(settingsPath: string): SettingsReadResult {
  if (!existsSync(settingsPath)) {
    return { settings: {}, settingsExists: false }
  }

  const raw = readFileSync(settingsPath, 'utf8')
  if (raw.trim().length === 0) {
    return { settings: {}, settingsExists: true }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`Failed to parse ${settingsPath}: invalid JSON`)
  }

  if (!isRecord(parsed)) {
    throw new Error(`${settingsPath} must contain a JSON object`)
  }

  return { settings: parsed, settingsExists: true }
}

function getHooksSection(settings: Record<string, unknown>, createIfMissing: boolean): Record<string, unknown> | undefined {
  const existing = settings.hooks
  if (isRecord(existing)) {
    return existing
  }

  if (!createIfMissing) {
    return undefined
  }

  const created: Record<string, unknown> = {}
  settings.hooks = created
  return created
}

function toMutableEventEntries(hooksSection: Record<string, unknown>, event: HookEvent): unknown[] {
  const existing = hooksSection[event]

  if (Array.isArray(existing)) {
    return existing
  }

  if (existing === undefined) {
    const created: unknown[] = []
    hooksSection[event] = created
    return created
  }

  const converted: unknown[] = [existing]
  hooksSection[event] = converted
  return converted
}

function countCommandMatches(entries: unknown[], command: string): number {
  let matches = 0

  for (const entry of entries) {
    if (!isRecord(entry)) continue
    const nestedHooks = entry.hooks
    if (!Array.isArray(nestedHooks)) continue

    for (const hook of nestedHooks) {
      if (!isRecord(hook)) continue
      if (hook.type !== 'command') continue
      if (hook.command === command) {
        matches += 1
      }
    }
  }

  return matches
}

function countCommandInEvent(settings: Record<string, unknown>, event: HookEvent, command: string): number {
  const hooksSection = getHooksSection(settings, false)
  if (!hooksSection) return 0

  const eventEntries = hooksSection[event]
  if (!Array.isArray(eventEntries)) return 0

  return countCommandMatches(eventEntries, command)
}

function getStatusFromSettings(
  settings: Record<string, unknown>,
  settingsExists: boolean,
  claudeDirPath: string,
  settingsPath: string,
  claudeDirExists: boolean
): SetupStatusResult {
  const commands = MANAGED_HOOKS.map((managedHook) => {
    const matchCount = countCommandInEvent(settings, managedHook.event, managedHook.command)
    return {
      event: managedHook.event,
      command: managedHook.command,
      timeoutSeconds: managedHook.timeoutSeconds,
      registered: matchCount > 0,
      matchCount,
    }
  })

  return {
    claudeDirPath,
    settingsPath,
    claudeDirExists,
    settingsExists,
    fullyRegistered: commands.every((entry) => entry.registered),
    commands,
  }
}

function writeSettingsAtomic(settingsPath: string, settings: Record<string, unknown>): void {
  const directory = dirname(settingsPath)
  mkdirSync(directory, { recursive: true })

  const temporaryPath = `${settingsPath}.tmp-${process.pid}-${Date.now()}`

  try {
    writeFileSync(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
    renameSync(temporaryPath, settingsPath)
  } catch (error) {
    rmSync(temporaryPath, { force: true })
    throw error
  }
}

function addManagedHooks(settings: Record<string, unknown>): HookEvent[] {
  const hooksSection = getHooksSection(settings, true)!
  const addedEvents: HookEvent[] = []

  for (const managedHook of MANAGED_HOOKS) {
    const eventEntries = toMutableEventEntries(hooksSection, managedHook.event)
    const alreadyRegistered = countCommandMatches(eventEntries, managedHook.command) > 0
    if (alreadyRegistered) {
      continue
    }

    eventEntries.push({
      matcher: '*',
      hooks: [
        {
          type: 'command',
          command: managedHook.command,
          timeout: managedHook.timeoutSeconds,
        },
      ],
    })
    addedEvents.push(managedHook.event)
  }

  return addedEvents
}

function removeManagedHooks(settings: Record<string, unknown>): {
  changed: boolean
  removedByEvent: Record<HookEvent, number>
  removedCount: number
} {
  const hooksSection = getHooksSection(settings, false)
  const removedByEvent: Record<HookEvent, number> = {
    SessionStart: 0,
    UserPromptSubmit: 0,
  }

  if (!hooksSection) {
    return { changed: false, removedByEvent, removedCount: 0 }
  }

  let changed = false

  for (const managedHook of MANAGED_HOOKS) {
    const eventEntries = hooksSection[managedHook.event]
    if (!Array.isArray(eventEntries)) {
      continue
    }

    const nextEntries: unknown[] = []
    let removedForEvent = 0

    for (const entry of eventEntries) {
      if (!isRecord(entry)) {
        nextEntries.push(entry)
        continue
      }

      const nestedHooks = entry.hooks
      if (!Array.isArray(nestedHooks)) {
        nextEntries.push(entry)
        continue
      }

      const retainedHooks: unknown[] = []

      for (const hook of nestedHooks) {
        if (
          isRecord(hook) &&
          hook.type === 'command' &&
          hook.command === managedHook.command
        ) {
          removedForEvent += 1
          changed = true
          continue
        }

        retainedHooks.push(hook)
      }

      if (retainedHooks.length === 0) {
        continue
      }

      if (retainedHooks.length !== nestedHooks.length) {
        nextEntries.push({ ...entry, hooks: retainedHooks })
        continue
      }

      nextEntries.push(entry)
    }

    removedByEvent[managedHook.event] = removedForEvent

    if (nextEntries.length === 0) {
      delete hooksSection[managedHook.event]
    } else {
      hooksSection[managedHook.event] = nextEntries
    }
  }

  if (Object.keys(hooksSection).length === 0) {
    delete settings.hooks
  }

  return {
    changed,
    removedByEvent,
    removedCount: removedByEvent.SessionStart + removedByEvent.UserPromptSubmit,
  }
}

export function getStatus(options?: SetupPathOptions): SetupStatusResult {
  const { claudeDirPath, settingsPath } = resolvePaths(options)
  const claudeDirExists = existsSync(claudeDirPath)

  if (!claudeDirExists) {
    return getStatusFromSettings({}, false, claudeDirPath, settingsPath, false)
  }

  const { settings, settingsExists } = readSettings(settingsPath)
  return getStatusFromSettings(settings, settingsExists, claudeDirPath, settingsPath, true)
}

export function registerHooks(options?: SetupPathOptions): RegisterHooksResult {
  const { claudeDirPath, settingsPath } = resolvePaths(options)
  const claudeDirExists = existsSync(claudeDirPath)

  if (!claudeDirExists) {
    return {
      ok: false,
      action: 'missing_claude_dir',
      changed: false,
      added: [],
      status: getStatusFromSettings({}, false, claudeDirPath, settingsPath, false),
    }
  }

  const { settings, settingsExists } = readSettings(settingsPath)
  const added = addManagedHooks(settings)
  const changed = added.length > 0

  if (changed) {
    writeSettingsAtomic(settingsPath, settings)
  }

  const status = getStatusFromSettings(settings, settingsExists || changed, claudeDirPath, settingsPath, true)

  return {
    ok: true,
    action: changed ? 'registered' : 'already_registered',
    changed,
    added,
    status,
  }
}

export function removeHooks(options?: SetupPathOptions): RemoveHooksResult {
  const { claudeDirPath, settingsPath } = resolvePaths(options)
  const claudeDirExists = existsSync(claudeDirPath)

  if (!claudeDirExists) {
    return {
      ok: false,
      action: 'missing_claude_dir',
      changed: false,
      removedCount: 0,
      removedByEvent: {
        SessionStart: 0,
        UserPromptSubmit: 0,
      },
      status: getStatusFromSettings({}, false, claudeDirPath, settingsPath, false),
    }
  }

  const { settings, settingsExists } = readSettings(settingsPath)
  const removal = removeManagedHooks(settings)

  if (removal.changed) {
    writeSettingsAtomic(settingsPath, settings)
  }

  const status = getStatusFromSettings(
    settings,
    settingsExists || removal.changed,
    claudeDirPath,
    settingsPath,
    true
  )

  return {
    ok: true,
    action: removal.changed ? 'removed' : 'not_registered',
    changed: removal.changed,
    removedCount: removal.removedCount,
    removedByEvent: removal.removedByEvent,
    status,
  }
}
