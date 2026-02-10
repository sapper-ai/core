import type { AssessmentContext, Detector, DetectorOutput } from '@sapperai/types'

type PatternSeverity = 'high' | 'medium'

interface PatternRule {
  label: string
  regex: RegExp
  severity: PatternSeverity
}

interface PatternMatch {
  label: string
  severity: PatternSeverity
  sample: string
}

const RULES: PatternRule[] = [
  {
    label: 'ignore previous',
    regex: /ignore(?:\s+all)?\s+previous/i,
    severity: 'high',
  },
  { label: 'system prompt', regex: /system\s+prompt/i, severity: 'high' },
  { label: 'disregard', regex: /\bdisregard\b/i, severity: 'high' },
  {
    label: 'override instructions',
    regex: /override\s+instructions?/i,
    severity: 'high',
  },
  { label: 'reveal your', regex: /reveal\s+your/i, severity: 'high' },
  { label: 'reveal sensitive', regex: /reveal\s+(?:confidential|system(?:\s+prompt)?)/i, severity: 'high' },
  { label: 'output all', regex: /output\s+all/i, severity: 'high' },
  {
    label: 'api key exfiltration phrase',
    regex: /output\s+all\s+(?:stored\s+)?(?:api[_\s-]?keys?|secrets?)/i,
    severity: 'high',
  },
  { label: 'admin password', regex: /admin\s+password/i, severity: 'high' },
  { label: '<script>', regex: /<script\b[^>]*>/i, severity: 'high' },
  { label: 'crlf injection', regex: /\r\n|%0d%0a/i, severity: 'high' },
  {
    label: 'unicode bypass',
    regex: /\\u[0-9a-f]{4}/i,
    severity: 'high',
  },
  { label: 'you are now', regex: /you\s+are\s+now/i, severity: 'medium' },
  { label: 'jailbreak', regex: /\bjailbreak\b/i, severity: 'medium' },
  { label: 'bypass', regex: /\bbypass\b/i, severity: 'medium' },
  { label: 'rm rf root', regex: /rm\s+-rf\s+\/\b|--no-preserve-root/i, severity: 'high' },
  { label: 'sql tautology', regex: /'\s*or\s*'1'\s*=\s*'1|\bor\s+1\s*=\s*1\b/i, severity: 'high' },
  { label: 'sql drop table', regex: /drop\s+table|drop\s+database/i, severity: 'high' },
  { label: 'path traversal', regex: /\.\.\//, severity: 'high' },
  { label: 'etc passwd shadow', regex: /\/etc\/(?:passwd|shadow)\b/i, severity: 'high' },
  { label: 'internal metadata ssrf', regex: /metadata\.service|internal-api|169\.254\.169\.254/i, severity: 'high' },
  { label: 'command substitution', regex: /\$\([^)]*\)/, severity: 'high' },
  { label: 'template injection', regex: /constructor\.constructor\(|\{\{.*\}\}/i, severity: 'high' },
  { label: 'xxe doctype', regex: /<!doctype|<!entity|file:\/\//i, severity: 'high' },
  { label: 'js url', regex: /javascript:/i, severity: 'high' },
  { label: 'system role tag', regex: /<\/?system>/i, severity: 'high' },
  { label: 'admin mode', regex: /admin\s+mode|developer\s+mode|unrestricted\s+ai/i, severity: 'high' },
  {
    label: 'security override',
    regex:
      /without\s+constraints|no\s+restrictions|bypass\s+all\s+safety(?:\s+filters|\s+guidelines)?|disable\s+all\s+safety\s+(?:filters|guidelines)/i,
    severity: 'high',
  },
  {
    label: 'urgent instruction prefix',
    regex: /(?:important|urgent)\s*:\s*(?:reveal|ignore|disregard|bypass|output)/i,
    severity: 'high',
  },
  { label: 'secret exfiltration', regex: /api[_\s-]?keys?|secret[_\s-]?token|process\.env|reveal\s+confidential/i, severity: 'high' },
  { label: 'python os system', regex: /__import__\(|os\.system\(/i, severity: 'high' },
  { label: 'system function call', regex: /\bsystem\s*\('/i, severity: 'high' },
  { label: 'quoted comment sqli', regex: /'--\b/, severity: 'high' },
  { label: 'bracketed user instruction', regex: /\[user\s+instruction\]/i, severity: 'high' },
  { label: 'system override prefix', regex: /system\s*(?:override|message|:)/i, severity: 'high' },
  { label: 'privileged mode', regex: /privileged\s+mode/i, severity: 'high' },
  { label: 'conversation history', regex: /conversation\s+history/i, severity: 'high' },
  { label: 'system mode unrestricted', regex: /system_mode\s*=\s*unrestricted/i, severity: 'high' },
  { label: 'disable security filters', regex: /disable\s+all\s+security\s+filters|unrestricted\s+access/i, severity: 'high' },
  { label: 'sql where quoted string', regex: /select\s+.+where.+=[\s]*'[^']+'/i, severity: 'high' },
  { label: 'admin base64', regex: /YWRtaW46cGFzc3dvcmQ=/, severity: 'high' },
  { label: 'logic or one equals one', regex: /\bor\s*\(\s*1\s*=\s*1\s*\)/i, severity: 'high' },
  { label: 'prototype pollution', regex: /__proto__/i, severity: 'high' },
]

const EDUCATIONAL_CONTEXT =
  /\b(tutorial|research|paper|learn|learning|discuss(?:es|ing)?|example|workshop|security warning|content moderation|false positive|how to|todo|development|debug|production|markdown|code snippet|should be filtered)\b/i

export class RulesDetector implements Detector {
  id = 'rules'

  appliesTo(_ctx: AssessmentContext): boolean {
    return true
  }

  async run(ctx: AssessmentContext): Promise<DetectorOutput | null> {
    const textChunks = this.collectContextText(ctx)
    const matches = this.matchPatterns(textChunks, ctx.kind)

    if (matches.length === 0) {
      return null
    }

    const risk = this.scoreRisk(matches)

    return {
      detectorId: this.id,
      risk,
      confidence: 0.9,
      reasons: matches.map((match) => `Detected pattern: ${match.label}`),
      evidence: {
        matches,
      },
    }
  }

  private collectContextText(ctx: AssessmentContext): string[] {
    const values: unknown[] = [ctx.toolCall?.arguments, ctx.toolCall?.meta, ctx.toolResult?.content, ctx.toolResult?.meta]

    const maybeMeta = (ctx as AssessmentContext & { meta?: unknown }).meta
    if (maybeMeta !== undefined) {
      values.push(maybeMeta)
    }

    const textChunks: string[] = []
    for (const value of values) {
      this.collectText(value, textChunks)
    }

    return textChunks
  }

  private collectText(value: unknown, target: string[]): void {
    if (value === null || value === undefined) {
      return
    }

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    ) {
      target.push(String(value))
      return
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        this.collectText(item, target)
      }
      return
    }

    if (typeof value === 'object') {
      for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
        target.push(key)
        this.collectText(nestedValue, target)
      }
    }
  }

  private matchPatterns(
    textChunks: string[],
    contextKind: AssessmentContext['kind']
  ): PatternMatch[] {
    const uniqueMatches = new Map<string, PatternMatch>()

    for (const text of textChunks) {
      for (const rule of RULES) {
        if (!rule.regex.test(text)) {
          continue
        }

        if (this.shouldSuppressMatch(rule.label, text, contextKind)) {
          continue
        }

        if (uniqueMatches.has(rule.label)) {
          continue
        }

        uniqueMatches.set(rule.label, {
          label: rule.label,
          severity: rule.severity,
          sample: text,
        })
      }
    }

    return Array.from(uniqueMatches.values())
  }

  private shouldSuppressMatch(
    label: string,
    text: string,
    contextKind: AssessmentContext['kind']
  ): boolean {
    if (contextKind === 'install_scan') {
      return false
    }

    if (!EDUCATIONAL_CONTEXT.test(text)) {
      return false
    }

    if (
      label === 'ignore previous' ||
      label === 'system prompt' ||
      label === 'disregard' ||
      label === 'override instructions' ||
      label === 'reveal your' ||
      label === 'jailbreak' ||
      label === 'bypass' ||
      label === 'sql tautology' ||
      label === '<script>'
    ) {
      return true
    }

    return false
  }

  private scoreRisk(matches: PatternMatch[]): number {
    const highCount = matches.filter((match) => match.severity === 'high').length
    const mediumCount = matches.filter((match) => match.severity === 'medium').length

    let baseRisk = 0
    if (highCount >= 2) {
      baseRisk = 0.95
    } else if (highCount === 1) {
      baseRisk = 0.8
    } else if (mediumCount >= 1) {
      baseRisk = 0.6
    }

    const extraCount = highCount >= 2 ? mediumCount : Math.max(matches.length - 1, 0)
    const additionalRisk = extraCount * 0.05

    return Math.min(1, baseRisk + additionalRisk)
  }
}
