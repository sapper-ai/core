export type QuickstartCodeLanguage = 'bash' | 'ts' | 'yaml'

export type QuickstartCodeBlock = {
  language: QuickstartCodeLanguage
  title?: string
  code: string
}

export type QuickstartStep = {
  title: string
  description?: string
  blocks: QuickstartCodeBlock[]
}

export const quickstartTargetOrder = ['sdk', 'mcp'] as const
export type QuickstartTarget = (typeof quickstartTargetOrder)[number]

export type QuickstartTargetConfig = {
  label: string
  tagline: string
  pageTitle: string
  pageDescription: string
  intro: string
  highlights: { title: string; description: string }[]
  steps: QuickstartStep[]
}

export const quickstartTargets: Record<QuickstartTarget, QuickstartTargetConfig> = {
  sdk: {
    label: 'SDK',
    tagline: '애플리케이션 코드에 3줄로 guardrail 추가',
    pageTitle: 'Quickstart (SDK)',
    pageDescription: 'sapper-ai를 설치하고 createGuard()로 tool-call 입력을 즉시 검사합니다.',
    intro:
      '가장 빠른 시작 방법입니다. `sapper-ai` 하나만 설치하고 `createGuard()`로 tool-call 입력을 검사하세요.',
    highlights: [
      { title: '3줄 연동', description: '`createGuard()` + `guard.check()`로 즉시 적용' },
      { title: '프리셋 정책', description: 'monitor/standard/strict/paranoid 등 프리셋 제공' },
    ],
    steps: [
      {
        title: '1) 설치',
        description: 'npm 또는 pnpm 중 하나를 사용하세요.',
        blocks: [
          {
            language: 'bash',
            title: 'Install',
            code: ["npm install sapper-ai", "# or", "pnpm install sapper-ai"].join('\n'),
          },
        ],
      },
      {
        title: '2) (선택) 정책 파일 생성',
        description:
          '`npx sapper-ai init`는 `sapperai.config.yaml`을 생성합니다. (프리셋/임계치/감사로그 경로 등)',
        blocks: [
          {
            language: 'bash',
            title: 'Init Wizard',
            code: ['npx sapper-ai init'].join('\n'),
          },
          {
            language: 'yaml',
            title: 'sapperai.config.yaml (example)',
            code: [
              'mode: enforce',
              'defaultAction: allow',
              'failOpen: true',
              '',
              'detectors:',
              '  - rules',
              '',
              'thresholds:',
              '  riskThreshold: 0.7',
              '  blockMinConfidence: 0.5',
            ].join('\n'),
          },
        ],
      },
      {
        title: '3) tool-call 입력 검사',
        description: '차단 결과(`action: block`)면 실행을 중단하거나 에러를 던지는 식으로 연결하세요.',
        blocks: [
          {
            language: 'ts',
            title: 'SDK Usage',
            code: [
              "import { createGuard } from 'sapper-ai'",
              '',
              "const guard = createGuard('standard')",
              '',
              "const decision = await guard.check({ toolName: 'shell', arguments: { cmd: 'ls' } })",
              '',
              "if (decision.action === 'block') {",
              "  throw new Error(`Blocked: ${decision.reasons.join(', ')}`)",
              '}',
            ].join('\n'),
          },
        ],
      },
    ],
  },
  mcp: {
    label: 'MCP Proxy',
    tagline: '코드 변경 없이 MCP 서버 앞단에 보안 프록시',
    pageTitle: 'Quickstart (MCP Proxy)',
    pageDescription: 'sapperai-proxy로 어떤 MCP 서버든 앞단에서 tool-call 입력을 스캔합니다.',
    intro:
      'MCP 서버를 바꾸지 않고 적용하려면 프록시가 가장 간단합니다. `sapperai-proxy`가 `tools/list`와 `tools/call`을 가로채 위험도를 평가합니다.',
    highlights: [
      { title: 'No-code', description: 'MCP 서버 코드는 그대로 두고 프록시로 감싼다' },
      { title: '정책 파일', description: '`--policy`로 YAML/JSON 정책을 주입' },
      { title: 'Watch + Quarantine', description: '로컬 플러그인/설정 파일 변경을 감시하고 격리' },
    ],
    steps: [
      {
        title: '1) 설치',
        blocks: [
          {
            language: 'bash',
            title: 'Install',
            code: ['pnpm add @sapper-ai/mcp', '# or', 'npm install @sapper-ai/mcp'].join('\n'),
          },
        ],
      },
      {
        title: '2) (선택) 정책 파일 준비',
        description: '가장 단순한 정책 예시입니다. 필요하면 tool override를 추가하세요.',
        blocks: [
          {
            language: 'yaml',
            title: 'policy.yaml (example)',
            code: [
              'mode: enforce',
              'defaultAction: allow',
              'failOpen: true',
              '',
              'toolOverrides:',
              '  executeCommand:',
              '    mode: enforce',
              '    detectors: [rules]',
              '    thresholds:',
              '      blockMinConfidence: 0.8',
            ].join('\n'),
          },
        ],
      },
      {
        title: '3) 프록시로 MCP 서버 실행',
        description: '정책 파일이 없다면 `--policy` 없이 실행해도 됩니다.',
        blocks: [
          {
            language: 'bash',
            title: 'Proxy (default policy)',
            code: ['npx sapperai-proxy -- npx @modelcontextprotocol/server-example'].join('\n'),
          },
          {
            language: 'bash',
            title: 'Proxy (custom policy)',
            code: ['npx sapperai-proxy --policy ./policy.yaml -- npx mcp-server'].join('\n'),
          },
        ],
      },
      {
        title: '4) (선택) Watch + Quarantine',
        description: '로컬 skill/plugin/config 파일을 감시하고 차단된 파일을 격리합니다.',
        blocks: [
          {
            language: 'bash',
            title: 'Watch + Quarantine',
            code: [
              'npx sapperai-proxy watch',
              '',
              'npx sapperai-proxy quarantine list',
              'npx sapperai-proxy quarantine restore --id <id>',
            ].join('\n'),
          },
        ],
      },
    ],
  },
}

export function resolveQuickstartTarget(value: string): QuickstartTarget | null {
  if ((quickstartTargetOrder as readonly string[]).includes(value)) return value as QuickstartTarget
  if (value === 'dev') return 'sdk'
  return null
}
