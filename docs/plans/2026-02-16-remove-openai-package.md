# 2026-02-16 @sapper-ai/openai 패키지 완전 삭제 계획

## Summary

DX 단순화를 위해 `@sapper-ai/openai` 패키지를 모노레포에서 즉시 완전 삭제한다.
3-way 리뷰(Planner/Architect/Critic) 합의 반영본.

## Goal

1. `packages/openai` 디렉토리 및 모든 역방향 의존성 제거
2. `apps/web`의 agent-demo 기능 및 quickstart agents 탭 제거
3. 빌드/테스트 정합성 유지: `pnpm build`, `pnpm test`, `tsc -b --noEmit` 통과
4. 문서/템플릿/에이전트 도메인 지식 정합성 유지

## Non-Goals

1. npm unpublish (72시간 제한 + 하위호환 파괴)
2. 과거 기록성 문서(docs/plans/*, CHANGELOG.md) 수정
3. git 태그(`@sapper-ai/openai@0.2.x`) 삭제 — 히스토리 보존

## Impact Analysis

### 삭제 대상 패키지
- `packages/openai/**` — 237 LOC 소스 + 703 LOC 테스트

### 역방향 의존성 (빌드 파괴 지점)

| 소비자 | 참조 | 영향 |
|--------|------|------|
| `apps/web/package.json` | `@sapper-ai/openai`, `@openai/agents` dependency | **빌드 깨짐** |
| `apps/web/next.config.mjs` | `transpilePackages` | **빌드 깨짐** |
| `apps/web/app/api/agent-demo/route.ts` | import | **빌드 깨짐** |
| `apps/web/app/playground/agent/page.tsx` | import | **빌드 깨짐** |
| `apps/web/app/playground/_components/demos/agent-demo-section.tsx` | fetch `/api/agent-demo` | **런타임 404** |
| `apps/web/app/components/agent-demo-section.tsx` | re-export | **빌드 깨짐** |
| `apps/web/app/(marketing)/quickstart/config.ts` | `agents` 탭 | **UX 파괴** |
| `packages/sapper-ai/package.json` | peerDependencies (optional) | pnpm 경고 |
| `tsconfig.json` | project reference | **`tsc -b` 깨짐** |

### 영향 없는 영역 (확인 완료)

- `pnpm-workspace.yaml` — `packages/*` glob이므로 자동 제외
- `turbo.json` — openai 전용 pipeline 없음
- `.changeset/config.json` — openai 전용 설정 없음
- `.github/workflows/` — openai 전용 CI step 없음
- `packages/sapper-ai/src/` — `@sapper-ai/openai` 실제 import 없음 (peerDep만)

## TODO Checklist

### Phase 1: 역방향 의존성 제거 (빌드 필수, 패키지 삭제 전 수행)

- [ ] 1. `apps/web/app/api/agent-demo/route.ts` — 파일 전체 삭제
  - `@sapper-ai/openai`와 `@openai/agents`를 직접 import하는 agent demo API route
- [ ] 2. `apps/web/app/playground/_components/demos/agent-demo-section.tsx` — 파일 전체 삭제
  - `/api/agent-demo` fetch 호출 (line 43)
- [ ] 3. `apps/web/app/playground/agent/page.tsx` — 파일 전체 삭제
  - `AgentDemoSection` import (line 5)
- [ ] 4. `apps/web/app/components/agent-demo-section.tsx` — 파일 전체 삭제
  - `AgentDemoSection` re-export (line 3)
- [ ] 5. `apps/web/app/(marketing)/quickstart/config.ts` — agents 탭 제거
  - line 15: `quickstartTargetOrder` 배열에서 `'agents'` 제거
  - line 194-270: `agents` config 블록 전체 삭제
  - line 276: `if (value === 'openai') return 'agents'` 제거
- [ ] 6. `apps/web/package.json` — 의존성 제거
  - line 13: `"@openai/agents": "^0.4.6"` 제거
  - line 15: `"@sapper-ai/openai": "workspace:*"` 제거
- [ ] 7. `apps/web/next.config.mjs` — transpilePackages 수정
  - line 6: `'@sapper-ai/openai'` 제거 → `transpilePackages: ['@sapper-ai/core', '@sapper-ai/types'],`
- [ ] 8. `packages/sapper-ai/package.json` — peerDependencies 제거
  - line 53-56: `peerDependencies` 블록에서 `"@sapper-ai/openai"` 제거
  - line 57-59: `peerDependenciesMeta` 블록에서 `"@sapper-ai/openai"` 제거
- [ ] 9. `tsconfig.json` (루트) — project reference 제거
  - line 9: `{ "path": "packages/openai" }` 제거

### Phase 2: 패키지 삭제

- [ ] 10. `packages/openai/` — 디렉토리 전체 삭제
  - `rm -rf packages/openai`
- [ ] 11. `pnpm install` 실행 — lockfile 재생성
  - `pnpm-lock.yaml`이 자동 갱신됨 (수동 편집 금지)

### Phase 3: 빌드/테스트 검증

- [ ] 12. `pnpm build` 통과 확인
- [ ] 13. `pnpm test` 통과 확인
- [ ] 14. `pnpm exec tsc -b --noEmit` 통과 확인
- [ ] 15. 잔존 참조 확인: `rg "@sapper-ai/openai|packages/openai" --type-not=json` 실행
  - 허용 잔여: `docs/plans/*.md`, `**/CHANGELOG.md`, `.changeset/*.md` (과거 기록)
  - 불허: 그 외 모든 `.ts`, `.tsx`, `.mjs`, `.md`(README), `.yaml`, `.json`

### Phase 4: 문서/템플릿/에이전트 정리

- [ ] 16. `README.md` 수정
  - line 63: 아키텍처 다이어그램에서 `└─> @sapper-ai/openai` 라인 삭제
  - line 79: Packages 테이블에서 `@sapper-ai/openai` 행 삭제
  - line 132: 테스트 카운트 `90 tests (19 types + 50 core + 11 mcp + 10 openai)` → `80 tests (19 types + 50 core + 11 mcp)`
  - line 154: `90 tests across 4 packages` → `80 tests across 3 packages`
- [ ] 17. `.github/RELEASE_NOTES_TEMPLATE.md` — line 20: `@sapper-ai/openai` 행 삭제
- [ ] 18. `.github/PULL_REQUEST_TEMPLATE.md` — line 19: `@sapper-ai/openai` 체크박스 삭제
- [ ] 19. `.claude/plugins/sapper-reviewer/agents/sapper-reviewer.md` — openai 패키지 참조 제거
  - line 50, 67, 78, 94, 188: 아키텍처 규칙에서 openai 관련 내용 제거/수정
- [ ] 20. MEMORY.md 업데이트 — Architecture 섹션에서 `openai/` 행 삭제

### Phase 5: 릴리스

- [ ] 21. changeset 생성
  - `sapper-ai`: patch — "Remove @sapper-ai/openai peerDependency"
  - `@sapper-ai/openai`: 패키지 제거이므로 changeset 대상 아님
- [ ] 22. npm deprecate 실행 (머지+릴리스 후)
  - `npm deprecate "@sapper-ai/openai@*" "This package has been removed. Use sapper-ai CLI or @sapper-ai/core directly."`
- [ ] 23. 릴리스 노트에 명시
  - OpenAI Agents SDK adapter 종료
  - 권장 경로: `sapper-ai` CLI + MCP proxy

## Execution Order

```
Phase 1 (#1-#9)  역방향 의존성 먼저 제거
    ↓
Phase 2 (#10-#11) 패키지 삭제 + pnpm install
    ↓
Phase 3 (#12-#15) 빌드/테스트/잔존참조 검증
    ↓
Phase 4 (#16-#20) 문서/에이전트 정리
    ↓
Phase 5 (#21-#23) changeset + npm deprecate
```

순서 중요: Phase 1 → 2 → 3은 반드시 순차. Phase 4는 Phase 3 통과 후 병렬 가능.

## Allowed Residual References

`rg` 검색 시 아래 파일에서의 `@sapper-ai/openai` 참조는 과거 기록으로 허용:

- `docs/plans/*.md` — 과거 계획 문서
- `packages/sapper-ai/CHANGELOG.md` — 릴리스 히스토리
- `apps/web/CHANGELOG.md` — 릴리스 히스토리
- `.changeset/*.md` — 과거 changeset

## Decisions

| 항목 | 결정 | 이유 |
|------|------|------|
| agent-demo route | 전체 삭제 | 리팩터링 불가 — 존재 이유가 OpenAI Agents SDK 데모 |
| npm deprecate | 실행 | 기존 사용자에게 경고 제공 |
| git 태그 | 유지 | 히스토리 보존 |
| quickstart agents 탭 | 삭제 | `@sapper-ai/openai` 설치/사용법이므로 유지 불가 |
| apps/web playground/agent | 삭제 | agent-demo API route 의존 |
