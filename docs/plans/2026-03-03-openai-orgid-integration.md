# OpenAI Organization ID / Project ID Integration Plan

**Date:** 2026-03-03
**Status:** Done
**Complexity:** LOW-MEDIUM (6 files, all additive optional fields)

## Context

OpenAI API는 `OpenAI-Organization`과 `OpenAI-Project` HTTP 헤더를 통해 조직/프로젝트 단위 과금 및 접근 제어를 지원한다.
현재 SapperAI는 `LlmConfig`에 `provider`, `apiKey`, `endpoint`, `model`만 지원하므로, orgId/projectId를 first-class citizen으로 추가하여
API 호출 시 코드/설정/HTTP/리포트 전 레이어에 조직 정보가 반영되도록 한다.

## Work Objectives

1. `LlmConfig` 타입에 `orgId?`, `projectId?` optional 필드 추가
2. OpenAI HTTP 요청에 `OpenAI-Organization`, `OpenAI-Project` 헤더 주입
3. Zod 스키마(PolicyManager)에 orgId/projectId 검증 추가
4. CLI auth 레이어에서 환경변수(`OPENAI_ORG_ID`, `OPENAI_PROJECT_ID`) 및 `auth.json` 확장
5. 모든 소비자(scan.ts, web route)에서 orgId/projectId 전파

## Guardrails

### Must Have
- 모든 필드는 **optional** (하위 호환 100%)
- `OpenAI-Organization` / `OpenAI-Project` 헤더는 **provider === 'openai'일 때만** 전송
- orgId가 있을 때만 헤더 추가 (falsy면 헤더 생략)
- 기존 테스트 전부 통과

### Must NOT Have
- 다른 provider(anthropic, sapperai)에 헤더 누출
- orgId/projectId에 대한 형식 검증(org-XXX 등) -- 런타임 검증은 OpenAI 서버에 위임
- 불필요한 breaking change

---

## Task Flow Diagram

```
Phase 1: Types & Schema       Phase 2: HTTP & Auth         Phase 3: Consumers
(순차 - 기반 타입 정의)        (Phase 1 완료 후, 병렬)       (Phase 2 완료 후, 병렬)

┌─────────────────────┐
│ 1-1. LlmConfig 타입 │
│      orgId/projectId│
│      추가           │
├─────────────────────┤
│ 1-2. index.d.ts     │
│      빌드 반영      │
├─────────────────────┤
│ 1-3. Zod 스키마     │
│      필드 추가      │
└────────┬────────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌──────────┐
│ 2-1.   │ │ 2-2.     │
│ HTTP   │ │ auth.ts  │
│ 헤더   │ │ 환경변수 │
│ 주입   │ │ + JSON   │
└───┬────┘ └────┬─────┘
    │           │
    └─────┬─────┘
          ▼
   ┌──────┴───────┐
   ▼              ▼
┌────────┐  ┌──────────┐
│ 3-1.   │  │ 3-2.     │
│ scan.ts│  │ web      │
│ 전파   │  │ route    │
└────────┘  └──────────┘
```

---

## Phase 1: Types & Schema (순차)

### TODO 1-1. `LlmConfig` 인터페이스에 `orgId`, `projectId` 추가

**File:** `packages/types/src/index.ts` (lines 153-158)

**Before:**
```typescript
export interface LlmConfig {
  provider: 'openai' | 'anthropic' | 'sapperai';
  apiKey?: string;
  endpoint?: string;
  model?: string;
}
```

**After:**
```typescript
export interface LlmConfig {
  provider: 'openai' | 'anthropic' | 'sapperai';
  apiKey?: string;
  endpoint?: string;
  model?: string;
  orgId?: string;
  projectId?: string;
}
```

**Acceptance Criteria:**
- `pnpm --filter @sapper-ai/types run build` 성공
- 기존 `LlmConfig` 사용처에서 타입 에러 없음 (optional 추가이므로)

---

### TODO 1-2. `index.d.ts` 빌드 반영

**File:** `packages/types/src/index.d.ts` (lines 98-103)

> `pnpm --filter @sapper-ai/types run build` 실행 시 자동 생성됨. 수동 편집 필요 없음.

**Expected Result (빌드 후):**
```typescript
export interface LlmConfig {
    provider: 'openai' | 'anthropic' | 'sapperai';
    apiKey?: string;
    endpoint?: string;
    model?: string;
    orgId?: string;
    projectId?: string;
}
```

**Acceptance Criteria:**
- 빌드 산출물에 `orgId`, `projectId` 필드가 포함됨

---

### TODO 1-3. Zod 스키마에 `orgId`, `projectId` 필드 추가

**File:** `packages/core/src/engine/PolicyManager.ts` (lines 49-54)

**Before:**
```typescript
const LlmConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'sapperai']),
  apiKey: z.string().optional(),
  endpoint: z.string().optional(),
  model: z.string().optional(),
})
```

**After:**
```typescript
const LlmConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'sapperai']),
  apiKey: z.string().optional(),
  endpoint: z.string().optional(),
  model: z.string().optional(),
  orgId: z.string().optional(),
  projectId: z.string().optional(),
})
```

**Acceptance Criteria:**
- `{ provider: 'openai', orgId: 'org-abc123' }` 파싱 성공
- `{ provider: 'openai' }` 파싱 성공 (하위 호환)
- `{ provider: 'anthropic', orgId: 'org-abc' }` 파싱 성공 (스키마 레벨에서 provider 제한 안 함)

---

## Phase 2: HTTP & Auth (Phase 1 완료 후, 병렬 실행 가능)

### TODO 2-1. OpenAI HTTP 요청에 `OpenAI-Organization`, `OpenAI-Project` 헤더 추가

**File:** `packages/core/src/detectors/LlmDetector.ts` (lines 94-106)

**Before:**
```typescript
if (this.config.provider === 'openai') {
  const endpoint = this.config.endpoint ?? 'https://api.openai.com/v1/responses'
  return this.fetchJsonWithRetry(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: this.config.model ?? 'gpt-4.1-mini',
      input: prompt,
    }),
  }, 'OpenAI')
}
```

**After:**
```typescript
if (this.config.provider === 'openai') {
  const endpoint = this.config.endpoint ?? 'https://api.openai.com/v1/responses'
  return this.fetchJsonWithRetry(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {}),
      ...(this.config.orgId ? { 'openai-organization': this.config.orgId } : {}),
      ...(this.config.projectId ? { 'openai-project': this.config.projectId } : {}),
    },
    body: JSON.stringify({
      model: this.config.model ?? 'gpt-4.1-mini',
      input: prompt,
    }),
  }, 'OpenAI')
}
```

**Acceptance Criteria:**
- orgId 설정 시 `openai-organization` 헤더 포함 확인 (기존 테스트 패턴 활용)
- orgId 미설정 시 헤더 미포함 확인
- projectId 동일 패턴 확인
- Anthropic/SapperAI provider에는 헤더 미포함

---

### TODO 2-2. auth.ts에 orgId/projectId 환경변수 및 auth.json 확장

**File:** `packages/sapper-ai/src/auth.ts`

#### 2-2a. `AuthFile` 인터페이스 확장 (lines 8-13)

**Before:**
```typescript
interface AuthFile {
  openai?: {
    apiKey?: string
    savedAt?: string
  }
}
```

**After:**
```typescript
interface AuthFile {
  openai?: {
    apiKey?: string
    orgId?: string
    projectId?: string
    savedAt?: string
  }
}
```

#### 2-2b. `loadOpenAiOrgConfig` 함수 신규 추가 (line 41 이후)

**Before:** (함수 없음)

**After:** (`loadOpenAiApiKey` 함수 바로 아래에 추가)
```typescript
export async function loadOpenAiOrgConfig(
  options: { env?: NodeJS.ProcessEnv; authPath?: string } = {}
): Promise<{ orgId: string | null; projectId: string | null }> {
  const env = options.env ?? process.env

  const orgIdFromEnv = env.OPENAI_ORG_ID
  const projectIdFromEnv = env.OPENAI_PROJECT_ID

  if (isNonEmptyString(orgIdFromEnv) || isNonEmptyString(projectIdFromEnv)) {
    return {
      orgId: isNonEmptyString(orgIdFromEnv) ? orgIdFromEnv.trim() : null,
      projectId: isNonEmptyString(projectIdFromEnv) ? projectIdFromEnv.trim() : null,
    }
  }

  const authPath = options.authPath ?? getAuthPath()
  const raw = await readFileIfExists(authPath)
  if (raw === null) return { orgId: null, projectId: null }

  try {
    const parsed = JSON.parse(raw) as AuthFile
    return {
      orgId: isNonEmptyString(parsed.openai?.orgId) ? parsed.openai!.orgId!.trim() : null,
      projectId: isNonEmptyString(parsed.openai?.projectId) ? parsed.openai!.projectId!.trim() : null,
    }
  } catch {
    return { orgId: null, projectId: null }
  }
}
```

**Acceptance Criteria:**
- `OPENAI_ORG_ID=org-xxx` 환경변수 설정 시 `orgId: 'org-xxx'` 반환
- `OPENAI_PROJECT_ID=proj-xxx` 환경변수 설정 시 `projectId: 'proj-xxx'` 반환
- 환경변수 미설정 시 auth.json에서 폴백
- 둘 다 없으면 `{ orgId: null, projectId: null }` 반환
- 기존 `loadOpenAiApiKey` 동작 변경 없음

---

## Phase 3: Consumers (Phase 2 완료 후, 병렬 실행 가능)

### TODO 3-1. scan.ts에서 orgId/projectId를 llmConfig에 전파

**File:** `packages/sapper-ai/src/scan.ts` (line 515)

**Before:**
```typescript
    llmConfig = { provider: 'openai', apiKey, model: 'gpt-4.1-mini' }
```

**After:**
```typescript
    const { orgId, projectId } = await loadOpenAiOrgConfig()
    llmConfig = {
      provider: 'openai',
      apiKey,
      model: 'gpt-4.1-mini',
      ...(orgId ? { orgId } : {}),
      ...(projectId ? { projectId } : {}),
    }
```

> **Note:** `loadOpenAiOrgConfig`를 `auth.ts`에서 import 필요 (line 19의 import문 수정)

**Import 변경 (line 19):**

**Before:**
```typescript
import { getAuthPath, loadOpenAiApiKey, promptAndSaveOpenAiApiKey } from './auth'
```

**After:**
```typescript
import { getAuthPath, loadOpenAiApiKey, loadOpenAiOrgConfig, promptAndSaveOpenAiApiKey } from './auth'
```

**Acceptance Criteria:**
- `OPENAI_ORG_ID` 설정 시 llmConfig에 orgId 포함
- 미설정 시 orgId 필드 누락 (undefined가 아닌 키 자체 없음)
- 기존 scan 동작 변경 없음

---

### TODO 3-2. Web adversary-campaign route에서 orgId/projectId 전파

**File:** `apps/web/app/api/adversary-campaign/route.ts` (lines 35-55)

**Before:**
```typescript
const openAiApiKey = process.env.OPENAI_API_KEY?.trim()

const rawPolicy: Policy = {
  mode: 'enforce',
  defaultAction: 'allow',
  failOpen: true,
  detectors: openAiApiKey ? ['rules', 'llm'] : ['rules'],
  thresholds: {
    riskThreshold: 0.7,
    blockMinConfidence: 0.65,
  },
  ...(openAiApiKey
    ? {
        llm: {
          provider: 'openai' as const,
          apiKey: openAiApiKey,
          model: 'gpt-4.1-mini',
        },
      }
    : {}),
}
```

**After:**
```typescript
const openAiApiKey = process.env.OPENAI_API_KEY?.trim()
const openAiOrgId = process.env.OPENAI_ORG_ID?.trim()
const openAiProjectId = process.env.OPENAI_PROJECT_ID?.trim()

const rawPolicy: Policy = {
  mode: 'enforce',
  defaultAction: 'allow',
  failOpen: true,
  detectors: openAiApiKey ? ['rules', 'llm'] : ['rules'],
  thresholds: {
    riskThreshold: 0.7,
    blockMinConfidence: 0.65,
  },
  ...(openAiApiKey
    ? {
        llm: {
          provider: 'openai' as const,
          apiKey: openAiApiKey,
          model: 'gpt-4.1-mini',
          ...(openAiOrgId ? { orgId: openAiOrgId } : {}),
          ...(openAiProjectId ? { projectId: openAiProjectId } : {}),
        },
      }
    : {}),
}
```

**Acceptance Criteria:**
- `OPENAI_ORG_ID` 환경변수 설정 시 rawPolicy.llm.orgId에 반영
- 미설정 시 기존 동작과 동일
- `pnpm build` (Next.js) 성공

---

## Files Changed Summary

| Phase | File | Change Type | Description |
|-------|------|-------------|-------------|
| 1 | `packages/types/src/index.ts` | MODIFY | LlmConfig에 orgId?, projectId? 추가 |
| 1 | `packages/types/src/index.d.ts` | AUTO-GEN | 빌드 시 자동 반영 |
| 1 | `packages/core/src/engine/PolicyManager.ts` | MODIFY | LlmConfigSchema에 zod 필드 2개 추가 |
| 2 | `packages/core/src/detectors/LlmDetector.ts` | MODIFY | OpenAI 헤더 2줄 추가 |
| 2 | `packages/sapper-ai/src/auth.ts` | MODIFY | AuthFile 확장 + loadOpenAiOrgConfig 함수 추가 |
| 3 | `packages/sapper-ai/src/scan.ts` | MODIFY | llmConfig 생성 시 orgId/projectId 포함 + import 추가 |
| 3 | `apps/web/app/api/adversary-campaign/route.ts` | MODIFY | 환경변수 읽기 + rawPolicy.llm에 전파 |

**Total: 7 files (1 auto-generated)**

---

## Acceptance Criteria (Global)

### Phase 1 완료 기준
- [ ] `pnpm --filter @sapper-ai/types run build` 성공
- [ ] `pnpm --filter @sapper-ai/core run build` 성공
- [ ] 기존 타입 테스트 통과: `pnpm --filter @sapper-ai/types run test`

### Phase 2 완료 기준
- [ ] LlmDetector 테스트: orgId 설정 시 fetch 호출에 `openai-organization` 헤더 포함 확인
- [ ] LlmDetector 테스트: orgId 미설정 시 헤더 미포함 확인
- [ ] auth.test.ts: `OPENAI_ORG_ID` 환경변수 -> orgId 반환 확인
- [ ] auth.test.ts: auth.json에서 orgId/projectId 폴백 확인
- [ ] 기존 테스트 전부 통과

### Phase 3 완료 기준
- [ ] `pnpm build` 전체 성공 (monorepo)
- [ ] `pnpm test` 전체 성공
- [ ] scan.test.ts 기존 테스트 통과 확인

### Integration 검증
- [ ] `OPENAI_ORG_ID=org-test OPENAI_PROJECT_ID=proj-test pnpm --filter @sapper-ai/core run test` 통과
- [ ] orgId/projectId 없이 실행 시 기존 동작 100% 동일

---

## TODO List (Summary)

- [ ] 1-1. `packages/types/src/index.ts` — LlmConfig에 orgId?, projectId? 추가
- [ ] 1-2. types 패키지 빌드하여 index.d.ts 반영
- [ ] 1-3. `packages/core/src/engine/PolicyManager.ts` — LlmConfigSchema에 zod 필드 추가
- [ ] 2-1. `packages/core/src/detectors/LlmDetector.ts` — OpenAI 헤더 주입
- [ ] 2-2. `packages/sapper-ai/src/auth.ts` — AuthFile 확장 + loadOpenAiOrgConfig 함수
- [ ] 3-1. `packages/sapper-ai/src/scan.ts` — llmConfig에 orgId/projectId 전파
- [ ] 3-2. `apps/web/app/api/adversary-campaign/route.ts` — 환경변수 읽기 + rawPolicy 전파
- [ ] 전체 빌드 및 테스트 통과 확인
