import type { Honeytoken } from '@sapper-ai/types'

const DISALLOWED_VALUE_WORDS = ['canary', 'test', 'fake', 'dummy', 'example'] as const

const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz'
const DIGITS = '0123456789'
const UPPER_ALNUM = `${UPPERCASE}${DIGITS}`
const ALNUM = `${UPPERCASE}${LOWERCASE}${DIGITS}`
const AWS_SECRET_CHARS = `${ALNUM}/+=`
const BASE64_CHARS = `${ALNUM}+/`
const PASSWORD_SYMBOLS = '!@#$%^&*()_-+=[]{}:;,.?/'
const PASSWORD_CHARS = `${ALNUM}${PASSWORD_SYMBOLS}`

const SEARCH_PATTERN_LENGTH = 16
const MAX_ATTEMPTS = 512

export interface HoneytokenFile {
  path: string
  content: string
}

export interface HoneytokenGenerationResult {
  honeytokens: Honeytoken[]
  envVars: Record<string, string>
  files: HoneytokenFile[]
}

export interface HoneytokenGeneratorOptions {
  seed?: string | number
}

class SeededRandom {
  private state: number

  constructor(seed: string | number) {
    const normalized = typeof seed === 'number' ? String(seed) : seed
    const hashed = hashSeed(normalized)
    this.state = hashed === 0 ? 0x9e3779b9 : hashed
  }

  nextUint32(): number {
    this.state ^= this.state << 13
    this.state ^= this.state >>> 17
    this.state ^= this.state << 5
    return this.state >>> 0
  }

  nextInt(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new Error(`Invalid maxExclusive: ${maxExclusive}`)
    }

    return this.nextUint32() % maxExclusive
  }

  charFrom(chars: string): string {
    return chars[this.nextInt(chars.length)]!
  }

  string(length: number, chars: string): string {
    if (length < 0) {
      throw new Error(`Invalid length: ${length}`)
    }

    let out = ''
    for (let index = 0; index < length; index += 1) {
      out += this.charFrom(chars)
    }
    return out
  }
}

function hashSeed(input: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function hasDisallowedWord(value: string): boolean {
  const normalized = value.toLowerCase()
  return DISALLOWED_VALUE_WORDS.some((word) => normalized.includes(word))
}

function generateSearchPattern(rng: SeededRandom, chars: string, used: Set<string>): string {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const candidate = rng.string(SEARCH_PATTERN_LENGTH, chars)
    if (used.has(candidate)) {
      continue
    }

    if (hasDisallowedWord(candidate)) {
      continue
    }

    return candidate
  }

  throw new Error('Unable to generate a unique search pattern')
}

function embedPattern(chars: string[], pattern: string, startIndex: number): void {
  for (let index = 0; index < pattern.length; index += 1) {
    chars[startIndex + index] = pattern[index]!
  }
}

function generateSegmentWithPattern(
  rng: SeededRandom,
  totalLength: number,
  chars: string,
  searchPattern: string
): string {
  if (searchPattern.length > totalLength) {
    throw new Error('searchPattern is longer than generated segment')
  }

  const buffer = rng.string(totalLength, chars).split('')
  const startIndex = rng.nextInt(totalLength - searchPattern.length + 1)
  embedPattern(buffer, searchPattern, startIndex)
  return buffer.join('')
}

function wrapLines(value: string, width: number): string {
  const lines: string[] = []

  for (let start = 0; start < value.length; start += width) {
    lines.push(value.slice(start, start + width))
  }

  return lines.join('\n')
}

function enforcePasswordClass(
  rng: SeededRandom,
  value: string[],
  mutableIndices: number[],
  regex: RegExp,
  chars: string
): void {
  if (regex.test(value.join(''))) {
    return
  }

  if (mutableIndices.length === 0) {
    return
  }

  const indexPosition = rng.nextInt(mutableIndices.length)
  const replacementIndex = mutableIndices.splice(indexPosition, 1)[0]!
  value[replacementIndex] = rng.charFrom(chars)
}

function generatePasswordValue(rng: SeededRandom, searchPattern: string): string {
  const length = 20
  const base = rng.string(length, PASSWORD_CHARS).split('')
  const startIndex = rng.nextInt(length - searchPattern.length + 1)
  embedPattern(base, searchPattern, startIndex)

  const mutableIndices: number[] = []
  for (let index = 0; index < length; index += 1) {
    if (index < startIndex || index >= startIndex + searchPattern.length) {
      mutableIndices.push(index)
    }
  }

  enforcePasswordClass(rng, base, mutableIndices, /[A-Z]/, UPPERCASE)
  enforcePasswordClass(rng, base, mutableIndices, /[a-z]/, LOWERCASE)
  enforcePasswordClass(rng, base, mutableIndices, /[0-9]/, DIGITS)
  enforcePasswordClass(rng, base, mutableIndices, /[!@#$%^&*()_\-+=\[\]{}:;,.?/]/, PASSWORD_SYMBOLS)

  return base.join('')
}

function generateSshValue(rng: SeededRandom, searchPattern: string): string {
  const bodyLength = 640
  const bodyChars = rng.string(bodyLength, BASE64_CHARS).split('')
  const startIndex = rng.nextInt(bodyLength - searchPattern.length + 1)
  embedPattern(bodyChars, searchPattern, startIndex)

  const padding = '='.repeat(rng.nextInt(3))
  const body = wrapLines(`${bodyChars.join('')}${padding}`, 70)
  return `-----BEGIN OPENSSH PRIVATE KEY-----\n${body}\n-----END OPENSSH PRIVATE KEY-----`
}

function createHoneytoken(
  rng: SeededRandom,
  usedPatterns: Set<string>,
  specification: {
    type: Honeytoken['type']
    envVar: string
    patternChars: string
    valueFactory: (searchPattern: string) => string
  }
): Honeytoken {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const searchPattern = generateSearchPattern(rng, specification.patternChars, usedPatterns)
    const value = specification.valueFactory(searchPattern)

    if (hasDisallowedWord(value)) {
      continue
    }

    usedPatterns.add(searchPattern)
    return {
      type: specification.type,
      envVar: specification.envVar,
      value,
      searchPattern,
    }
  }

  throw new Error(`Unable to generate honeytoken for ${specification.envVar}`)
}

function toEnvFileContent(envVars: Record<string, string>): string {
  const entries = Object.entries(envVars)
    .filter(([key]) => key !== 'SSH_PRIVATE_KEY')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)

  return `${entries.join('\n')}\n`
}

export class HoneytokenGenerator {
  private readonly rng: SeededRandom

  constructor(options: HoneytokenGeneratorOptions = {}) {
    this.rng = new SeededRandom(options.seed ?? 'sapper-openclaw-default-seed')
  }

  generate(): HoneytokenGenerationResult {
    const usedPatterns = new Set<string>()

    const honeytokens: Honeytoken[] = [
      createHoneytoken(this.rng, usedPatterns, {
        type: 'api_key',
        envVar: 'OPENAI_API_KEY',
        patternChars: ALNUM,
        valueFactory: (searchPattern) => `sk-proj-${generateSegmentWithPattern(this.rng, 48, ALNUM, searchPattern)}`,
      }),
      createHoneytoken(this.rng, usedPatterns, {
        type: 'api_key',
        envVar: 'AWS_ACCESS_KEY_ID',
        patternChars: UPPER_ALNUM,
        valueFactory: (searchPattern) => `AKIA${generateSegmentWithPattern(this.rng, 16, UPPER_ALNUM, searchPattern)}`,
      }),
      createHoneytoken(this.rng, usedPatterns, {
        type: 'api_key',
        envVar: 'AWS_SECRET_ACCESS_KEY',
        patternChars: ALNUM,
        valueFactory: (searchPattern) => generateSegmentWithPattern(this.rng, 40, AWS_SECRET_CHARS, searchPattern),
      }),
      createHoneytoken(this.rng, usedPatterns, {
        type: 'token',
        envVar: 'GITHUB_TOKEN',
        patternChars: ALNUM,
        valueFactory: (searchPattern) => `ghp_${generateSegmentWithPattern(this.rng, 36, ALNUM, searchPattern)}`,
      }),
      createHoneytoken(this.rng, usedPatterns, {
        type: 'password',
        envVar: 'DB_PASSWORD',
        patternChars: ALNUM,
        valueFactory: (searchPattern) => generatePasswordValue(this.rng, searchPattern),
      }),
      createHoneytoken(this.rng, usedPatterns, {
        type: 'ssh_key',
        envVar: 'SSH_PRIVATE_KEY',
        patternChars: ALNUM,
        valueFactory: (searchPattern) => generateSshValue(this.rng, searchPattern),
      }),
    ]

    const envVars = honeytokens.reduce<Record<string, string>>((accumulator, token) => {
      accumulator[token.envVar] = token.value
      return accumulator
    }, {})

    const files: HoneytokenFile[] = [
      {
        path: '/home/users/.ssh/id_ed25519',
        content: envVars.SSH_PRIVATE_KEY ?? '',
      },
      {
        path: '/home/users/.env',
        content: toEnvFileContent(envVars),
      },
    ]

    return {
      honeytokens,
      envVars,
      files,
    }
  }
}

export function generateHoneytokens(options: HoneytokenGeneratorOptions = {}): HoneytokenGenerationResult {
  return new HoneytokenGenerator(options).generate()
}
