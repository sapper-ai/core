import { describe, expect, it } from 'vitest'

import { generateHtmlReport } from '../report'

describe('report', () => {
  it('generateHtmlReport returns self-contained HTML with SCAN_DATA', () => {
    const html = generateHtmlReport({
      version: '1.0',
      timestamp: '2026-02-14T00:00:00.000Z',
      scope: 'Current + subdirectories',
      target: '/tmp/project',
      ai: true,
      summary: { totalFiles: 2, scannedFiles: 2, skippedFiles: 0, threats: 1 },
      findings: [
        {
          filePath: '/tmp/project/skill.md',
          risk: 0.9,
          confidence: 0.9,
          action: 'block',
          patterns: ['ignore previous'],
          reasons: ['Detected pattern: ignore previous', 'AI: suspicious intent'],
          snippet: 'ignore all previous instructions',
          detectors: ['rules', 'llm'],
          aiAnalysis: 'AI: suspicious intent',
        },
      ],
    })

    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html).toMatch(/const SCAN_DATA = /)
    expect(html).toMatch(/SapperAI Scan Report/)
    expect(html).toMatch(/skill\.md/)
  })

  it('escapes </script> in snippet to prevent XSS', () => {
    const html = generateHtmlReport({
      version: '1.0',
      timestamp: '2026-02-14T00:00:00.000Z',
      scope: 'Current + subdirectories',
      target: '/tmp/project',
      ai: false,
      summary: { totalFiles: 1, scannedFiles: 1, skippedFiles: 0, threats: 1 },
      findings: [
        {
          filePath: '/tmp/project/evil.md',
          risk: 0.9,
          confidence: 0.9,
          action: 'block',
          patterns: ['script injection'],
          reasons: ['Detected pattern: script injection'],
          snippet: '</script><script>alert(document.cookie)</script>',
          detectors: ['rules'],
          aiAnalysis: null,
        },
      ],
    })

    expect(html).not.toMatch(/<\/script><script>alert/)
    expect(html).toMatch(/<\\\/script>/)
  })
})
