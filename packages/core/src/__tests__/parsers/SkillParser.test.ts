import { describe, expect, it } from 'vitest'

import { SkillParser } from '../../parsers/SkillParser'

const MAX_SKILL_FILE_SIZE = 150 * 1024
const MAX_FRONTMATTER_SIZE = 10 * 1024

describe('SkillParser', () => {
  it('parses yaml frontmatter and markdown body', () => {
    const content = [
      '---',
      'name: summarizer',
      'description: Summarize content',
      'homepage: https://example.com/skills/summarizer',
      'requires:',
      '  - internet',
      '  - memory',
      'userInvocable: true',
      '---',
      'You are a helpful summarizer.',
      '',
      'Return concise output.',
    ].join('\n')

    const parsed = SkillParser.parse(content)

    expect(parsed.metadata).toEqual({
      name: 'summarizer',
      description: 'Summarize content',
      homepage: 'https://example.com/skills/summarizer',
      requires: ['internet', 'memory'],
      userInvocable: true,
    })
    expect(parsed.body).toBe('You are a helpful summarizer.\n\nReturn concise output.')
    expect(parsed.raw).toContain('name: summarizer')
  })

  it('handles a skill without frontmatter', () => {
    const content = '# Plain Skill\n\nDo useful work.'
    const parsed = SkillParser.parse(content)

    expect(parsed.metadata.name).toBe('Plain Skill')
    expect(parsed.raw).toBe('')
    expect(parsed.body).toBe(content)
  })

  it('falls back to unknown skill name when metadata and headings are missing', () => {
    const parsed = SkillParser.parse('No heading and no frontmatter')

    expect(parsed.metadata.name).toBe('unknown-skill')
    expect(parsed.body).toBe('No heading and no frontmatter')
  })

  it('handles frontmatter with an empty body', () => {
    const parsed = SkillParser.parse(['---', 'name: empty-body', '---'].join('\n'))

    expect(parsed.metadata.name).toBe('empty-body')
    expect(parsed.body).toBe('')
  })

  it('throws when skill content exceeds maximum file size', () => {
    const oversized = 'x'.repeat(MAX_SKILL_FILE_SIZE + 1)

    expect(() => SkillParser.parse(oversized)).toThrow(/Skill file exceeds maximum size/)
  })

  it('throws when frontmatter exceeds maximum size', () => {
    const oversizedFrontmatter = 'x'.repeat(MAX_FRONTMATTER_SIZE + 1)
    const content = ['---', `description: ${oversizedFrontmatter}`, '---', 'Body'].join('\n')

    expect(() => SkillParser.parse(content)).toThrow(/Skill frontmatter exceeds maximum size/)
  })

  it('throws for malformed frontmatter yaml', () => {
    const content = ['---', 'name: bad', 'requires: [one, two', '---', 'Body'].join('\n')

    expect(() => SkillParser.parse(content)).toThrow(/Invalid skill frontmatter YAML/)
  })

  it('throws when frontmatter start delimiter is not closed', () => {
    const content = ['---', 'name: bad', 'description: missing end', 'Body'].join('\n')

    expect(() => SkillParser.parse(content)).toThrow(/missing closing delimiter/)
  })
})
