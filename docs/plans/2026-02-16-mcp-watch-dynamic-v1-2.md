# 2026-02-16 MCP Watch Dynamic v1.2 Plan (Revised)

## Summary

`@sapper-ai/mcp`의 `watch` 모드에 대해, 기존 정적(rule) 검사 뒤에 선택적 동적 검사(deterministic policy-replay)를 추가하는 v1 계획을 Architect/Critic 리뷰 결과에 맞춰 수정한다.

이번 문서는 **구현 문서가 아니라 설계/작업 문서**이며, 코드 변경은 포함하지 않는다.

최종 판정: `REVISE` 반영 후 `v1.2`로 진행.

> **v1.2a 수정**: 코드베이스 정합성 리뷰(2026-02-16) 결과 5개 보완 항목 반영.

## Background

현재 `FileWatcher`는 config-like 파일 변경 시 정적 스캔 및 정책 매칭/격리만 수행한다.

- watch 파이프라인: `packages/mcp/src/services/FileWatcher.ts`
- watch CLI 진입: `packages/mcp/src/cli.ts`, `packages/mcp/src/commands/watch.ts`
- dynamic 재사용 후보: `packages/mcp/src/services/AdversaryCampaignRunner.ts`

리뷰에서 확인된 핵심 리스크:

1. monitor 모드에서 dynamic 취약 판정이 붕괴될 수 있음 (`allow == vulnerable` 오해석)
2. watch 이벤트 중 threat feed sync/network 동작이 유입될 수 있음
3. event handler 예외가 unhandled rejection으로 누수될 수 있음
4. budget/validation/audit phase 기준이 명확하지 않음

## Goal

1. 새로 추가/변경되는 `skill`/`agent` 표면에 대해 watch 시점의 동적 재검증을 제공한다.
2. monitor/enforce 의미를 유지하면서 오탐/과차단을 제어한다.
3. watch의 안정성(지연/예외/네트워크 부작용)을 보장한다.

## Non-Goals (v1.2)

1. 실제 외부 샌드박스 실행 + 입출력 비교 엔진 구현
2. 모든 sourceType(`plugin`, `config`, `mcp_server`)로 동적 검사 확장
3. adversary run/replay 아티팩트 포맷 대규모 개편

## Design Decisions (v1.2)

### 1) Dynamic 취약 판정은 policy mode와 분리

Dynamic 취약 여부는 `enforce` 의미로만 평가한다.
즉, 현재 런타임이 monitor여도 "취약 여부 계산"은 enforce 기준으로 수행하고, **최종 액션 단계에서만** monitor/enforce를 반영한다.

- 취약 판정: `vulnerable: boolean` (mode-independent)
- 액션:
  - monitor: audit only
  - enforce: block + quarantine

**구현 전략**: `assessInMemory` 내부에서 Guard/DecisionEngine을 생성할 때, 전달받은 policy를 shallow-copy하여 `mode: 'enforce'`로 강제 설정한다. 이렇게 하면 Decision이 항상 enforce 기준으로 산출되므로, `decision.action === 'allow'`일 때 vulnerable 판정이 monitor에서 붕괴되는 문제를 방지한다. 반환값의 `vulnerable` 필드만 caller에게 전달하고, 최종 quarantine 액션은 FileWatcher가 원본 `policy.mode`를 참조하여 결정한다.

```ts
// assessInMemory 내부
const enforcePolicy = { ...policy, mode: 'enforce' as const }
const guard = new Guard(new DecisionEngine(enforcePolicy, detectors))
```

### 2) Dynamic은 target-bound로 실행

고정 tool context(`sandbox_agent_tool`)를 그대로 쓰지 않고, watch target 문맥을 넣는다.

- 포함 필드: `targetId`, `sourcePath`, `sourceType`, `surface`
- 적용 대상: `sourceType in ['skill', 'agent']` 일 때만
  - `sourceType` 판별은 `packages/core/src/discovery/DiscoveryUtils.ts`의 `classifyTargetType()` 함수에 의존 (경로 패턴 기반: `/skills/`, `/agents/` 등)
- FileWatcher의 기존 `ScanTarget` 인터페이스(`{id, sourcePath, sourceType, surface}`)와 동일 구조이므로 그대로 재사용

**ToolCall 변환 전략**: `assessInMemory` 내부에서 attack case의 prompt를 target context와 결합하여 ToolCall을 생성한다. 기존 `run()`의 `toolName: 'sandbox_agent_tool'` 대신 `target.id`를 toolName으로 사용하고, `input.prompt`에 attack prompt를, `input.context`에 `target.surface`를 포함시킨다.

```ts
const toolCall: ToolCall = {
  toolName: target.id,          // e.g. "skill:code-review"
  input: { prompt: variant, context: target.surface },
  serverName: target.sourcePath,
}
```

**Attack corpus 전략**: `builtInAttackCorpus()` (5개 내장 케이스)를 재사용한다. `mutatePrompt()`로 4배 확장(최대 20개)된 후 `deterministicShuffle(cases, seed)`로 순서를 결정하고, `maxCases` 상한(기본 8)만큼만 실행한다. v1.2에서는 target-specific 케이스 생성은 Non-Goal이며, `seed` 고정으로 동일 입력에 대한 재현성을 보장한다.

### 3) Watch dynamic 경로는 threat sync 금지

watch 동적 검사 경로에서는 detector 구성 시 `skipSync: true`를 강제한다.  
목표는 파일 이벤트당 네트워크 동기화 제거와 실행 시간 안정화다.

### 4) Event handler 예외 흡수 + audit

`void this.handleFile(...)` 호출부에서 dynamic 포함 어떤 예외도 프로세스 레벨 unhandled rejection으로 누수되지 않게 처리한다.

- 방식: `this.handleFile(path).catch(...)` 패턴으로 감사 로그 기록
- phase: `watch_dynamic_error`

### 5) Budget 의미를 “파일 이벤트 단위”로 고정

`--dynamic-max-cases`, `--dynamic-max-duration-ms`는 watcher 전체가 아니라 **파일 이벤트 1건당 상한**으로 정의한다.

기본값(제안):

- `dynamicMaxCases`: `8`
- `dynamicMaxDurationMs`: `1500`
- `dynamicSeed`: `"watch-default"`

상한(제안):

- `dynamicMaxCases <= 100`
- `dynamicMaxDurationMs <= 30000`

### 6) allowlist 우회 방지 원칙

`skill`/`agent` 대상에서 dynamic이 enabled인 경우, allowlist로 정적 파이프라인이 skip되더라도 dynamic은 수행한다.
즉 v1.2에서는 "동적 검사 > allowlist skip" 우선순위를 채택한다.

**flow 상세**: 현재 FileWatcher의 `handleFile`에서 `policyMatch.action === 'allow'`이면 즉시 `continue`로 다음 target으로 넘어간다. DD6 적용 시 이 `continue` 전에 dynamic 체크를 삽입한다.

- 정적 allow + dynamic enabled + skill/agent → dynamic 수행 → vulnerable이면 enforce 시 quarantine
- 정적 block + enforce → quarantine 후 return (dynamic 불필요, 이미 차단됨)
- 정적 block + monitor → audit 기록 + dynamic 수행 (취약 여부 추가 확인)
- 정적 scan 결과 allow → dynamic 수행
- 정적 scan 결과 block + enforce → quarantine 후 return (dynamic 불필요)

### 7) Dynamic 전용 감사 phase 추가

기존 `watch_scan` 외에 다음 phase를 추가한다.

- `watch_dynamic_scan`
- `watch_dynamic_vulnerable`
- `watch_dynamic_error`

운영자가 static/dynamic 경로를 구분해 원인 분석 가능하도록 메타 필드를 확장한다.

### 8) Audit kind 값은 `install_scan` 유지

현재 FileWatcher의 `logAuditEntry`에서 `context.kind`는 `'install_scan'`으로 고정되어 있고, `AssessmentContext.kind` 타입은 `'install_scan' | 'pre_tool_call' | 'post_tool_result'` 유니온이다. v1.2에서는 `kind`는 변경하지 않고 기존 `'install_scan'`을 유지한다. static/dynamic 구분은 `meta.phase` 필드로 충분하며, `kind` 유니온 확장은 types 패키지의 breaking change 가능성이 있으므로 별도 RFC에서 검토한다.

### 9) durationMs 실측

현재 FileWatcher의 audit 로그에서 `durationMs`가 항상 `0`으로 고정되어 있다. dynamic 검사는 실행 시간이 의미있으므로, `assessInMemory` 호출 전후로 `performance.now()`를 측정하여 dynamic phase의 `durationMs`에 반영한다. 기존 정적 phase의 `durationMs: 0`은 v1.2에서 변경하지 않는다.

## CLI/Interface Changes

## watch flags

기존 watch 파서(`packages/mcp/src/cli.ts`)에 아래 옵션을 추가한다.

1. `--dynamic` (boolean)
2. `--dynamic-max-cases <int>`
3. `--dynamic-max-duration-ms <int>`
4. `--dynamic-seed <string>`

검증 규칙:

1. 정수 파라미터는 `Number.isFinite`, `> 0`, 상한 이하
2. 유효하지 않으면 즉시 에러 종료(명확한 오류 문구)
3. 옵션 미지정 시 기본값 사용

## runWatchCommand/FileWatcher 옵션

`WatchCommandOptions`/`FileWatcherOptions`에 dynamic 설정을 전달한다.

```ts
interface WatchDynamicOptions {
  enabled: boolean
  maxCases: number
  maxDurationMs: number
  seed: string
}
```

## Internal API Changes

## AdversaryCampaignRunner

in-memory 평가 전용 메서드를 추가한다(파일 아티팩트 write 없음).

예시 시그니처:

```ts
assessInMemory(options: {
  policy: Policy
  target: {
    id: string
    sourcePath: string
    sourceType: string
    surface: string
  }
  maxCases: number
  maxDurationMs: number
  seed: string
  skipSync?: true
}): Promise<{
  totalCases: number
  vulnerableCases: number
  findings: Array<{
    id: string
    reason: string
    severity10: number
    exposure10: number
  }>
  vulnerable: boolean
}>
```

핵심: monitor/enforce와 독립된 취약 계산값을 반환해야 한다.

## FileWatcher Flow (v1.2)

각 target에 대한 처리 분기도:

```
target 루프 진입
  │
  ├─ applyThreatIntelBlocklist → effectivePolicy
  ├─ evaluatePolicyMatch → policyMatch
  │
  ├─ [A] policyMatch.action === 'allow'
  │    ├─ logAuditEntry(phase='watch_policy_match')
  │    ├─ dynamic enabled && sourceType(skill|agent)?
  │    │    ├─ YES → assessInMemory() → logAuditEntry(phase='watch_dynamic_scan')
  │    │    │         ├─ vulnerable && enforce → quarantine
  │    │    │         └─ vulnerable && monitor → audit only
  │    │    └─ NO  → continue (기존 동작)
  │    └─ continue
  │
  ├─ [B] policyMatch.action === 'block'
  │    ├─ logAuditEntry(phase='watch_policy_match')
  │    ├─ enforce → quarantine + return (dynamic 불필요)
  │    └─ monitor → audit only
  │         └─ dynamic enabled && sourceType(skill|agent)?
  │              ├─ YES → assessInMemory() → audit
  │              └─ NO  → continue
  │
  └─ [C] policyMatch.action === undefined (스캔 필요)
       ├─ scanner.scanTool() → scanDecision
       ├─ logAuditEntry(phase='watch_scan')
       ├─ scanDecision.action === 'block' && enforce → quarantine + return
       └─ otherwise
            └─ dynamic enabled && sourceType(skill|agent)?
                 ├─ YES → assessInMemory() → logAuditEntry(phase='watch_dynamic_scan')
                 │         ├─ vulnerable && enforce → quarantine
                 │         └─ vulnerable && monitor → audit only
                 └─ NO  → continue
```

예외 발생 시:

1. `watch_dynamic_error` phase로 audit 기록
2. 기본 정책: fail-open(allow) + 감사 로그
3. `this.handleFile(path).catch(...)` 패턴으로 unhandled rejection 방지

## Test Plan

## `packages/mcp/src/__tests__/cli.test.ts`

1. `watch --dynamic` 파싱 성공
2. `--dynamic-max-cases`/`--dynamic-max-duration-ms` 유효성 실패 케이스
3. 미지정 시 기본값 적용 검증

## `packages/mcp/src/__tests__/FileWatcher.test.ts`

1. dynamic off일 때 기존 동작 회귀
2. dynamic on + `skill`/`agent`에서만 호출
3. monitor 모드: quarantine 없음, dynamic audit만 기록
4. enforce 모드: vulnerable 시 quarantine 수행
5. dynamic 에러 시 unhandled rejection 없음 + `watch_dynamic_error` 기록
6. allowlist가 있어도 dynamic 수행되는지 검증

## `packages/mcp/src/services/__tests__/AdversaryCampaignRunner.test.ts` (신규 또는 확장)

1. assessInMemory가 `skipSync: true` 경로를 사용함
2. mode-independent 취약 판정 검증 (monitor policy 전달해도 vulnerable 판정 가능)
3. budget 상한 및 duration 제한 검증
4. 파일 I/O 없음 검증 (`mkdir`/`writeFile` mock 미호출 확인)

### Mock 전략

- **FileWatcher 테스트**: `AdversaryCampaignRunner.assessInMemory`를 vitest mock으로 stub하여 반환값 제어
- **AdversaryCampaignRunner 테스트**: `loadThreatIntelEntries`를 mock하여 네트워크 차단 검증, `fs/promises`를 mock하여 파일 I/O 미발생 검증
- **CLI 테스트**: 순수 파싱 함수(`parseWatchArgs`) 단위 테스트이므로 mock 불필요

## Acceptance Criteria

1. `watch --dynamic` 사용 시 `skill`/`agent` 파일 변경에 dynamic phase 로그가 생성된다.
2. monitor 모드에서 dynamic 취약 판정이 있어도 quarantine는 발생하지 않는다.
3. enforce 모드에서 dynamic 취약 판정이 있으면 quarantine가 발생한다.
4. watch dynamic 처리 중 threat feed sync 네트워크 호출이 발생하지 않는다.
5. dynamic 오류가 발생해도 watcher 프로세스가 죽지 않는다.

## TODO Checklist

### Phase 1: CLI 파싱 (packages/mcp/src/cli.ts)

- [ ] 1. `WatchCliArgs` 인터페이스에 `dynamic`, `dynamicMaxCases`, `dynamicMaxDurationMs`, `dynamicSeed` 필드 추가
  - 파일: `packages/mcp/src/cli.ts` (line 27-31)
- [ ] 2. `parseWatchArgs()`에 `--dynamic`, `--dynamic-max-cases`, `--dynamic-max-duration-ms`, `--dynamic-seed` 파싱 추가
  - 파일: `packages/mcp/src/cli.ts` (line 197-228)
  - 정수 검증: `Number.isFinite`, `> 0`, 상한 이하 (`maxCases <= 100`, `maxDurationMs <= 30000`)
  - 기존 `requireOptionValue()` 헬퍼(line 687) 재사용
  - 검증 실패 시 `throw new Error(...)` (기존 패턴 동일)
- [ ] 3. `runCli()`에서 parsed args → `WatchDynamicOptions` 변환 후 `runWatchCommand()`에 전달
  - 파일: `packages/mcp/src/cli.ts` (line 635-643)

### Phase 2: Watch command 옵션 전달 (packages/mcp/src/commands/watch.ts)

- [ ] 4. `WatchCommandOptions`에 `dynamic?: WatchDynamicOptions` 필드 추가
  - 파일: `packages/mcp/src/commands/watch.ts` (line 6-10)
- [ ] 5. `runWatchCommand()`에서 `dynamic` 옵션을 `FileWatcher` 생성자에 전달

### Phase 3: AdversaryCampaignRunner.assessInMemory (packages/mcp/src/services/AdversaryCampaignRunner.ts)

- [ ] 6. `assessInMemory()` public 메서드 추가 — 파일 I/O 없는 in-memory 전용
  - policy를 shallow-copy하여 `mode: 'enforce'`로 강제 (DD1 구현 전략)
  - `resolveDetectors(policy, { skipSync: true })` 호출 (DD3)
  - `builtInAttackCorpus()` → `mutatePrompt()` → `deterministicShuffle(cases, seed)` → `maxCases` 상한
  - ToolCall 생성 시 `target.id`를 toolName으로 사용, `target.surface`를 context에 포함 (DD2)
  - 반환: `{ totalCases, vulnerableCases, findings[], vulnerable }`
  - 검증: `mkdir`/`writeFile` 호출이 없을 것

### Phase 4: FileWatcher dynamic pipeline (packages/mcp/src/services/FileWatcher.ts)

- [ ] 7. `FileWatcherOptions`에 `dynamic?: WatchDynamicOptions` 추가
  - 파일: `packages/mcp/src/services/FileWatcher.ts` (line 26-34)
- [ ] 8. `logAuditEntry`의 phase 유니온에 `'watch_dynamic_scan' | 'watch_dynamic_vulnerable' | 'watch_dynamic_error'` 추가
  - 파일: `packages/mcp/src/services/FileWatcher.ts` (line 275-278)
- [ ] 9. `handleFile` target 루프에 dynamic 분기 추가 (DD6 flow 상세 참조)
  - allow/block/scan 각 분기에서 `dynamic enabled && sourceType in ['skill','agent']` 조건 체크
  - `assessInMemory()` 호출 전후 `performance.now()` 측정하여 `durationMs` 반영 (DD9)
  - 예외 발생 시 `watch_dynamic_error` audit + fail-open
- [ ] 10. chokidar 이벤트 핸들러에서 `void this.handleFile(...)` → `this.handleFile(...).catch(...)` 패턴으로 변경 (DD4)

### Phase 5: 테스트

- [ ] 11. `packages/mcp/src/__tests__/cli.test.ts` — watch dynamic 파싱 테스트 추가
  - `watch --dynamic` 파싱 성공
  - `--dynamic-max-cases 0`, `--dynamic-max-cases 101` 유효성 실패
  - `--dynamic-max-duration-ms -1`, `--dynamic-max-duration-ms 30001` 유효성 실패
  - 미지정 시 기본값(8, 1500, "watch-default") 적용
- [ ] 12. `packages/mcp/src/__tests__/FileWatcher.test.ts` — dynamic pipeline 테스트 추가
  - dynamic off: 기존 동작 회귀 (assessInMemory 호출 없음)
  - dynamic on + skill/agent: assessInMemory 호출됨
  - dynamic on + config/plugin: assessInMemory 호출 안 됨
  - monitor 모드: vulnerable이어도 quarantine 없음, `watch_dynamic_scan` audit 기록
  - enforce 모드: vulnerable 시 quarantine 수행
  - dynamic 에러: unhandled rejection 없음 + `watch_dynamic_error` 기록
  - allowlist allow 상태에서도 dynamic 수행 검증 (DD6)
  - mock 전략: `AdversaryCampaignRunner.assessInMemory`를 mock
- [ ] 13. `packages/mcp/src/services/__tests__/AdversaryCampaignRunner.test.ts` — assessInMemory 테스트
  - `skipSync: true` 경로 사용 검증
  - mode-independent 취약 판정: monitor policy 전달해도 vulnerable 판정 가능
  - budget: maxCases/maxDurationMs 상한 준수
  - 파일 I/O 없음 검증 (mkdir/writeFile mock이 호출되지 않을 것)

### Phase 6: 문서

- [ ] 14. `docs/ops/watch-quarantine.md`에 `--dynamic` 사용법 및 운영 주의사항 추가

## Rollout

1. v1.2는 feature flag(`--dynamic`) 기본 off로 배포
2. 내부 dogfooding 후 default/on 여부는 별도 RFC로 결정
