# CLI 출력 리디자인

**작성일**: 2026-02-15
**스타일 참고**: Vercel CLI
**색상**: 흑백 + olive green (#6B8E23) 강조, red (위험), yellow (경고)
**심볼**: 텍스트만, 아이콘/이모지 없음
**범위**: postinstall, scan 출력만 (harden은 후순위, auth는 별도 계획)

---

## 디자인 원칙

1. **미니멀**: 불필요한 텍스트 제거, 여백으로 구분
2. **일관성**: 모든 명령어 동일한 헤더 패턴 (`sapper-ai <command>`)
3. **색상 절제**: olive green 강조, dim white 보조, red/yellow는 위험도만
4. **Vercel 패턴**: 유니코드 박스 제거, 정렬된 컬럼 테이블

---

## 색상 팔레트

```
# Truecolor (COLORTERM=truecolor 또는 COLORTERM=24bit일 때)
OLIVE   = \x1b[38;2;107;142;35m   (#6B8E23)

# Fallback (truecolor 미지원 터미널)
OLIVE   = \x1b[32m                 (표준 green)

# 공통
DIM     = \x1b[2m
BOLD    = \x1b[1m
RED     = \x1b[31m
YELLOW  = \x1b[33m
RESET   = \x1b[0m
```

**색상 비활성화 조건** (우선순위 순):
1. `NO_COLOR` 환경변수 존재 (https://no-color.org/ 표준)
2. `--no-color` CLI 플래그
3. `process.stdout.isTTY !== true` (파이프/CI)

---

## 1. postinstall 메시지

**파일**: `packages/sapper-ai/src/postinstall.ts`
**영향받는 테스트**: `packages/sapper-ai/src/__tests__/postinstall.test.ts` (라인 11: `expect(output).toMatch(/SapperAI installed\./)`)

**현재:**
```
SapperAI installed. Run 'npx sapper-ai scan' and follow the prompts to harden your setup.
```

**변경:**
```

  sapper-ai v0.6.0                    ← olive + dim

  Run npx sapper-ai scan to get started.

```

**구현 참고:**
- version은 `import pkg from '../package.json'`으로 접근 (기존 `harden.ts:6` 패턴)
- 기존 `try/catch` 패턴 유지 (절대 throw하지 않아야 함)

---

## 2. scan 출력

**파일**: `packages/sapper-ai/src/scan.ts`

### 2-A. 스캔 시작

**현재** (라인 571-587):
```
  SapperAI Security Scanner

  Scope: Current + subdirectories

  Collecting files...  1,245 files found
  Filter: config-like only (42 eligible / 1,245 total)
```

**변경:**
```

  sapper-ai scan                      ← olive + white

  Scanning 42 files...                ← dim

```

### 2-B. 위협 발견 시 결과 테이블

**현재** (`renderFindingsTable()` 함수, 라인 255-304):
```
  ┌───┬──────────────────────────────┬──────┬────────────────────┐
  │ # │ File                         │ Risk │ Pattern            │
  ├───┼──────────────────────────────┼──────┼────────────────────┤
  │ 1 │ scripts/deploy.sh            │ 0.95 │ rm rf root         │
  └───┴──────────────────────────────┴──────┴────────────────────┘
```

**변경:**
```
  File                         Risk    Pattern
  scripts/deploy.sh            0.95    rm rf root
  plugins/eval-helper.js       0.85    eval user input
```

**스타일 규칙:**
- 헤더 행 (`File`, `Risk`, `Pattern`): dim
- 파일명: white
- Risk 값: `>= 0.8` red bold, `0.5~0.8` yellow, `< 0.5` dim
- Pattern: dim
- `#` 컬럼 제거

**ANSI-aware 정렬 필수**: 색상 코드가 포함된 문자열의 시각적 너비 계산 시 기존 `stripAnsi()` (라인 206), `padRightVisual()` (라인 244-248) 패턴을 재사용할 것.

### 2-C. 결과 요약

**현재** (라인 779-786):
```
  ⚠ 40/42 eligible files scanned, 2 threats detected (1,245 total files)
```

**변경 (위협 있음):**
```

  2 threats found in 42 files (1,245 total)

  Run npx sapper-ai scan --fix to quarantine.

```

**변경 (위협 없음):**
```

  All clear — 0 threats in 42 files   ← olive green

```

### 2-D. AI 스캔 (`--ai`, 라인 643-727)

```
  Phase 1  rules       42 files
  Phase 2  ai           5 files

  File                         Risk    Pattern              Source
  scripts/deploy.sh            0.95    rm rf root           rules
  config/sneaky.json           0.72    obfuscated payload   ai

  3 threats found in 42 files
```

`Source` 컬럼: `rules`는 dim, `ai`는 olive green

### 2-E. 기존 ANSI 상수 교체

**현재** (라인 85-88):
```typescript
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const RESET = '\x1b[0m'
```

→ 공통 유틸리티에서 import로 교체. 기존 GREEN → OLIVE로 브랜드 색상 통일.

### 2-F. 기존 `riskColor()` 함수 교체

**현재** (라인 200-204):
```typescript
function riskColor(risk: number): string {
  if (risk >= 0.8) return RED
  if (risk >= 0.5) return YELLOW
  return GREEN
}
```

→ 공통 유틸리티로 이동. `risk < 0.5`일 때 `GREEN` → `DIM`으로 변경.

---

## 3. harden 출력 (후순위 — scan 완료 후 진행)

**파일**: `packages/sapper-ai/src/harden.ts`

**주의**: harden.ts는 `write()` 콜백 패턴 사용 (라인 240: `const write = options.write ?? ((text: string) => process.stdout.write(text))`). `console.log` 사용 금지, 기존 `write()` 패턴 유지할 것.

**미리보기:**
```

  sapper-ai harden

  Project: /Users/name/project        ← dim

  Changes:
    + sapperai.config.yaml             ← olive green +
    + .github/workflows/sapperai.yml

  Run npx sapper-ai harden --apply to apply.

```

**적용 후:**
```

  sapper-ai harden

    + sapperai.config.yaml          created
    + .github/workflows/sapperai.yml created

  Done.                                ← olive green

```

---

## 공통 유틸리티

**파일**: `packages/sapper-ai/src/utils/format.ts` (신규)

```typescript
// Truecolor 감지: COLORTERM 환경변수 확인
function supportsTrue color(): boolean

// Color constants (NO_COLOR / --no-color / non-TTY 시 빈 문자열)
export function createColors(options?: { noColor?: boolean }): Colors

interface Colors {
  olive: string
  dim: string
  bold: string
  red: string
  yellow: string
  reset: string
}

// Header: "  sapper-ai <command>"
export function header(command: string, colors: Colors): string

// Risk color by value (>= 0.8 red, 0.5~0.8 yellow, < 0.5 dim)
export function riskColor(risk: number, colors: Colors): string

// Aligned table (Vercel style, no box borders)
// ANSI-aware: stripAnsi 기반 시각적 너비로 정렬
export function table(headers: string[], rows: string[][], colors: Colors): string
```

**`table()` 구현 요구사항:**
- 기존 `stripAnsi()` (scan.ts:206), `padRightVisual()` (scan.ts:244-248) 패턴 재사용
- 색상 코드가 포함된 문자열의 시각적 너비를 정확히 계산하여 컬럼 정렬
- 헤더 행은 dim 색상 적용

---

## Codex TODO List

### Phase 1: 공통 유틸리티 생성

- [ ] **`packages/sapper-ai/src/utils/format.ts` 생성**
  - `createColors()`: `NO_COLOR` env, `noColor` 옵션, `process.stdout.isTTY` 체크. `COLORTERM` 체크하여 truecolor/fallback 분기
  - `header(command, colors)`: `"  {olive}sapper-ai{reset} {command}"` 패턴
  - `riskColor(risk, colors)`: `>= 0.8` red, `0.5~0.8` yellow, `< 0.5` dim
  - `table(headers, rows, colors)`: ANSI-aware 정렬. 기존 `scan.ts`의 `stripAnsi()` (라인 206), `padRightVisual()` (라인 244-248), `truncateToWidth()` (라인 210-237) 함수를 이 파일로 이동
  - 검증: `NO_COLOR=1`일 때 빈 문자열 반환 확인

- [ ] **`--no-color` 플래그 파싱 추가**
  - `parseScanArgs()` (`cli.ts` 라인 140-226): `'--no-color'` 케이스 추가
  - `parseHardenArgs()` (`cli.ts` 라인 228 이후): `'--no-color'` 케이스 추가
  - 파싱된 값을 `createColors({ noColor: true })`로 전달

### Phase 2: postinstall 수정

- [ ] **postinstall 메시지 변경**
  - 파일: `packages/sapper-ai/src/postinstall.ts`
  - `import pkg from '../package.json'` 추가 (기존 `harden.ts:6` 패턴)
  - 메시지: `"  sapper-ai v{version}\n\n  Run npx sapper-ai scan to get started.\n"`
  - olive green 적용 (`sapper-ai` 텍스트), dim (버전)
  - 기존 `try/catch` 패턴 유지

- [ ] **postinstall 테스트 업데이트**
  - 파일: `packages/sapper-ai/src/__tests__/postinstall.test.ts`
  - 라인 11: `expect(output).toMatch(/SapperAI installed\./)` → `expect(output).toMatch(/sapper-ai/)` 로 변경
  - 추가 assertion: version 문자열 포함 확인

### Phase 3: scan 출력 리디자인

- [ ] **scan 헤더 및 시작 메시지 수정**
  - 파일: `packages/sapper-ai/src/scan.ts`
  - 라인 571-587: `"SapperAI Security Scanner"` + `"Scope:"` + `"Collecting files..."` → `header('scan')` + `"Scanning N files..."`
  - `import { createColors, header, table, riskColor } from './utils/format'` 추가

- [ ] **결과 테이블 수정 (`renderFindingsTable()` 함수)**
  - 파일: `packages/sapper-ai/src/scan.ts`, 함수 `renderFindingsTable()` (라인 255-304)
  - 유니코드 박스 (`┌─┬─┐`) 제거 → `table()` 유틸리티 사용
  - `#` 컬럼 제거
  - 헤더 dim, Risk 색상 적용
  - `--ai` 시 `Source` 컬럼 추가

- [ ] **결과 요약 메시지 수정**
  - 파일: `packages/sapper-ai/src/scan.ts`, 라인 779-786
  - `"⚠ N/N eligible files scanned, N threats detected"` → `"N threats found in N files (T total)"`
  - 위협 없을 때: `"All clear — 0 threats in N files"` (olive green)

- [ ] **기존 ANSI 상수 및 함수 정리**
  - `scan.ts` 라인 85-88의 `GREEN`, `YELLOW`, `RED`, `RESET` 상수 → `createColors()` 사용으로 교체
  - `scan.ts` 라인 200-204의 `riskColor()` 함수 → `format.ts`에서 import
  - `scan.ts` 라인 206-253의 `stripAnsi()`, `truncateToWidth()`, `padRight()`, `padRightVisual()`, `padLeft()` → `format.ts`로 이동

- [ ] **scan 테스트 확인**
  - 파일: `packages/sapper-ai/src/__tests__/scan.test.ts`
  - `console.log` mock 패턴이 출력 변경으로 깨지는지 확인
  - 깨지는 assertion이 있으면 새 출력 형식에 맞게 수정

### Phase 4: harden 출력 리디자인 (후순위)

- [ ] **harden 출력 수정**
  - 파일: `packages/sapper-ai/src/harden.ts`
  - **기존 `write()` 콜백 패턴 유지** (`console.log` 사용 금지)
  - 라인 244: `"SapperAI Hardening"` → `header('harden')` 사용
  - `[project]` 태그 + 긴 설명 → `+ filename` (상대 경로) 리스트
  - `+` olive green (새 파일)
  - 적용 후: `+ file  created` / `Done.`
  - 라인 265-332 범위 전체 수정

- [ ] **harden 테스트 확인**
  - harden 관련 테스트 파일에서 출력 형식에 의존하는 assertion 확인 및 수정

### 검증

- [ ] **전체 흐름 수동 테스트**
  - `npx sapper-ai scan` (위협 없음) → 깔끔한 출력 확인
  - `npx sapper-ai scan` (위협 있음) → 테이블 + 요약 확인
  - `NO_COLOR=1 npx sapper-ai scan` → 색상 없이 동작 확인
  - `npx sapper-ai harden` → 미리보기 확인
  - `pnpm test` → 전체 테스트 통과 확인
