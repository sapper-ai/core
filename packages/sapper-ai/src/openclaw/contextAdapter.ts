import type { ParsedSkill } from '@sapper-ai/core'
import type { AssessmentContext, Policy } from '@sapper-ai/types'

export interface SkillAssessmentContextOptions {
  skillPath?: string
  scanSource?: 'file_surface' | 'watch_surface'
}

export function skillToAssessmentContext(
  parsed: ParsedSkill,
  policy: Policy,
  options: SkillAssessmentContextOptions = {}
): AssessmentContext {
  const meta: Record<string, unknown> = {}

  if (parsed.metadata.homepage) {
    meta.homepage = parsed.metadata.homepage
  }

  if (parsed.metadata.requires && parsed.metadata.requires.length > 0) {
    meta.requires = parsed.metadata.requires
  }

  if (options.skillPath) {
    meta.scanSource = options.scanSource ?? 'file_surface'
    meta.sourcePath = options.skillPath
    meta.sourceType = 'skill'
  }

  return {
    kind: 'install_scan',
    toolCall: {
      toolName: 'skill_install',
      arguments: {
        skillName: parsed.metadata.name,
        content: parsed.body,
        frontmatter: parsed.raw,
      },
    },
    meta,
    policy,
  }
}
