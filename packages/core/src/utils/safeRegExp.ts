import safe from 'safe-regex2'

const MAX_PATTERN_LENGTH = 512
const regexCache = new Map<string, RegExp | null>()

export function safeRegExp(pattern: string): RegExp | null {
  const cached = regexCache.get(pattern)
  if (cached !== undefined) {
    return cached
  }

  if (pattern.length > MAX_PATTERN_LENGTH) {
    regexCache.set(pattern, null)
    return null
  }

  if (!safe(pattern)) {
    regexCache.set(pattern, null)
    return null
  }

  try {
    const regex = new RegExp(pattern, 'i')
    regexCache.set(pattern, regex)
    return regex
  } catch {
    regexCache.set(pattern, null)
    return null
  }
}
