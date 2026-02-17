# Skill Guard — Code Review Fix Plan

> Date: 2026-02-17
> Source: 3-agent parallel review (Code Reviewer, Security Reviewer, Code Simplifier)
> Scope: `packages/sapper-ai/src/guard/`, `packages/sapper-ai/src/utils/fs.ts`, `packages/sapper-ai/src/cli.ts`
> Test Baseline: 120/120 pass (23 files, 1.58s)

---

## Summary

| Priority | Count | Source |
|----------|-------|--------|
| P0 (Security Critical) | 3 | Security Reviewer |
| P1 (Security High + Code High) | 3 | Security + Code Reviewer |
| P2 (Medium) | 6 | All agents |
| P3 (Low / Refactor) | 6 | All agents |

---

## P0 — Security Critical (즉시 수정)

### P0.1: HMAC 비교에 `timingSafeEqual` 사용

- **Source**: Security Reviewer CRITICAL #1
- **File**: `packages/sapper-ai/src/guard/ScanCache.ts:201`
- **Issue**: `state.hmac === expectedHmac` 는 일반 문자열 비교(`===`). 첫 불일치 바이트에서 즉시 반환되어 타이밍 사이드 채널 공격으로 HMAC 값 추론 가능.
- **Fix**:
  ```typescript
  // Before
  if (state.version === SCAN_CACHE_VERSION && state.hmac === expectedHmac) {

  // After
  import { timingSafeEqual } from 'node:crypto'

  function hmacEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
  }

  if (state.version === SCAN_CACHE_VERSION && hmacEqual(state.hmac, expectedHmac)) {
  ```
- **Test**: 기존 HMAC 검증 테스트 통과 확인 (동작 변경 없음)
- **Verify**: `pnpm --filter sapper-ai run test`

### P0.2: 랜덤 HMAC 키 파일 도입

- **Source**: Security Reviewer HIGH #2
- **File**: `packages/sapper-ai/src/guard/ScanCache.ts:143-144`
- **Issue**: HMAC 키 시드가 `hostname:uid:homedir:suffix`로 구성. 모두 공개 정보이므로 같은 머신의 다른 프로세스가 키를 재현 가능 → HMAC 의미 무력화.
- **Fix**:
  ```typescript
  // Before (keySeed in constructor)
  this.keySeed = `${machineId}:${homePath}:${HMAC_KEY_SUFFIX}`

  // After
  // 1. ~/.sapper-ai/hmac-key 파일에 32바이트 랜덤 키 저장
  // 2. 파일 없으면 randomBytes(32)로 생성 + mode 0o600
  // 3. 파일 있으면 읽어서 사용
  import { randomBytes } from 'node:crypto'

  async function getOrCreateHmacKey(keyPath: string): Promise<Buffer> {
    try {
      const existing = await readFile(keyPath)
      if (existing.length === 32) return existing
    } catch { /* file does not exist */ }
    const key = randomBytes(32)
    await writeFile(keyPath, key, { mode: 0o600 })
    return key
  }
  ```
- **Key file**: `~/.sapper-ai/hmac-key` (퍼미션 `0600`)
- **Migration**: 키 파일 없으면 새로 생성 → 기존 캐시 HMAC 불일치 → 자동 전체 재스캔 (기존 동작)
- **Test**: `ScanCache.test.ts`에 테스트 추가
  - 키 파일 없을 때 → 자동 생성
  - 키 파일 있을 때 → 읽어서 사용
  - 키 파일 손상(길이 != 32) → 재생성
- **Verify**: `pnpm --filter sapper-ai run test`

### P0.3: `__proto__` 키 필터링 (Prototype Pollution)

- **Source**: Security Reviewer MEDIUM #4 (보안 도구이므로 P0 승격)
- **File**: `packages/sapper-ai/src/guard/ScanCache.ts:119`
- **Issue**: `Object.entries(entries)` 순회 시 `__proto__`, `constructor`, `prototype` 키를 필터링하지 않음. JSON.parse는 이 키들을 그대로 파싱.
- **Fix**:
  ```typescript
  const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

  for (const [hash, entry] of Object.entries(entries as Record<string, unknown>)) {
    if (DANGEROUS_KEYS.has(hash)) continue
    // ...
  }
  ```
- **Test**: `ScanCache.test.ts`에 테스트 추가
  - `__proto__` 키가 포함된 JSON → 필터링 확인
- **Verify**: `pnpm --filter sapper-ai run test`

---

## P1 — High Priority (우선 수정)

### P1.1: TOCTOU — 재스캔 후 해시 재검증

- **Source**: Security Reviewer HIGH #3
- **File**: `packages/sapper-ai/src/guard/hooks/guardCheck.ts:92-100`
- **Issue**: 파일 해시 계산(92행) → 해시 불일치 → `scanSingleSkill` 재스캔(100행). 이 사이에 공격자가 파일을 무해한 콘텐츠로 교체하면 재스캔이 "safe"를 반환하여 경고 제거됨.
- **Fix**: 재스캔 후 파일을 다시 읽어 해시가 재스캔 시점의 해시와 일치하는지 확인.
  ```typescript
  const rescanned = await scanSkill(warning.skillPath)

  // Post-scan verification
  const postScanContent = await read(warning.skillPath, 'utf8')
  const postScanHash = sha256(postScanContent)

  if (postScanHash !== rescanned.contentHash) {
    // File changed during re-scan — treat as suspicious
    deliverWarnings.push({
      ...warning,
      reasons: [...warning.reasons, 'File changed during re-scan (possible TOCTOU)'],
      detectedAt: new Date(now()).toISOString(),
    })
    continue
  }
  ```
- **Test**: `guardCheck.test.ts`에 테스트 추가
  - 재스캔 중 파일 변경 → suspicious로 처리
- **Verify**: `pnpm --filter sapper-ai run test`

### P1.2: `atomicWriteFile` rename 실패 시 임시 파일 정리

- **Source**: Code Reviewer HIGH
- **File**: `packages/sapper-ai/src/utils/fs.ts:40-53`
- **Issue**: `rename` 실패 시 임시 파일이 남음. `setup.ts`의 `writeSettingsAtomic`은 catch에서 `rmSync` 정리를 하지만 `atomicWriteFile`은 하지 않음.
- **Fix**:
  ```typescript
  export async function atomicWriteFile(...) {
    await writeFile(tmpPath, content, ...)
    try {
      await rename(tmpPath, filePath)
    } catch (error) {
      await unlink(tmpPath).catch(() => {})
      throw error
    }
  }
  ```
- **Test**: 기존 테스트 통과 확인
- **Verify**: `pnpm --filter sapper-ai run test`

### P1.3: 심볼릭 링크 watchPath 외부 탈출 방지

- **Source**: Security Reviewer MEDIUM #5 (보안 도구이므로 P1 승격)
- **File**: `packages/sapper-ai/src/guard/hooks/guardScan.ts:117-131`
- **Issue**: `collectMarkdownFiles`에서 심볼릭 링크를 따라간 후, 해석된 경로가 watchPath 하위에 있는지 미확인. 외부 파일(예: `/etc/shadow`) 스캔 가능.
- **Fix**:
  ```typescript
  if (entry.isSymbolicLink()) {
    try {
      const resolved = await resolvePath(fullPath)
      if (!resolved.startsWith(rootPath + '/') && resolved !== rootPath) {
        continue  // watchPath outside — skip
      }
      // ... proceed
    }
  }
  ```
- **Test**: `guardScan.test.ts`에 테스트 추가
  - watchPath 외부를 가리키는 symlink → 무시 확인
- **Verify**: `pnpm --filter sapper-ai run test`

---

## P2 — Medium Priority (수정 고려)

### P2.1: 에러 메시지 정보 노출 방지 (setup.ts)

- **Source**: Security Reviewer MEDIUM #6
- **File**: `packages/sapper-ai/src/guard/setup.ts:104-106`
- **Issue**: `JSON.parse` 실패 시 에러 메시지에 파일 내용 일부가 포함될 수 있음.
- **Fix**:
  ```typescript
  // Before
  const message = error instanceof Error ? error.message : String(error)
  throw new Error(`Failed to parse ${settingsPath}: ${message}`)

  // After
  throw new Error(`Failed to parse ${settingsPath}: invalid JSON`)
  ```
- **Verify**: `pnpm --filter sapper-ai run test`

### P2.2: `as AssessmentContext` 타입 단언 제거

- **Source**: Code Reviewer MEDIUM
- **File**: `packages/sapper-ai/src/guard/scanSingleSkill.ts:63`
- **Issue**: `as AssessmentContext` 타입 단언 사용. 향후 인터페이스 변경 시 감지 불가.
- **Fix**: `satisfies AssessmentContext` 사용 또는 반환 타입을 명시적으로 `AssessmentContext`로 선언.
- **Verify**: `pnpm exec tsc -b --noEmit`

### P2.3: `dismiss` 시 `contentHash` 포함 여부 결정

- **Source**: Code Reviewer MEDIUM
- **File**: `packages/sapper-ai/src/guard/WarningStore.ts:251-264`
- **Issue**: `dismiss(skillName)` 호출 시 `contentHash` 미포함 → 동일 이름의 모든 버전을 영구 차단. 스킬 내용이 수정되어도 동일 이름이면 계속 dismissed.
- **결정 필요**: 의도적이면 문서화. 아니면 `dismiss(skillName, contentHash?)` 시그니처로 변경.
- **Verify**: `pnpm --filter sapper-ai run test`

### P2.4: `guardCheck` replacePending + acknowledge N회 I/O 최적화

- **Source**: Code Reviewer MEDIUM
- **File**: `packages/sapper-ai/src/guard/hooks/guardCheck.ts:135-141`
- **Issue**: `replacePending` 1회 + `acknowledge` N회 = 총 `1 + N`회 파일 I/O. 5초 타임아웃 내 pending 항목 많으면 성능 이슈.
- **Fix**: `acknowledgeAll(warnings)` 메서드 추가하여 한 번의 persist로 처리.
- **Verify**: `pnpm --filter sapper-ai run test`

### P2.5: 동적 import 경로 검증

- **Source**: Code Reviewer MEDIUM
- **File**: `packages/sapper-ai/src/cli.ts:514-517`
- **Issue**: `modulePath`에 `..`가 포함되면 경로 순회 가능 (현재는 하드코딩된 값만 사용하므로 실질적 위험 없음).
- **Fix**:
  ```typescript
  if (modulePath.includes('..')) {
    throw new Error(`Invalid guard module path: ${modulePath}`)
  }
  ```
- **Verify**: `pnpm --filter sapper-ai run test`

### P2.6: 파일 퍼미션 제한 (캐시/경고 파일)

- **Source**: Security Reviewer LOW #7 (보안 도구이므로 P2 승격)
- **File**: `packages/sapper-ai/src/guard/ScanCache.ts`, `WarningStore.ts`
- **Issue**: `atomicWriteFile` 호출 시 `mode` 미지정 → 기본 umask 적용 → 다른 사용자 읽기 가능.
- **Fix**: `mode: 0o600` 옵션 추가.
- **Verify**: `pnpm --filter sapper-ai run test`

---

## P3 — Low Priority (선택적 리팩토링)

### P3.1: sha256 함수 3개 파일 중복 → 공용 유틸리티

- **Source**: Code Simplifier High #6
- **Files**: `guardScan.ts:47-49`, `guardCheck.ts:25-27`, `scanSingleSkill.ts:21-23`
- **Fix**: `packages/sapper-ai/src/guard/utils.ts`에 `sha256()` 추출. 3개 파일에서 import.
- **Verify**: `pnpm --filter sapper-ai run test`

### P3.2: writeJson/writeError 함수 중복 → 공용 유틸리티

- **Source**: Code Simplifier High #7
- **Files**: `guardScan.ts:166-172`, `guardCheck.ts:29-35`
- **Fix**: `packages/sapper-ai/src/guard/utils.ts`에 추출.
- **Verify**: `pnpm --filter sapper-ai run test`

### P3.3: isRecord/isObject 타입 가드 중복

- **Source**: Code Simplifier High #20
- **Files**: `setup.ts:77-79`, `cli.ts:541-543`
- **Fix**: 공용 타입 가드 유틸리티 함수로 통합.
- **Verify**: `pnpm --filter sapper-ai run test`

### P3.4: symlink 테스트 커버리지 추가

- **Source**: Code Reviewer LOW
- **File**: `packages/sapper-ai/src/__tests__/guard/hooks/guardScan.test.ts`
- **Fix**: symlink가 가리키는 .md 파일 스캔 확인, 순환 참조 방지 확인 테스트 추가.
- **Verify**: `pnpm --filter sapper-ai run test`

### P3.5: guardScan 파일 이중 읽기 최적화

- **Source**: Code Reviewer LOW
- **File**: `packages/sapper-ai/src/guard/hooks/guardScan.ts:229,237`
- **Issue**: 해시 계산 + scanSingleSkill 내부에서 파일을 2회 읽음.
- **Fix**: `scanSingleSkill`에 이미 읽은 content를 전달하는 옵션 추가 또는 유지 (성능 영향 미미).
- **Verify**: `pnpm --filter sapper-ai run test`

### P3.6: postinstall 빈 catch 블록에 주석 추가

- **Source**: Code Reviewer LOW
- **File**: `packages/sapper-ai/src/postinstall.ts:22-23`
- **Fix**:
  ```typescript
  } catch {
    // Postinstall failure must not block npm install
  }
  ```
- **Verify**: N/A (주석만)

---

## TODO Checklist (Codex 실행용)

### P0 (즉시)
- [ ] P0.1: `ScanCache.ts` — HMAC 비교에 `timingSafeEqual` 사용
- [ ] P0.2: `ScanCache.ts` — 랜덤 HMAC 키 파일 도입 (`~/.sapper-ai/hmac-key`, mode 0o600)
- [ ] P0.3: `ScanCache.ts` — `__proto__`/`constructor`/`prototype` 키 필터링

### P1 (우선)
- [ ] P1.1: `guardCheck.ts` — TOCTOU 재스캔 후 해시 재검증
- [ ] P1.2: `utils/fs.ts` — `atomicWriteFile` rename 실패 시 임시 파일 정리
- [ ] P1.3: `guardScan.ts` — symlink watchPath 외부 탈출 방지

### P2 (고려)
- [ ] P2.1: `setup.ts` — 에러 메시지에서 파일 내용 제거
- [ ] P2.2: `scanSingleSkill.ts` — `as AssessmentContext` → `satisfies` 변경
- [ ] P2.3: `WarningStore.ts` — `dismiss` 시 `contentHash` 포함 여부 결정
- [ ] P2.4: `guardCheck.ts` — `acknowledgeAll` 일괄 처리 메서드 추가
- [ ] P2.5: `cli.ts` — 동적 import 경로에 `..` 검증 추가
- [ ] P2.6: `ScanCache.ts`, `WarningStore.ts` — 파일 쓰기 시 `mode: 0o600`

### P3 (선택)
- [ ] P3.1: sha256 함수 → `guard/utils.ts`로 추출
- [ ] P3.2: writeJson/writeError → `guard/utils.ts`로 추출
- [ ] P3.3: isRecord/isObject 타입 가드 통합
- [ ] P3.4: guardScan symlink 테스트 추가
- [ ] P3.5: guardScan 파일 이중 읽기 최적화
- [ ] P3.6: postinstall 빈 catch에 주석 추가

### 검증
- [ ] `pnpm build` 통과
- [ ] `pnpm test` 통과 (120+ tests)
- [ ] `pnpm exec tsc -b --noEmit` clean

---

## Revision History

- **v1 (2026-02-17)**: Initial fix plan from 3-agent parallel review
