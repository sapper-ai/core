# Scan 자동 HTML 리포트 생성

## Context

현재 스캔 결과를 HTML로 보려면 `--report` 플래그를 별도로 입력해야 한다.
유저가 스캔 후 JSON 경로만 받으면 "이걸 어떻게 보라는 거지?"가 되어 UX가 나쁘다.

**변경 목표**: 스캔 완료 시 항상 HTML 리포트를 자동 생성하고 브라우저에서 열어준다.

## TODO

### 1. `ScanOptions`에서 `report` 제거, `noOpen` 추가

**파일**: `packages/sapper-ai/src/scan.ts:21-30`

**현재**:
```typescript
export interface ScanOptions {
  targets?: string[]
  fix?: boolean
  deep?: boolean
  system?: boolean
  scopeLabel?: string
  ai?: boolean
  report?: boolean   // ← 제거
  noSave?: boolean
}
```

**변경**:
```typescript
export interface ScanOptions {
  targets?: string[]
  fix?: boolean
  deep?: boolean
  system?: boolean
  scopeLabel?: string
  ai?: boolean
  noSave?: boolean
  noOpen?: boolean   // ← 추가: 브라우저 자동 오픈 억제
}
```

---

### 2. `runScan()`에서 HTML 리포트를 항상 자동 생성

**파일**: `packages/sapper-ai/src/scan.ts:648-703`

**현재**: JSON 저장 (기본) → HTML 리포트 (`if (options.report)` 일 때만)

**변경**: JSON과 HTML을 함께 저장하고, 브라우저를 자동 오픈한다.

```typescript
// JSON + HTML 저장 (noSave가 아닐 때)
if (options.noSave !== true) {
  const scanDir = join(homedir(), '.sapperai', 'scans')
  await mkdir(scanDir, { recursive: true })
  const ts = new Date().toISOString().replace(/[:.]/g, '-')

  // JSON 저장
  const jsonPath = join(scanDir, `${ts}.json`)
  await writeFile(jsonPath, JSON.stringify(scanResult, null, 2), 'utf8')

  // HTML 저장
  const { generateHtmlReport } = await import('./report')
  const html = generateHtmlReport(scanResult)
  const htmlPath = join(scanDir, `${ts}.html`)
  await writeFile(htmlPath, html, 'utf8')

  console.log(`  Saved to ${jsonPath}`)
  console.log(`  Report: ${htmlPath}`)
  console.log()

  // 브라우저 자동 오픈
  if (options.noOpen !== true) {
    try {
      const { execFile } = await import('node:child_process')
      if (process.platform === 'win32') {
        execFile('cmd', ['/c', 'start', '', htmlPath])
      } else {
        const openCmd = process.platform === 'darwin' ? 'open' : 'xdg-open'
        execFile(openCmd, [htmlPath])
      }
    } catch {}
  }
}
```

**핵심 변경점**:
- `if (options.report)` 블록 전체 삭제
- HTML 파일 위치: `process.cwd()/sapper-report.html` → `~/.sapperai/scans/{timestamp}.html` (JSON과 같은 디렉토리)
- `--no-save` 시 JSON, HTML 모두 저장 안 함 + 브라우저 안 열림

---

### 3. `cli.ts`에서 `--report` 제거, `--no-open` 추가

**파일**: `packages/sapper-ai/src/cli.ts`

#### 3-1. `printUsage()` (라인 49-69)

```diff
- sapper-ai scan --report     Generate HTML report and open in browser
+ sapper-ai scan --no-open    Skip opening report in browser
```

#### 3-2. `parseScanArgs()` (라인 71-129)

- 반환 타입에서 `report` 제거, `noOpen` 추가
- `let report = false` → `let noOpen = false`
- `--report` 분기 → `--no-open` 분기로 교체
- 반환값: `{ targets, fix, deep, system, ai, noSave, noOpen }`

#### 3-3. `resolveScanOptions()` (라인 168-232)

- `common` 객체에서 `report: args.report` → `noOpen: args.noOpen`

---

### 4. 테스트 수정

**파일**: `packages/sapper-ai/src/__tests__/scan.test.ts`

#### 4-1. 기존 `saves JSON results` 테스트 확장 (라인 169-190)

JSON과 HTML이 모두 생성되는지 확인:

```typescript
it('saves JSON and HTML results by default and respects --no-save', async () => {
  // ... 기존 setup ...
  const code1 = await runScan({ targets: [targetDir], fix: false })
  expect(code1).toBe(0)
  const scanDir = join(home, '.sapperai', 'scans')
  expect(existsSync(scanDir)).toBe(true)

  // JSON과 HTML 모두 존재 확인
  const files = readdirSync(scanDir)
  const jsonFiles = files.filter(f => f.endsWith('.json'))
  const htmlFiles = files.filter(f => f.endsWith('.html'))
  expect(jsonFiles.length).toBe(1)
  expect(htmlFiles.length).toBe(1)

  // HTML 파일 내용 확인
  const htmlContent = readFileSync(join(scanDir, htmlFiles[0]!), 'utf8')
  expect(htmlContent.startsWith('<!DOCTYPE html>')).toBe(true)

  // --no-save: JSON과 HTML 모두 저장 안 됨
  const code2 = await runScan({ targets: [targetDir], fix: false, noSave: true })
  expect(code2).toBe(0)
  // scanDir의 파일 수 변화 없음 확인
  const filesAfter = readdirSync(scanDir)
  expect(filesAfter.length).toBe(files.length)
})
```

**참고**: `readdirSync`를 import에 추가 필요 (`import { ..., readdirSync } from 'node:fs'`)

#### 4-2. 기존 `--report` 통합 테스트가 있으면 삭제 또는 수정

`--report` 플래그는 더 이상 존재하지 않으므로, 해당 테스트가 있다면 삭제.

---

### 5. `report.test.ts` 수정 불필요

`generateHtmlReport()` 함수 자체는 변경 없음. 기존 테스트 그대로 유지.

---

## Verification

```bash
# 1. 빌드
pnpm --filter sapper-ai build

# 2. 테스트
pnpm --filter sapper-ai test

# 3. 수동 확인
npx sapper-ai scan .
# → JSON과 HTML이 ~/.sapperai/scans/에 저장되고 브라우저 자동 오픈

npx sapper-ai scan . --no-save
# → 터미널 출력만, 파일 저장 없음, 브라우저 안 열림

npx sapper-ai scan . --no-open
# → JSON과 HTML 저장되지만 브라우저는 안 열림
```
