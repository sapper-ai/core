import { createHash } from 'node:crypto'

import type { Policy, ToolCall, ToolResult } from '@sapper-ai/types'

interface MatchList {
  toolNames?: string[]
  urlPatterns?: string[]
  contentPatterns?: string[]
  packageNames?: string[]
  sha256?: string[]
}

interface ToolMetadata {
  name?: string
  version?: string
  packageName?: string
  ecosystem?: string
  sourceUrl?: string
  sha256?: string
}

export interface MatchSubject {
  toolName?: string
  content?: string
  metadata?: ToolMetadata
  toolCall?: ToolCall
  toolResult?: ToolResult
  fileHash?: string
}

export type PolicyMatchAction = 'allow' | 'block' | 'none'

export interface PolicyMatchResult {
  action: PolicyMatchAction
  reasons: string[]
}

function safeRegExp(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, 'i')
  } catch {
    return null
  }
}

function textFromSubject(subject: MatchSubject): string {
  const chunks: string[] = []
  if (subject.content) {
    chunks.push(subject.content)
  }

  if (subject.toolCall) {
    chunks.push(JSON.stringify(subject.toolCall.arguments ?? {}))
    if (subject.toolCall.meta) {
      chunks.push(JSON.stringify(subject.toolCall.meta))
    }
  }

  if (subject.toolResult) {
    chunks.push(JSON.stringify(subject.toolResult.content ?? {}))
    if (subject.toolResult.meta) {
      chunks.push(JSON.stringify(subject.toolResult.meta))
    }
  }

  if (subject.metadata) {
    chunks.push(JSON.stringify(subject.metadata))
  }

  return chunks.join('\n').toLowerCase()
}

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

function checkList(list: MatchList | undefined, subject: MatchSubject): string[] {
  if (!list) {
    return []
  }

  const reasons: string[] = []
  const normalizedToolName = subject.toolName ? normalize(subject.toolName) : null
  const sourceUrl = subject.metadata?.sourceUrl ? normalize(subject.metadata.sourceUrl) : null
  const packageName = subject.metadata?.packageName ? normalize(subject.metadata.packageName) : null
  const fileHash = subject.fileHash ? normalize(subject.fileHash) : subject.metadata?.sha256 ? normalize(subject.metadata.sha256) : null
  const content = textFromSubject(subject)

  for (const candidate of list.toolNames ?? []) {
    if (normalizedToolName && normalize(candidate) === normalizedToolName) {
      reasons.push(`toolName matched: ${candidate}`)
    }
  }

  for (const candidate of list.packageNames ?? []) {
    if (packageName && normalize(candidate) === packageName) {
      reasons.push(`packageName matched: ${candidate}`)
    }
  }

  for (const candidate of list.sha256 ?? []) {
    if (fileHash && normalize(candidate) === fileHash) {
      reasons.push(`sha256 matched: ${candidate}`)
    }
  }

  for (const pattern of list.urlPatterns ?? []) {
    const regex = safeRegExp(pattern)
    if (!regex) {
      continue
    }

    if ((sourceUrl && regex.test(sourceUrl)) || regex.test(content)) {
      reasons.push(`urlPattern matched: ${pattern}`)
    }
  }

  for (const pattern of list.contentPatterns ?? []) {
    const regex = safeRegExp(pattern)
    if (!regex) {
      continue
    }

    if (regex.test(content)) {
      reasons.push(`contentPattern matched: ${pattern}`)
    }
  }

  return reasons
}

export function evaluatePolicyMatch(policy: Policy, subject: MatchSubject): PolicyMatchResult {
  const allowReasons = checkList((policy as Policy & { allowlist?: MatchList }).allowlist, subject)
  if (allowReasons.length > 0) {
    return {
      action: 'allow',
      reasons: allowReasons,
    }
  }

  const blockReasons = checkList((policy as Policy & { blocklist?: MatchList }).blocklist, subject)
  if (blockReasons.length > 0) {
    return {
      action: 'block',
      reasons: blockReasons,
    }
  }

  return {
    action: 'none',
    reasons: [],
  }
}

export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}
