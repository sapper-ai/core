# SapperAI Skill Guard — Zero-Config Auto-Scan Design

> Date: 2026-02-17
> Status: Design v2 — Post-Review Revision
> Concept: "Setup once, protected every session"

---

## Overview

`sapper-ai setup` 한 번 실행으로 Claude Code 환경에서 매 세션마다 스킬/플러그인 자동 보안 스캔.
SessionStart hook이 매 세션 시작 시 동기적으로 전체 스킬 디렉토리를 스캔하고,
content hash 캐시를 통해 변경된 스킬만 재스캔합니다.

### v1 → v2 주요 변경

| v1 | v2 | 이유 |
|----|----|----|
| postinstall이 settings.json 자동 수정 | `sapper-ai setup` 명시적 CLI | C1: 사용자 동의 없는 설정 수정은 신뢰 문제 |
| FileWatcher 백그라운드 프로세스 | SessionStart 동기 스캔 전용 | H1: PID 관리, 좀비 프로세스, 레이스 컨디션 제거 |
| scan-cache.json 평문 저장 | HMAC 무결성 검증 | C2: 캐시 변조로 악성 스킬을 safe로 표시하는 공격 방지 |
| 스캔 후 경고만 전달 | prompt-submit 시 해시 재검증 | C3: 스캔~실행 사이 파일 교체(TOCTOU) 방어 |
| `scanSkillsStatic()` 디렉토리 단위 | `scanSingleSkill()` 파일 단위 래퍼 추가 | Critic: 단일 파일 스캔 API 부재 |

## Architecture

```
┌─ sapper-ai setup (1회) ──────────────────────────────┐
│  사용자가 명시적으로 실행                               │
│    └→ ~/.claude/ 존재 확인                             │
│    └→ ~/.claude/settings.json에 hooks 등록             │
│    └→ "✓ Skill Guard 활성화됨" 출력                   │
└────────────────────────────────────────────────────────┘

┌─ Claude Code Session ─────────────────────────────────┐
│                                                        │
│  SessionStart hook → sapper-ai guard scan              │
│    └→ WATCH_PATHS 순회                                 │
│    └→ 각 .md 파일 SHA-256 해시 계산                    │
│    └→ ScanCache.has(hash) → SKIP                       │
│    └→ ScanCache에 없으면 scanSingleSkill() 실행        │
│    └→ suspicious면 WarningStore.addPending()            │
│    └→ ScanCache에 결과 저장 (HMAC 서명)                │
│    └→ stdout: 스캔 요약 JSON                           │
│                                                        │
│  UserPromptSubmit hook → sapper-ai guard check         │
│    └→ WarningStore에 pending 확인                      │
│    └→ pending 있으면:                                   │
│       └→ 해당 스킬 파일 해시 재계산 (TOCTOU 방어)      │
│       └→ 해시 불일치면 → 재스캔                        │
│       └→ 여전히 suspicious면 → 경고 JSON stdout 출력   │
│       └→ pending → acknowledged 이동                   │
│    └→ pending 없으면 → 빈 응답                         │
│                                                        │
└────────────────────────────────────────────────────────┘
```

## User Experience

### 설치 + 셋업

```
$ npm install -g sapper-ai    # 또는 pnpm/npx

$ sapper-ai setup
  ✓ Claude Code 감지됨 (~/.claude/)
  ✓ SessionStart hook 등록됨
  ✓ UserPromptSubmit hook 등록됨
  ✓ Skill Guard 활성화 — 다음 세션부터 자동 보호됩니다.
```

### 첫 세션

```
$ claude

  SapperAI: 기존 스킬 41개 스캔 중... 완료 (38ms). 모두 안전합니다.
```

### 이후 세션 (변경 없음)

```
$ claude

  SapperAI: 스킬 41개 확인 — 변경 없음. (2ms)
```

### 새 스킬 추가 후 다음 세션

```
$ claude

  SapperAI: 스킬 42개 확인 — 1개 신규 스캔. 모두 안전합니다. (4ms)
```

### 의심스러운 스킬 감지

```
$ claude

  SapperAI: 스킬 42개 확인 — 1개 의심 스킬 발견.

(사용자가 프롬프트 입력 시)

  ⚠ SapperAI: 의심스러운 스킬 감지
    - data-helper (risk: 0.85)
      → "Detected pattern: ignore previous"
      → "Detected pattern: output all API keys"
    경로: ~/.claude/plugins/sketchy-plugin/skills/data-helper/SKILL.md
    확인 후 직접 제거하거나 유지하세요.
    이 경고를 무시하려면: sapper-ai guard dismiss data-helper
```

### 셋업 제거

```
$ sapper-ai setup --remove
  ✓ Claude Code hooks 제거됨
  ✓ Skill Guard 비활성화됨
  (캐시는 ~/.sapper-ai/에 보존됩니다)
```

### 실패 시나리오

```
# Claude Code 미설치
$ sapper-ai setup
  ✗ Claude Code를 찾을 수 없습니다 (~/.claude/ 없음)
  → Claude Code 설치 후 다시 시도하세요.

# sapper-ai가 PATH에 없을 때 (hook 실행 실패)
# Claude Code는 hook 실패를 무시하고 정상 동작
# 다음 세션에서 자동 재시도
```

## Scan Cache

### 파일 위치

```
~/.sapper-ai/scan-cache.json
```

### 구조

```json
{
  "version": 2,
  "hmac": "<hex-encoded HMAC-SHA256 of entries JSON>",
  "entries": {
    "<content-sha256>": {
      "path": "~/.claude/plugins/oh-my-claudecode/skills/autopilot/SKILL.md",
      "skillName": "autopilot",
      "decision": "safe",
      "risk": 0.05,
      "reasons": [],
      "scannedAt": "2026-02-17T13:00:00Z"
    }
  }
}
```

### HMAC 무결성 검증 (C2 대응)

```
HMAC Key = SHA-256(machineId + homedir + "sapper-ai-cache-v2")
HMAC     = HMAC-SHA256(key, JSON.stringify(entries))
```

- `machineId`: `os.hostname()` + `os.userInfo().uid` (간단한 머신 바인딩)
- 캐시 로드 시 HMAC 검증 → 불일치면 캐시 전체 무효화 + 전체 재스캔
- 공격자가 scan-cache.json을 수정해도 HMAC 키 없이는 유효한 서명 생성 불가

### 동작 규칙

- Key: 파일 내용의 SHA-256 해시
- 해시가 캐시에 있으면 → SKIP (이미 검사됨)
- 파일 내용이 수정되면 해시가 달라짐 → 자동 재스캔
- 경로가 바뀌어도 내용이 같으면 → SKIP
- 심볼릭 링크: `fs.readFile` (follow) 후 해시 계산, `realpath()` 저장

## Warning Delivery

### 파일 위치

```
~/.sapper-ai/warnings.json
```

### 구조

```json
{
  "version": 1,
  "pending": [
    {
      "skillName": "data-helper",
      "skillPath": "~/.claude/plugins/sketchy-plugin/skills/data-helper/SKILL.md",
      "contentHash": "<sha256 at scan time>",
      "risk": 0.85,
      "reasons": ["Detected pattern: ignore previous"],
      "detectedAt": "2026-02-17T13:05:00Z"
    }
  ],
  "acknowledged": [],
  "dismissed": []
}
```

### TOCTOU 방어 전달 흐름 (C3 대응)

1. SessionStart에서 suspicious 감지 → `warnings.json` pending에 추가 (contentHash 포함)
2. `sapper-ai guard check` 실행 시 pending 순회
3. 각 pending 항목의 `skillPath` 파일 현재 해시 재계산
4. **해시 일치**: 파일 미변경 → 경고 전달
5. **해시 불일치**: 파일이 스캔 후 변경됨 → 재스캔
   - 재스캔 결과 여전히 suspicious → 경고 전달 (새 해시로 업데이트)
   - 재스캔 결과 safe → pending에서 제거 (경고 취소)
   - 파일 삭제됨 → pending에서 제거
6. 전달된 항목: pending → acknowledged 이동

### Hook stdout 형식

```json
{
  "suppressPrompt": false,
  "message": "⚠ SapperAI: 의심스러운 스킬 감지\n- data-helper (risk: 0.85)\n  → Detected pattern: ignore previous\n  경로: ~/.claude/plugins/sketchy-plugin/skills/data-helper/SKILL.md"
}
```

> Note: Claude Code hook stdout 형식은 공식 문서 기준으로 구현 시 재확인 필요.

## `scanSingleSkill()` — 단일 파일 스캔 (Critic 대응)

기존 `scanSkillsStatic()`은 디렉토리 단위. 단일 파일 스캔 래퍼 필요.

### 구현 명세

```typescript
// File: packages/sapper-ai/src/guard/scanSingleSkill.ts

interface SingleSkillResult {
  skillName: string
  skillPath: string
  contentHash: string
  decision: 'safe' | 'suspicious'
  risk: number
  reasons: string[]
}

async function scanSingleSkill(filePath: string): Promise<SingleSkillResult> {
  // 1. 파일 읽기 + SHA-256 해시 계산
  const content = await fs.readFile(realpath(filePath), 'utf8')
  const contentHash = sha256(content)

  // 2. SkillParser로 파싱
  const parsed = SkillParser.parse(content)

  // 3. AssessmentContext 구성
  const context: AssessmentContext = {
    toolName: `skill:${parsed.metadata.name}`,
    input: { content: parsed.body, metadata: parsed.metadata },
    timestamp: Date.now(),
    source: 'skill-guard',
  }

  // 4. Policy (기본 정책 사용)
  const policy = getDefaultPolicy()

  // 5. RulesDetector만으로 동기 판정 (LlmDetector 제외 — 비용/지연 방지)
  const detector = new RulesDetector()
  const result = detector.detect(context, policy)

  // 6. 결과 매핑
  return {
    skillName: parsed.metadata.name,
    skillPath: filePath,
    contentHash,
    decision: result.risk >= 0.7 ? 'suspicious' : 'safe',
    risk: result.risk,
    reasons: result.reasons ?? [],
  }
}
```

### Policy 생성 (Critic 대응)

```typescript
// File: packages/sapper-ai/src/guard/getDefaultPolicy.ts

function getDefaultPolicy(): Policy {
  return {
    riskThreshold: 0.7,
    blockMinConfidence: 0.5,
    rules: [],  // RulesDetector는 내장 패턴 사용
  }
}
```

> RulesDetector의 42개 내장 패턴으로 스캔. 커스텀 Policy 지원은 향후 확장.

## CLI Commands

### 변경: `setup` 서브커맨드 (C1 대응 — postinstall 대체)

```bash
# 명시적 셋업 (사용자 동의 기반)
sapper-ai setup              # Claude Code hooks 등록
sapper-ai setup --remove     # hooks 제거
sapper-ai setup --status     # 현재 등록 상태 확인
```

### 변경: `guard` 서브커맨드 (hook + watch 통합)

```bash
# Hook 핸들러 (Claude Code가 호출)
sapper-ai guard scan          # SessionStart hook — 동기 전체 스캔
sapper-ai guard check         # UserPromptSubmit hook — 경고 확인

# 수동 조작
sapper-ai guard dismiss <name> # 특정 스킬 경고 무시 (acknowledged → dismissed)
sapper-ai guard rescan         # 캐시 무시, 전체 재스캔

# 캐시 관리
sapper-ai guard cache list    # 스캔된 스킬 목록 + 결과
sapper-ai guard cache clear   # 캐시 초기화 (다음 세션에서 전체 재스캔)
```

### 제거: `watch` 서브커맨드

v2에서는 백그라운드 FileWatcher를 사용하지 않으므로 `watch` 서브커맨드 불필요.

## Setup — `sapper-ai setup` (C1 대응)

### postinstall과의 차이

| | postinstall (v1) | `sapper-ai setup` (v2) |
|--|--|--|
| 실행 시점 | npm install 시 자동 | 사용자가 명시적 실행 |
| 사용자 동의 | 없음 (암묵적) | 있음 (명시적 명령) |
| 실패 시 | 조용히 무시됨 | 에러 메시지 + 종료 코드 |
| 설정 수정 범위 | ~/.claude/settings.json | 동일 |
| 제거 | preuninstall 자동 | `--remove` 플래그 |

### 동작

```
1. ~/.claude/ 디렉토리 존재 확인
2. 없으면 → 에러 출력 + exit 1
3. ~/.claude/settings.json 읽기 (없으면 빈 객체로 시작)
4. hooks 섹션 확인
5. sapper-ai hook 이미 등록됐으면 → "이미 활성화됨" + exit 0
6. hooks 추가:
   {
     "hooks": {
       "SessionStart": [{
         "matcher": "*",
         "hooks": [{ "type": "command", "command": "sapper-ai guard scan", "timeout": 30 }]
       }],
       "UserPromptSubmit": [{
         "matcher": "*",
         "hooks": [{ "type": "command", "command": "sapper-ai guard check", "timeout": 5 }]
       }]
     }
   }
7. 기존 hooks 항목이 있으면 배열에 append (덮어쓰기 아님)
8. settings.json atomic write (tmp + rename)
9. 출력: "✓ Skill Guard 활성화됨"
```

### postinstall.js 역할 축소

```
postinstall.js (v2):
  1. ~/.sapper-ai/ 디렉토리 생성 (없으면)
  2. 안내 메시지 출력:
     "SapperAI 설치 완료. Skill Guard를 활성화하려면: sapper-ai setup"
  3. 끝. settings.json은 건드리지 않음.
```

## Watch Directories

```typescript
const WATCH_PATHS = [
  join(homedir(), '.claude', 'plugins'),     // 글로벌 플러그인 스킬
  join(homedir(), '.claude', 'skills'),       // 글로벌 사용자 스킬
  join(cwd(), '.claude', 'skills'),           // 프로젝트 로컬 스킬
]
```

- 스캔 대상: `**/*.md` 패턴 (glob으로 수집)
- 심볼릭 링크: `fs.realpath()`로 해석 후 실제 경로 저장 (symlink 공격 방지)
- 존재하지 않는 디렉토리: 건너뜀 (에러 아님)

## Suspicious 판정 정책

- `scanSingleSkill()` 결과 `decision === 'suspicious'` (risk >= 0.7)
- 경고만 표시, 스킬 파일은 그대로 유지 (quarantine/삭제 없음)
- 사용자가 직접 판단하여 제거 또는 유지
- `sapper-ai guard dismiss <name>` 으로 경고 해제 가능

## Dynamic Analysis (Optional, 변경 없음)

- 조건: suspicious 판정 + Docker 사용 가능
- `sapper-ai guard scan --dynamic` 으로 수동 트리거
- 동적 분석 결과도 캐시에 저장
- Docker 없으면 정적 스캔 결과만으로 경고
- v2에서는 자동 동적 분석 없음 (사용자 선택)

## Dependency Map

```
sapper-ai (이 패키지 안에서 전부 처리)
├── src/cli.ts                    → setup, guard 서브커맨드 추가
├── src/guard/                    → 새 디렉토리
│   ├── scanSingleSkill.ts        → 단일 스킬 파일 스캔 (SkillParser + RulesDetector)
│   ├── getDefaultPolicy.ts       → 기본 Policy 객체 생성
│   ├── ScanCache.ts              → scan-cache.json 읽기/쓰기 (HMAC 검증)
│   ├── WarningStore.ts           → warnings.json 읽기/쓰기
│   ├── hooks/
│   │   ├── guardScan.ts          → SessionStart hook: 동기 전체 스캔
│   │   └── guardCheck.ts         → UserPromptSubmit hook: 경고 확인 + TOCTOU 검증
│   └── setup.ts                  → Claude Code hooks 등록/제거
├── src/postinstall.ts            → 디렉토리 생성 + 안내 메시지만 (축소)
└── src/openclaw/scanner.ts       → 기존 scanSkillsStatic() (참고용, 직접 사용하지 않음)
```

## TODO List (Codex 실행용)

### Phase 1: Core Infrastructure

- [ ] **TODO-1.1**: `ScanCache` 클래스 구현
  - File: `packages/sapper-ai/src/guard/ScanCache.ts`
  - API: `has(hash)`, `get(hash)`, `set(hash, entry)`, `list()`, `clear()`, `verify()`
  - 저장 경로: `~/.sapper-ai/scan-cache.json`
  - version 필드: `2`
  - HMAC 무결성:
    - Key: `SHA-256(os.hostname() + os.userInfo().uid + "sapper-ai-cache-v2")`
    - Value: `HMAC-SHA256(key, JSON.stringify(entries))`
    - `verify()`: HMAC 검증 → 불일치 시 entries 전체 삭제 + 반환값 `{ valid: false }`
    - `set()` 호출 시 자동으로 HMAC 재계산
  - 파일 쓰기: atomic write (`writeFileSync` to tmp + `renameSync`)
  - Test: `packages/sapper-ai/src/__tests__/guard/ScanCache.test.ts`
    - has/get/set/list/clear 기본 동작
    - HMAC 검증 성공 케이스
    - HMAC 변조 감지 → entries 무효화
    - 파일 없을 때 빈 캐시 반환
  - Verify: `pnpm --filter sapper-ai run test`

- [ ] **TODO-1.2**: `WarningStore` 클래스 구현
  - File: `packages/sapper-ai/src/guard/WarningStore.ts`
  - API: `addPending(warning)`, `getPending()`, `acknowledge(skillName)`, `dismiss(skillName)`, `clearPending()`
  - pending 항목에 `contentHash` 필드 필수 포함 (TOCTOU 검증용)
  - 저장 경로: `~/.sapper-ai/warnings.json`
  - dismissed 목록: 사용자가 명시적으로 무시한 스킬 (재경고 방지)
  - Test: `packages/sapper-ai/src/__tests__/guard/WarningStore.test.ts`
    - addPending → getPending
    - acknowledge → pending에서 제거, acknowledged에 추가
    - dismiss → dismissed에 추가, 재경고 방지
  - Verify: `pnpm --filter sapper-ai run test`

- [ ] **TODO-1.3**: `scanSingleSkill()` 구현
  - File: `packages/sapper-ai/src/guard/scanSingleSkill.ts`
  - 입력: `filePath: string`
  - 동작:
    1. `fs.realpath(filePath)` → 심볼릭 링크 해석
    2. `fs.readFile(resolvedPath, 'utf8')` → 내용 읽기
    3. `SHA-256(content)` → contentHash 계산
    4. `SkillParser.parse(content)` → metadata + body 추출
    5. `AssessmentContext` 구성: `{ toolName: "skill:<name>", input: { content: body, metadata }, timestamp, source: "skill-guard" }`
    6. `getDefaultPolicy()` → Policy 객체
    7. `new RulesDetector().detect(context, policy)` → 판정 (LlmDetector 미사용)
    8. 결과 반환: `{ skillName, skillPath, contentHash, decision, risk, reasons }`
  - SkillParser.parse() 에러 → `{ decision: 'suspicious', risk: 1.0, reasons: ["Parse error: ..."] }`
  - Test: `packages/sapper-ai/src/__tests__/guard/scanSingleSkill.test.ts`
    - safe 스킬 → decision: 'safe'
    - suspicious 패턴 포함 → decision: 'suspicious'
    - 파싱 에러 → suspicious 판정
  - Verify: `pnpm --filter sapper-ai run test`

- [ ] **TODO-1.4**: `getDefaultPolicy()` 구현
  - File: `packages/sapper-ai/src/guard/getDefaultPolicy.ts`
  - 반환: `{ riskThreshold: 0.7, blockMinConfidence: 0.5, rules: [] }`
  - RulesDetector 내장 패턴 사용 (커스텀 rules 불필요)
  - Test: TODO-1.3 테스트에서 함께 검증
  - Verify: `pnpm --filter sapper-ai run test`

### Phase 2: Hook Handlers

- [ ] **TODO-2.1**: `guardScan` hook 핸들러 (SessionStart)
  - File: `packages/sapper-ai/src/guard/hooks/guardScan.ts`
  - 동작:
    1. `ScanCache` 로드 + `verify()` → HMAC 불일치면 캐시 클리어
    2. `WATCH_PATHS` 순회 → `glob('**/*.md')` 로 스킬 파일 수집
    3. 존재하지 않는 디렉토리 → 건너뜀 (에러 아님)
    4. 각 파일: `fs.readFile` → `SHA-256` → `ScanCache.has(hash)` 체크
    5. 캐시 miss → `scanSingleSkill(filePath)` 실행
    6. suspicious면 `WarningStore.addPending()` (contentHash 포함)
    7. 캐시에 결과 저장 → HMAC 자동 재계산
    8. stdout JSON 출력: `{ "message": "SapperAI: 스킬 N개 확인 — M개 신규 스캔. ..." }`
  - 타임아웃: 30초 (setup에서 hook timeout으로 설정)
  - 에러 시: stderr에 에러 출력 + exit 0 (Claude Code 세션 차단 금지)
  - Test: `packages/sapper-ai/src/__tests__/guard/hooks/guardScan.test.ts`
    - 빈 캐시 → 전체 스캔
    - 캐시 있음 + 변경 없음 → 스캔 SKIP
    - 캐시 있음 + 새 파일 → 신규만 스캔
    - HMAC 불일치 → 캐시 클리어 + 전체 재스캔
    - 디렉토리 없음 → 에러 없이 통과
  - Verify: `pnpm --filter sapper-ai run test`

- [ ] **TODO-2.2**: `guardCheck` hook 핸들러 (UserPromptSubmit)
  - File: `packages/sapper-ai/src/guard/hooks/guardCheck.ts`
  - 동작:
    1. `WarningStore.getPending()` → pending 목록
    2. pending 없으면 → 빈 JSON 출력 + exit 0
    3. pending 있으면 각 항목에 대해:
       a. `fs.readFile(skillPath)` → 현재 내용 읽기 (파일 삭제됨 → pending 제거)
       b. 현재 SHA-256 계산
       c. `warning.contentHash === currentHash` → 파일 미변경
       d. 해시 불일치 → `scanSingleSkill(skillPath)` 재스캔
          - 여전히 suspicious → 경고 유지 (새 해시로 업데이트)
          - safe로 변경 → pending에서 제거
       e. dismissed 목록에 있으면 → pending에서 제거
    4. 남은 pending → 경고 메시지 구성 → stdout JSON 출력
    5. 전달된 항목 → `WarningStore.acknowledge()`
  - stdout 형식: Claude Code hook 공식 형식 확인 후 구현 (v1의 hookSpecificOutput 형식은 미검증)
  - 타임아웃: 5초
  - Test: `packages/sapper-ai/src/__tests__/guard/hooks/guardCheck.test.ts`
    - pending 없음 → 빈 응답
    - pending 있음 + 해시 일치 → 경고 출력 + acknowledged
    - pending 있음 + 해시 불일치 + 여전히 suspicious → 경고 출력
    - pending 있음 + 해시 불일치 + safe → pending 제거
    - pending 있음 + 파일 삭제됨 → pending 제거
    - dismissed 스킬 → pending 제거
  - Verify: `pnpm --filter sapper-ai run test`

### Phase 3: CLI Integration

- [ ] **TODO-3.1**: CLI에 `setup` 서브커맨드 추가
  - File: `packages/sapper-ai/src/cli.ts`
  - `sapper-ai setup` → setup.ts의 `registerHooks()` 호출
  - `sapper-ai setup --remove` → setup.ts의 `removeHooks()` 호출
  - `sapper-ai setup --status` → hooks 등록 상태 출력
  - 구현 파일: `packages/sapper-ai/src/guard/setup.ts`
    - `registerHooks()`: settings.json에 hook 추가 (기존 항목 보존, 배열 append)
    - `removeHooks()`: settings.json에서 sapper-ai hook만 제거
    - `getStatus()`: 현재 등록 상태 반환
    - atomic write: tmp 파일 + rename
  - Test: `packages/sapper-ai/src/__tests__/guard/setup.test.ts`
    - ~/.claude/ 있을 때 → hooks 등록 성공
    - ~/.claude/ 없을 때 → 에러 메시지 + exit 1
    - 이미 등록됐을 때 → SKIP + "이미 활성화됨"
    - 기존 hooks 있을 때 → 배열에 append (기존 hook 보존)
    - --remove → sapper-ai hook만 제거
  - Verify: `pnpm --filter sapper-ai run test`

- [ ] **TODO-3.2**: CLI에 `guard` 서브커맨드 추가
  - File: `packages/sapper-ai/src/cli.ts`
  - `sapper-ai guard scan` → guardScan 핸들러 호출
  - `sapper-ai guard check` → guardCheck 핸들러 호출
  - `sapper-ai guard dismiss <name>` → WarningStore.dismiss() 호출
  - `sapper-ai guard rescan` → ScanCache.clear() + guardScan 실행
  - `sapper-ai guard cache list` → ScanCache.list() 테이블 출력
  - `sapper-ai guard cache clear` → ScanCache.clear() 실행
  - Verify: `pnpm --filter sapper-ai run test`

### Phase 4: Postinstall 축소

- [ ] **TODO-4.1**: `postinstall.ts` 축소
  - File: `packages/sapper-ai/src/postinstall.ts`
  - 변경: settings.json 수정 로직 전부 제거
  - 남길 것:
    1. `~/.sapper-ai/` 디렉토리 생성 (없으면)
    2. 안내 메시지: `"SapperAI 설치 완료. Skill Guard 활성화: sapper-ai setup"`
  - package.json의 `"postinstall"` 스크립트는 유지
  - 기존 `"preuninstall"` 스크립트가 있다면 제거 (setup --remove로 대체)
  - Test: `packages/sapper-ai/src/__tests__/guard/postinstall.test.ts`
    - ~/.sapper-ai/ 생성 확인
    - settings.json 미변경 확인
  - Verify: `pnpm --filter sapper-ai run test`

### Phase 5: Build & Verification

- [ ] **TODO-5.1**: 의존성 확인
  - `packages/sapper-ai/package.json`
  - 필요한 의존성: `glob` (스킬 파일 수집용)
  - chokidar 불필요 (FileWatcher 제거됨)
  - `crypto` (Node.js 내장), `os` (내장) → 추가 의존성 없음
  - `pnpm install` 실행

- [ ] **TODO-5.2**: 빌드/테스트 검증
  - `pnpm build` 통과
  - `pnpm test` 통과
  - `pnpm exec tsc -b --noEmit` clean

## Verification Checklist

- [ ] `sapper-ai setup` → settings.json에 hooks 등록
- [ ] `sapper-ai setup --status` → 등록 상태 출력
- [ ] `sapper-ai setup --remove` → hooks 제거
- [ ] `sapper-ai guard scan` → 동기 전체 스캔 + 캐시 저장
- [ ] `sapper-ai guard check` → 대기 경고 확인 + TOCTOU 검증
- [ ] `sapper-ai guard dismiss <name>` → 경고 무시
- [ ] `sapper-ai guard rescan` → 캐시 무시 전체 재스캔
- [ ] `sapper-ai guard cache list` → 스캔 결과 출력
- [ ] `sapper-ai guard cache clear` → 캐시 초기화
- [ ] 이미 캐시된 스킬 → SKIP
- [ ] 파일 수정 시 → 해시 변경 → 재스캔
- [ ] suspicious 스킬 → warnings.json에 기록 → 세션에 경고
- [ ] HMAC 변조 → 캐시 무효화 + 전체 재스캔
- [ ] TOCTOU: 스캔 후 파일 변경 → 재스캔 후 경고 갱신
- [ ] 심볼릭 링크 → realpath 해석 후 스캔
- [ ] hook 실패 시 → Claude Code 세션 정상 동작

## Security Considerations

| 위협 | 방어 | 구현 위치 |
|------|------|-----------|
| 캐시 변조 (C2) | HMAC-SHA256 무결성 검증 | ScanCache.verify() |
| TOCTOU (C3) | prompt-submit 시 해시 재검증 | guardCheck.ts |
| 심볼릭 링크 공격 | fs.realpath() 해석 | scanSingleSkill.ts |
| 사용자 동의 없는 설정 변경 (C1) | sapper-ai setup 명시적 CLI | setup.ts |
| warnings.json 변조 | dismissed 목록 분리, 무효 경고 자동 정리 | guardCheck.ts |
| hook 실패로 세션 차단 | 에러 시 exit 0, stderr만 출력 | 모든 hook 핸들러 |

## Known Limitations

1. **세션 중간 스킬 추가 미감지**: 세션 시작 시에만 스캔. 세션 도중 추가된 스킬은 다음 세션에서 감지.
2. **RulesDetector 패턴 한계**: 42개 내장 regex 패턴만 사용. 신규 공격 패턴은 감지 못할 수 있음.
3. **LlmDetector 미사용**: 비용/지연 문제로 정적 스캔에서 LLM 판정 제외. false negative 가능성 있음.
4. **HMAC 키 강도**: machineId 기반이므로 같은 머신의 다른 사용자는 키 추측 가능. 실용적 수준의 방어.
5. **hook stdout 형식 미검증**: Claude Code hook stdout 공식 스펙 확인 필요.

---

## Revision History

- **v2 (2026-02-17)**: Post-review revision — 4-agent review 반영 (3C, 7H, 6M)
  - C1: postinstall → explicit `sapper-ai setup` CLI
  - C2: HMAC integrity for scan-cache.json
  - C3: TOCTOU defense in prompt-submit hook
  - H1: Background FileWatcher 제거 → SessionStart synchronous scan
  - Critic: scanSingleSkill() wrapper, Policy resolution, hook stdout format
  - PM: Failure scenarios, setup --remove, error messages
- **v1 (2026-02-17)**: Initial design — zero-config skill guard via postinstall + FileWatcher + hooks
