# 2026-02-16 MCP Watch Dynamic v1.2a Fix Plan

## Summary

v1.2 구현에 대한 3-way 리뷰(Code Review, Security Review, Simplifier) 결과 발견된 이슈를 수정하는 계획.

- CRITICAL/HIGH 4건: merge 전 필수 수정
- MEDIUM 4건: 후속 수정 권장
- LOW 4건: 선택적 개선

## Fix #1 — `reduce` 초기값 `1` 버그 (HIGH)

**문제**: `FileWatcher.ts:330-331`에서 `result.findings.reduce(..., 1)` 초기값이 `1`(최대치)이므로 `Math.max`가 항상 `1`을 반환. dynamic finding의 risk/confidence가 실제 값과 무관하게 항상 1.0으로 기록됨.

**수정**:

```ts
// before
const maxRisk = result.findings.reduce((max, finding) => Math.max(max, finding.decision.risk), 1)
const maxConfidence = result.findings.reduce((max, finding) => Math.max(max, finding.decision.confidence), 1)

// after
const maxRisk = result.findings.reduce((max, finding) => Math.max(max, finding.decision.risk), 0)
const maxConfidence = result.findings.reduce((max, finding) => Math.max(max, finding.decision.confidence), 0)
```

**검증**: 기존 테스트의 `decision.risk`/`decision.confidence` 값이 `1`이 아닌 실제 finding 값과 일치하는지 assert 추가.

## Fix #2 — DD6 위반: block+monitor에서 dynamic 누락 (HIGH)

**문제**: `FileWatcher.ts:239-256`에서 `policyMatch.action === 'block'` + monitor 모드일 때 `continue`로 즉시 빠져나가 dynamic 평가가 실행되지 않음.

**수정**: monitor 분기에서 `continue` 전에 dynamic 체크를 삽입.

```ts
// before (FileWatcher.ts, block 분기)
if (this.policy.mode === 'enforce') {
  await this.quarantineManager.quarantine(filePath, blockDecision)
  return
}
continue  // <-- dynamic 누락

// after
if (this.policy.mode === 'enforce') {
  await this.quarantineManager.quarantine(filePath, blockDecision)
  return
}
// monitor mode: run dynamic if eligible before continuing
if (dynamicEligible && (await this.evaluateDynamicTarget(filePath, target, effectivePolicy))) {
  return
}
continue
```

**검증**: 새 테스트 추가 — "block+monitor+dynamic eligible: assessInMemory가 호출됨".

## Fix #3 — allowlist allow 시 scanner 완전 우회 (CRITICAL)

**문제**: `FileWatcher.ts:219-236`에서 allowlist에 매칭된 target은 `continue`로 빠져나가 `scanner.scanTool()`에 도달하지 않음. dynamic corpus가 해당 공격 벡터를 커버하지 못하면 무검사 통과.

**수정**: allowlisted skill/agent target에 대해 dynamic 실행 후 scanner도 추가 실행하는 defense-in-depth 적용.

```ts
// before
if (policyMatch.action === 'allow') {
  this.logAuditEntry(target, allowDecision, 'watch_policy_match')
  if (dynamicEligible && (await this.evaluateDynamicTarget(filePath, target, effectivePolicy))) {
    return
  }
  continue  // scanner 우회
}

// after
if (policyMatch.action === 'allow') {
  this.logAuditEntry(target, allowDecision, 'watch_policy_match')
  if (dynamicEligible) {
    if (await this.evaluateDynamicTarget(filePath, target, effectivePolicy)) {
      return  // dynamic이 vulnerable 판정 → quarantine 처리됨
    }
    // dynamic clean이어도 scanner로 fallthrough (defense-in-depth)
  } else {
    continue  // non-skill/agent는 기존대로 skip
  }
}
```

**검증**: 새 테스트 추가 — "allow+dynamic clean인 skill target: scanner.scanTool도 호출됨".

## Fix #4 — `toEnforcePolicy`에서 allowlist 제거 (HIGH)

**문제**: `AdversaryCampaignRunner.ts:426-435`에서 `{ ...policy, mode: 'enforce' }` shallow copy 시 allowlist가 보존됨. adversary corpus의 attack variant가 allowlist 패턴에 우연히 매칭되면 false negative 발생.

**수정**:

```ts
// before
private toEnforcePolicy(policy: Policy): Policy {
  if (policy.mode === 'enforce') {
    return policy
  }
  return { ...policy, mode: 'enforce' }
}

// after
private toEnforcePolicy(policy: Policy): Policy {
  const { allowlist, ...rest } = policy
  return { ...rest, mode: 'enforce' }
}
```

**검증**: 새 테스트 추가 — "assessInMemory에 allowlist 포함 policy 전달 시 allowlist가 평가에 영향 없음".

## Fix #5 — DD9: durationMs 실측 (MEDIUM)

**문제**: `evaluateDynamicTarget`에서 `assessInMemory` 호출 시간을 측정하지 않음. `logAuditEntry`가 항상 `durationMs: 0`으로 기록.

**수정**:

1. `evaluateDynamicTarget` 시작 시 `const t0 = performance.now()`
2. `assessInMemory` 완료 후 `const elapsed = Math.round(performance.now() - t0)`
3. `logAuditEntry` 시그니처에 `durationMs?: number` 옵션 추가, dynamic phase에만 전달

**검증**: FileWatcher 테스트에서 dynamic phase의 `durationMs > 0` assert.

## Fix #6 — dynamic 오류 시 policy.failOpen 참조 (MEDIUM)

**문제**: `FileWatcher.ts:379-396`에서 dynamic 오류 발생 시 항상 fail-open(allow). `policy.failOpen` 설정을 무시.

**수정**:

```ts
// before (catch block)
this.logAuditEntry(target, { action: 'allow', risk: 0, ... }, 'watch_dynamic_error')
return false

// after
const shouldFailOpen = this.policy.failOpen !== false
this.logAuditEntry(target, {
  action: shouldFailOpen ? 'allow' : 'block',
  risk: shouldFailOpen ? 0 : 1,
  ...
}, 'watch_dynamic_error')

if (!shouldFailOpen && this.policy.mode === 'enforce') {
  await this.quarantineManager.quarantine(filePath, blockDecision)
  return true
}
return false
```

**검증**: 새 테스트 — "failOpen: false + dynamic error → quarantine 수행".

## Fix #7 — assessInMemory 내부 기본값 정렬 (MEDIUM)

**문제**: `AdversaryCampaignRunner.ts:295`에서 `assessInMemory` 내부 기본값이 `maxCases: 50`, `maxDurationMs: 300000`으로 watch 기본값(8, 1500)과 불일치.

**수정**: `assessInMemory`의 기본값을 watch 기본값과 일치시킴.

```ts
// before
const maxCases = options.maxCases ?? 50
const maxDurationMs = options.maxDurationMs ?? 5 * 60 * 1000

// after
const maxCases = options.maxCases ?? 8
const maxDurationMs = options.maxDurationMs ?? 1500
```

**검증**: `assessInMemory` 옵션 미지정 호출 시 8 cases / 1500ms 기본값 적용 확인.

## Fix #8 — assessInMemory 단위 테스트 추가 (MEDIUM)

**문제**: TODO #13에 해당하는 `AdversaryCampaignRunner.assessInMemory` 단위 테스트가 미작성.

**수정**: `packages/mcp/src/services/__tests__/AdversaryCampaignRunner.test.ts` 생성.

테스트 케이스:
1. `skipSync: true` 경로 사용 — `loadThreatIntelEntries` mock으로 네트워크 미호출 확인
2. mode-independent 판정 — monitor policy 전달해도 vulnerable 판정 가능
3. budget — maxCases/maxDurationMs 상한 준수
4. 파일 I/O 없음 — `mkdir`/`writeFile` mock 미호출 확인
5. allowlist strip — toEnforcePolicy에서 allowlist 제거됨 (Fix #4 연관)

## TODO Checklist

### Phase A: CRITICAL/HIGH 수정 (merge blocker)

- [ ] 1. `FileWatcher.ts:330-331` — `reduce` 초기값 `1` → `0` 변경
  - 검증: 기존 dynamic 테스트의 risk/confidence assert 값 확인 및 수정
- [ ] 2. `FileWatcher.ts:239-256` — block+monitor 분기에 dynamic 체크 삽입
  - 검증: 새 테스트 "block+monitor+dynamic → assessInMemory 호출됨"
- [ ] 3. `FileWatcher.ts:219-236` — allow+dynamic clean인 skill/agent에 scanner fallthrough
  - 검증: 새 테스트 "allow+dynamic clean+skill → scanTool 호출됨"
- [ ] 4. `AdversaryCampaignRunner.ts:426-435` — `toEnforcePolicy`에서 `allowlist` 제거
  - 검증: 새 테스트 "assessInMemory + allowlist policy → allowlist 무시됨"

### Phase B: MEDIUM 수정

- [ ] 5. `FileWatcher.ts` — `evaluateDynamicTarget`에 `performance.now()` 측정 + `logAuditEntry`에 `durationMs` 전달
  - 검증: dynamic phase audit의 `durationMs > 0` assert
- [ ] 6. `FileWatcher.ts:379-396` — catch block에서 `policy.failOpen` 참조
  - 검증: 새 테스트 "failOpen: false + dynamic error → quarantine"
- [ ] 7. `AdversaryCampaignRunner.ts:295` — `assessInMemory` 기본값 8 / 1500으로 변경
  - 검증: 옵션 미지정 호출 시 기본값 확인
- [ ] 8. `packages/mcp/src/services/__tests__/AdversaryCampaignRunner.test.ts` 신규 작성
  - 5개 테스트 케이스 (Fix #8 참조)

### Phase C: LOW 개선 (optional)

- [ ] 9. Dynamic 기본값 상수 3중 중복 → 공유 상수로 추출
  - `FileWatcher.ts`의 `DEFAULT_DYNAMIC_OPTIONS`를 export하고 `cli.ts`, `watch.ts`에서 import
- [ ] 10. `run()`과 `assessInMemory()`의 핵심 루프 ~50줄 → private 공통 메서드 추출
- [ ] 11. quarantine 실패 처리 중복 → `private tryQuarantine()` 헬퍼 추출
- [ ] 12. `FileWatcher.test.ts` 셋업 보일러플레이트 → `createTestEnv()` 헬퍼 추출

## Execution Order

Phase A (#1-#4) → `pnpm test` 통과 확인 → Phase B (#5-#8) → `pnpm test` 통과 확인 → Phase C (optional)
