import type { SkillMetadata } from '@sapper-ai/types'
import { parse as parseYaml } from 'yaml'

export interface ParsedSkill {
  metadata: SkillMetadata
  body: string
  raw: string
}

const UNKNOWN_SKILL_NAME = 'unknown-skill'
const FRONTMATTER_PATTERN = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/
const MAX_SKILL_FILE_SIZE = 150 * 1024
const MAX_FRONTMATTER_SIZE = 10 * 1024

function pickString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

function pickRequires(value: unknown): string[] | undefined {
  if (typeof value === 'string' && value.trim().length > 0) {
    return [value]
  }

  if (!Array.isArray(value)) {
    return undefined
  }

  const normalized = value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
  return normalized.length > 0 ? normalized : undefined
}

function extractFallbackName(body: string): string | undefined {
  const heading = body.match(/^\s*#\s+(.+?)\s*$/m)
  if (!heading || typeof heading[1] !== 'string') {
    return undefined
  }

  const candidate = heading[1].trim()
  return candidate.length > 0 ? candidate : undefined
}

function normalizeMetadata(rawMetadata: unknown, body: string): SkillMetadata {
  const record =
    rawMetadata && typeof rawMetadata === 'object' && !Array.isArray(rawMetadata)
      ? (rawMetadata as Record<string, unknown>)
      : {}

  return {
    name: pickString(record.name) ?? extractFallbackName(body) ?? UNKNOWN_SKILL_NAME,
    description: pickString(record.description),
    homepage: pickString(record.homepage),
    requires: pickRequires(record.requires),
    userInvocable: typeof record.userInvocable === 'boolean' ? record.userInvocable : undefined,
  }
}

export class SkillParser {
  static parse(content: string): ParsedSkill {
    const source = content.replace(/^\uFEFF/, '')
    const sourceByteSize = Buffer.byteLength(source, 'utf8')

    if (sourceByteSize > MAX_SKILL_FILE_SIZE) {
      throw new Error(
        `Skill file exceeds maximum size: ${sourceByteSize} bytes (max ${MAX_SKILL_FILE_SIZE} bytes)`
      )
    }

    const frontmatterMatch = source.match(FRONTMATTER_PATTERN)

    if (!frontmatterMatch && source.startsWith('---')) {
      throw new Error('Invalid skill frontmatter: missing closing delimiter')
    }

    const raw = frontmatterMatch?.[1] ?? ''
    const body = frontmatterMatch ? source.slice(frontmatterMatch[0].length) : source

    const frontmatterByteSize = Buffer.byteLength(raw, 'utf8')
    if (frontmatterByteSize > MAX_FRONTMATTER_SIZE) {
      throw new Error(
        `Skill frontmatter exceeds maximum size: ${frontmatterByteSize} bytes (max ${MAX_FRONTMATTER_SIZE} bytes)`
      )
    }

    let parsedMetadata: unknown = {}
    if (raw.trim().length > 0) {
      try {
        parsedMetadata = parseYaml(raw)
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'unknown YAML parse error'
        throw new Error(`Invalid skill frontmatter YAML: ${reason}`)
      }
    }

    return {
      metadata: normalizeMetadata(parsedMetadata, body),
      body,
      raw,
    }
  }
}
