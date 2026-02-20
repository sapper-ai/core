# SapperAI Landing Page Improvement Plan

## Context

코드베이스 분석 결과 2개의 버그와 다수의 개선 포인트가 발견되었습니다.

**Bug 1**: 다크 모드에서 프리셋 박스 클릭 시 하얗게 변하는 문제
**Bug 2**: Vercel 배포 환경에서 audit log 파일 쓰기 오류 (EROFS)
**개선**: 모바일 네비게이션 부재, 접근성 문제, 코드 중복 등

---

## Phase 1: Critical Bug Fixes (P0)

### 1-1. 프리셋 박스 다크 모드 스타일 버그

**파일**: `apps/web/app/playground/_components/demos/interactive-demo-section.tsx`

**원인**: 선택 상태에서 `bg-ink text-white` 사용. 다크 모드에서 `--color-ink`가 `229 231 235`(거의 흰색)이므로 흰 배경 + 흰 텍스트 = 박스가 하얗게 보임.

**수정 (line ~189-191)**:
```tsx
// Before
isActive ? 'border-ink bg-ink text-white' : '...'

// After - olive 브랜드 컬러 사용 (다크모드 독립적)
isActive
  ? 'border-olive-700 bg-olive-700 text-white dark:border-olive-400 dark:bg-olive-400 dark:text-gray-900'
  : 'border-border bg-surface text-ink hover:bg-muted'
```

내부 텍스트도 수정 (line ~194-195):
```tsx
// title
isActive ? 'text-white dark:text-gray-900' : 'text-ink'
// summary
isActive ? 'text-olive-200 dark:text-olive-800' : 'text-steel'
```

- [ ] 버튼 className의 isActive 분기에서 `bg-ink` -> `bg-olive-700 dark:bg-olive-400` 변경
- [ ] title 텍스트 isActive에 `dark:text-gray-900` 추가
- [ ] summary 텍스트 isActive에 `text-olive-200 dark:text-olive-800` 적용
- [ ] 검증: 라이트/다크 모드 모두에서 프리셋 4개 클릭하여 선택 상태 확인

### 1-2. Vercel EROFS 오류 (audit log 경로)

**파일**: `apps/web/app/api/shared/paths.ts`

**원인**: `shouldUseTmpDir()` 함수의 Vercel 환경 감지가 불완전.

**수정**: `shouldUseTmpDir()` 함수 강화
```typescript
// Before
function shouldUseTmpDir(): boolean {
  return (
    process.cwd().startsWith('/var/task') ||
    process.env.VERCEL === '1' ||
    typeof process.env.AWS_LAMBDA_FUNCTION_NAME === 'string'
  )
}

// After - 더 넓은 감지 범위 + 쓰기 테스트 폴백
function shouldUseTmpDir(): boolean {
  if (
    process.cwd().startsWith('/var/task') ||
    process.env.VERCEL !== undefined ||
    typeof process.env.AWS_LAMBDA_FUNCTION_NAME === 'string' ||
    process.env.NEXT_RUNTIME === 'nodejs'
  ) return true

  // Fallback: cwd에 쓰기 가능한지 직접 테스트
  try {
    const testPath = path.resolve(process.cwd(), '.write-test')
    fs.writeFileSync(testPath, '')
    fs.unlinkSync(testPath)
    return false
  } catch {
    return true
  }
}
```

- [ ] `VERCEL === '1'` -> `VERCEL !== undefined`로 변경
- [ ] `NEXT_RUNTIME === 'nodejs'` 조건 추가
- [ ] 쓰기 테스트 폴백 로직 추가
- [ ] 검증: Vercel 배포 후 `/playground/runtime`에서 탐지 실행

---

## Phase 2: Mobile Navigation (P0)

### 2-1. 모바일 햄버거 메뉴 추가

**파일**: `apps/web/app/(marketing)/components/site-header.tsx`

**현상**: `hidden md:flex`로 nav가 768px 미만에서 완전히 사라짐.

- [ ] `SiteHeader`를 `'use client'` 컴포넌트로 변경 (useState 필요)
- [ ] `GitHubStars`는 async RSC이므로 children prop으로 받거나, 별도 클라이언트 wrapper 사용
- [ ] 햄버거 버튼 추가 (`md:hidden`, 3-line SVG icon)
- [ ] 클릭 시 드롭다운 메뉴 표시 (absolute positioning, bg-frost)
- [ ] Playground, Quickstart, GitHub 링크 포함
- [ ] ESC 키 또는 외부 클릭으로 닫기
- [ ] `aria-expanded`, `aria-controls` 접근성 속성 추가
- [ ] 검증: 모바일 뷰포트(375px)에서 햄버거 메뉴 동작 확인

---

## Phase 3: Accessibility Improvements (P1-P2)

### 3-1. 에러 메시지 `role="alert"` 추가

**파일들**:
- `apps/web/app/playground/_components/demos/campaign-section.tsx` (line ~107)
- `apps/web/app/playground/_components/demos/interactive-demo-section.tsx`
- `apps/web/app/playground/_components/demos/upload-section.tsx`

- [ ] 모든 에러 `<div>`에 `role="alert"` 추가

### 3-2. Campaign 테이블 시맨틱 마크업

**파일**: `apps/web/app/playground/_components/demos/campaign-section.tsx` (line ~233-260)

- [ ] `div` + `ul/li` 그리드를 `<table>/<thead>/<tbody>/<tr>/<th>/<td>`로 변환
- [ ] `min-w-[860px]` 유지하여 가로 스크롤 보존
- [ ] sticky 헤더는 `<thead>` + `sticky top-0`으로 구현

### 3-3. 장식용 요소 aria-hidden

**파일들**:
- `apps/web/app/(marketing)/components/demo-preview.tsx` (line 21-23)
- `apps/web/app/(marketing)/components/quickstart-preview.tsx` (line 33-35)

- [ ] macOS window dot의 부모 div에 `aria-hidden="true"` 추가

### 3-4. 외부 링크 aria-label 일관성

**파일**: `apps/web/app/(marketing)/components/quickstart-preview.tsx` (line 53-60)

- [ ] `<a>` 태그에 `aria-label="View repository (opens in a new tab)"` 추가

### 3-5. 로딩 스피너 접근성

**파일들**: campaign-section, interactive-demo-section, upload-section, config/page

- [ ] 스피너 `<span>`에 `aria-hidden="true"` 추가
- [ ] 실행 버튼에 `aria-busy={loading}` 추가

---

## Phase 4: Code Quality (P1)

### 4-1. toQueryString 중복 제거

**중복 파일 3개**:
- `apps/web/app/playground/detect/page.tsx`
- `apps/web/app/playground/campaign/page.tsx`
- `apps/web/app/playground/upload/page.tsx`

- [ ] `apps/web/app/playground/_lib/query-string.ts` 생성
- [ ] `SearchParams` 타입 + `toQueryString()` 함수를 추출
- [ ] 3개 redirect 파일에서 import하여 사용
- [ ] 기존 중복 코드 삭제

---

## Summary

| Phase | 항목 | 우선순위 | 파일 수 |
|-------|------|----------|---------|
| 1 | 프리셋 박스 다크모드 버그 | P0 | 1 |
| 1 | EROFS audit log 오류 | P0 | 1 |
| 2 | 모바일 햄버거 메뉴 | P0 | 1 |
| 3 | 접근성 개선 (5개 항목) | P1-P2 | 6 |
| 4 | toQueryString 중복 제거 | P1 | 4 (1 new + 3 edit) |

**총 변경 파일**: ~13개

## Verification

1. `pnpm build` - 빌드 성공 확인
2. `pnpm dev:web` - 로컬 개발 서버에서:
   - 다크/라이트 모드 전환하며 프리셋 박스 클릭 테스트
   - 모바일 뷰포트(375px)에서 햄버거 메뉴 동작 확인
   - 각 playground 데모 실행하여 에러 표시 확인
3. Vercel 배포 후 `/playground/runtime`에서 탐지 실행 -> EROFS 오류 해소 확인
