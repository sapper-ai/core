# 2026-02-16 모노레포 정리 계획

## Summary

@sapper-ai/openai 삭제 후 모노레포 전체 감사에서 발견된 dead code, 미사용 패키지, orphan 파일을 정리한다.

## Scope

| 대상 | 크기 | 조치 |
|------|------|------|
| `e2e/` 디렉토리 | 3.6MB, ~490줄 | 전체 삭제 |
| `packages/dashboard/` | 29MB | 전체 삭제 + CLI dashboard 명령 제거 |
| `scripts/run-real-env-mcp-scan.mjs` | 651줄 | 삭제 (DiscoveryUtils로 이전 완료) |
| `apps/web/app/components/hero-section.tsx` | ~50줄 | 삭제 (import 0건) |
| `docs/reports/2026-02-10-real-env-mcp-scan.json` | ~100KB | 삭제 |
| `docs/memo.txt` | 임시 | 삭제 (untracked) |

## Verification Results

### e2e/
- CI에서 명시적 제외: `release.yml` → `pnpm test --filter=!e2e`
- `pnpm-workspace.yaml`에 등록되어 있으나 turbo pipeline에서 제외
- 테스트 내용이 현재 앱 구조와 불일치 (과거 해커톤 문구 expect)
- `package-lock.json` 존재 → pnpm이 아닌 npm으로 별도 관리된 흔적

### packages/dashboard/
- `standalone/` 디렉토리에 실제 Next.js 빌드물 없음 → `sapper-ai dashboard` 명령 현재 동작 불가
- CLI의 `runDashboard()` (cli.ts:634-677) 흐름:
  1. `require.resolve('@sapper-ai/dashboard/bin/start')` 시도 → 실패 (빌드물 없음)
  2. `apps/web/package.json` 존재 확인 → dev 모드 fallback (`npx next dev`)
  3. 둘 다 실패 시 설치 안내 출력
- dev fallback은 `apps/web`이 있는 로컬 개발 환경에서만 동작 → standalone 배포 의미 없음
- `@sapper-ai/dashboard` 참조: `cli.ts`, `dashboard/package.json`, `dashboard/CHANGELOG.md`, `docs/plans/` (과거 기록)

### scripts/run-real-env-mcp-scan.mjs
- `packages/core/src/discovery/DiscoveryUtils.ts`에 `collectMcpTargets` 등 핵심 로직 이전 완료
- CI/package.json scripts에서 참조 없음
- `docs/plans/publication_plan.md`에서 "이전 계획" 언급만

## TODO Checklist

### Phase 1: e2e 삭제

- [ ] 1. `e2e/` 디렉토리 전체 삭제
  - `rm -rf e2e`
- [ ] 2. `pnpm-workspace.yaml` line 4: `- 'e2e'` 항목 제거
  - 변경 후: `packages:` 아래에 `- 'apps/*'`과 `- 'packages/*'`만 남김

### Phase 2: dashboard 패키지 + CLI 명령 삭제

- [ ] 3. `packages/dashboard/` 디렉토리 전체 삭제
  - `rm -rf packages/dashboard`
- [ ] 4. `packages/sapper-ai/src/cli.ts` — dashboard 관련 코드 제거
  - line 95-97: `if (argv[0] === 'dashboard')` 분기 삭제
  - line 134: usage 출력에서 `sapper-ai dashboard     Launch web dashboard` 행 삭제
  - line 634-677: `runDashboard()` 함수 전체 삭제
  - `spawn` import가 dashboard에서만 사용되는지 확인 후 미사용이면 import도 제거
  - `resolve`, `existsSync` import가 dashboard에서만 사용되는지 확인 후 미사용이면 import도 제거
- [ ] 5. `packages/sapper-ai/package.json` — `@sapper-ai/dashboard` 관련 의존성이 있으면 제거
  - 현재 dependencies에 없으므로 변경 없을 수 있음 — 확인 필요

### Phase 3: orphan 파일 삭제

- [ ] 6. `scripts/run-real-env-mcp-scan.mjs` 삭제
- [ ] 7. `apps/web/app/components/hero-section.tsx` 삭제
- [ ] 8. `docs/reports/2026-02-10-real-env-mcp-scan.json` 삭제
- [ ] 9. `docs/memo.txt` 삭제

### Phase 4: lockfile 재생성 + 검증

- [ ] 10. `pnpm install` — lockfile 재생성
- [ ] 11. `pnpm build` 통과 확인
- [ ] 12. `pnpm test` 통과 확인
- [ ] 13. `pnpm exec tsc -b --noEmit` 통과 확인
- [ ] 14. 잔존 참조 확인
  - `rg "@sapper-ai/dashboard" --glob "!**/CHANGELOG.md" --glob "!docs/plans/**"` → 0건
  - `rg "hero-section" apps/web/` → 0건
  - `rg "run-real-env" --glob "!docs/plans/**"` → 0건

### Phase 5: 문서 정리

- [ ] 15. README.md — dashboard 관련 내용이 있으면 제거 (확인 필요)
- [ ] 16. AGENTS.md — dashboard 패키지 참조가 있으면 제거 (확인 필요)

## Execution Order

```
Phase 1 (#1-#2)  e2e 삭제 + workspace 수정
    ↓
Phase 2 (#3-#5)  dashboard 삭제 + CLI 코드 제거
    ↓
Phase 3 (#6-#9)  orphan 파일 삭제
    ↓
Phase 4 (#10-#14) pnpm install + 빌드/테스트 검증
    ↓
Phase 5 (#15-#16) 문서 정리
```

## Decisions

| 항목 | 결정 | 이유 |
|------|------|------|
| e2e 삭제 | 전체 삭제 | CI 미연결, 현재 앱과 불일치, 소비자 없음 |
| dashboard 삭제 | 전체 삭제 + CLI 명령 제거 | standalone 빌드물 없어 동작 불가, dev fallback은 `pnpm dev:web`과 중복 |
| scripts 삭제 | 삭제 | DiscoveryUtils로 이전 완료, CI/scripts 미참조 |
| hero-section 삭제 | 삭제 | import 0건 orphan 컴포넌트 |
| docs 파일 삭제 | 삭제 | 과거 스캔 결과 + 개인 메모, 참조 없음 |
