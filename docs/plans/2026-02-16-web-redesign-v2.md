# SapperAI Web Redesign Plan v2

> **Status**: **APPROVED** (Planner + Architect + Critic 3차 리뷰 합의 달성)
> **Date**: 2026-02-16
> **Scope**: Design system overhaul, Dashboard removal, Layout restructure
> **Supersedes**: `2026-02-16-web-redesign-v1.md`

---

## Changelog (v1 → v2)

- **[Critical]** CSS 변수를 RGB 채널 방식으로 변경 (opacity modifier 호환)
- **[Critical]** `/api/dashboard/policy` → `/api/policy`로 이전 (Playground config 의존성)
- **[Critical]** Dashboard 참조 누락 파일 4개 추가
- **[High]** 다크 모드 primary를 `olive-400` (#8fa85c)로 상향 (WCAG AA 통과)
- **[Medium]** `theme-color` 메타 태그, 로고 다크 모드 대응 추가
- **[Medium]** Phase 3-5 검증 방법 보강
- **[Medium]** Phase 중복 TODO 정리, `providers.tsx` `'use client'` 명시
- **[Medium]** 하드코딩 색상 마이그레이션 전략 결정 (CSS 변수 일괄 교체)
- **[Low]** Bento Grid 세부 grid-template 스펙 추가
- **[Low]** 아이콘: 인라인 SVG 사용 (lucide-react 미설치)

## Changelog (v2 → v2.1, Architect/Critic 피드백 반영)

- **[High]** Phase 2: `api/shared/` 디렉토리 생성 검증 + import 경로 검증 추가
- **[High]** Phase 2: `playground/config/page.tsx:85` 링크 제거 방침 명확화
- **[High]** Phase 3-5: 모든 "시각 확인" 검증을 DevTools 기반 체크리스트로 교체
- **[Medium]** Phase 1: CSS 변수 RGB 채널 검증을 DevTools 절차로 구체화
- **[Medium]** Phase 6: WCAG 검증을 대비율 조합 목록 + Lighthouse 점수로 구체화
- **[Low]** Phase 6: API 엔드포인트 smoke test 추가

---

## 1. Overview

SapperAI 마케팅 웹사이트의 디자인 시스템을 전면 개편한다.

### Goals
1. **다크/라이트 모드 지원** - 시스템 설정(prefers-color-scheme) 기반 자동 전환 + 수동 토글
2. **다크 모드 Primary Color: 국방색(Olive Drab)** - `#4B5320` 기반, 다크 모드에서는 WCAG AA 통과하는 `#8fa85c` (olive-400) 사용
3. **Dashboard 섹션 완전 삭제** (Policy API는 `/api/policy`로 이전)
4. **업계 표준 레이아웃 적용** - Bento Grid, Glass Morphism 강화

---

## 2. Current State Analysis

### 현재 구조
```
apps/web/app/
├── (marketing)/     → 홈, 퀵스타트, 데모 리다이렉트
├── dashboard/       → Overview, Audit, Campaign, Policy, Threat Intel (삭제 대상)
├── playground/      → Runtime, Skill Scan, Agent, Adversary, Config
├── components/      → 공유 컴포넌트 (RiskBar, StatusBadge, CircularGauge 등)
└── api/             → detect, scan-file, agent-demo, adversary-campaign, dashboard/*
```

### 현재 디자인 시스템
- **다크 모드**: 미구현 (단일 라이트 테마)
- **색상**: ink(#0a0a0a), steel(#4b5563), frost(#fafafa), mint(#22c55e), ember(#ef4444), signal(#3b82f6)
- **CSS 변수**: `--ink`, `--steel` 등 짧은 이름 (hex 값)
- **Tailwind**: 3.4.17, hex 직접 지정, `darkMode` 미설정
- **Shadow**: subtle, lifted
- **Glass**: SiteHeader backdrop-blur만 제한적 사용
- **Typography**: system-ui + Apple SD Gothic Neo + Noto Sans KR
- **Opacity modifier 사용**: `bg-frost/80` (site-header.tsx:11)

---

## 3. Design System Overhaul

### 3.1 Color Palette

#### Light Mode (기존 유지 + 보완)
```
frost:     #fafafa   → 배경
surface:   #ffffff   → 카드/컴포넌트 배경
ink:       #0a0a0a   → 주요 텍스트
steel:     #4b5563   → 보조 텍스트
border:    #e5e7eb   → 테두리
muted:     #f3f4f6   → 비활성 배경
signal:    #3b82f6   → 강조 (primary)
mint:      #22c55e   → 성공/허용
ember:     #ef4444   → 위험/차단
warn:      #f59e0b   → 경고
```

#### Dark Mode (NEW)
```
frost:     #0a0a0a   → 배경 (deep dark, 순수 검정 피함)
surface:   #1a1a1a   → 카드/컴포넌트 배경 (elevated dark)
ink:       #e5e7eb   → 주요 텍스트 (순수 흰색 피함)
steel:     #9ca3af   → 보조 텍스트
border:    #2d3a2e   → 테두리 (국방색 틴트)
muted:     #1f2a1f   → 비활성 배경 (국방색 틴트)
signal:    #8fa85c   → 강조 (PRIMARY: olive-400, WCAG AA 5.5:1 on #1a1a1a)
mint:      #4ade80   → 성공 (밝기 보정)
ember:     #f87171   → 위험 (밝기 보정)
warn:      #fbbf24   → 경고 (밝기 보정)
```

#### 국방색 (Olive Drab) 팔레트
```
olive-50:   #f5f7f0
olive-100:  #e8eddb
olive-200:  #d1dbb8
olive-300:  #b3c48a
olive-400:  #8fa85c   ← 다크 모드 primary (WCAG AA: ~5.5:1 on #1a1a1a)
olive-500:  #6b8e3a   ← 라이트 모드 강조/버튼
olive-600:  #5e7a3a
olive-700:  #4B5320   ← 브랜드 앵커 (진한 국방색)
olive-800:  #3d4420
olive-900:  #343a1e
olive-950:  #1a1f0e
```

#### 접근성 가이드라인
- **다크 모드 primary (olive-400)**: 일반 텍스트 OK (5.5:1), 대형 텍스트/버튼 OK
- **olive-500/600/700**: 다크 배경 위에서 일반 텍스트에 사용 금지 (대비율 미달)
- **olive-500**: 라이트 모드에서만 primary로 사용

### 3.2 CSS Variables Architecture (RGB 채널 방식)

> **핵심 변경**: Tailwind opacity modifier (`bg-surface/80`) 호환을 위해
> CSS 변수에 **RGB 채널 값만** 저장한다.

```css
/* globals.css */
:root {
  /* Semantic tokens - RGB channels only */
  --color-frost: 250 250 250;
  --color-surface: 255 255 255;
  --color-ink: 10 10 10;
  --color-steel: 75 85 99;
  --color-border: 229 231 235;
  --color-muted: 243 244 246;
  --color-signal: 59 130 246;
  --color-mint: 34 197 94;
  --color-ember: 239 68 68;
  --color-warn: 245 158 11;

  /* Glass morphism (rgba 직접 - 채널 방식 불가) */
  --glass-bg: rgba(255, 255, 255, 0.7);
  --glass-border: rgba(229, 231, 235, 0.5);

  /* theme-color meta tag */
  --theme-color: #fafafa;
}

.dark {
  --color-frost: 10 10 10;
  --color-surface: 26 26 26;
  --color-ink: 229 231 235;
  --color-steel: 156 163 175;
  --color-border: 45 58 46;
  --color-muted: 31 42 31;
  --color-signal: 143 168 92;       /* olive-400 */
  --color-mint: 74 222 128;
  --color-ember: 248 113 113;
  --color-warn: 251 191 36;

  --glass-bg: rgba(26, 26, 26, 0.8);
  --glass-border: rgba(143, 168, 92, 0.2);

  --theme-color: #0a0a0a;
}
```

### 3.3 Tailwind Config Changes

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Static olive palette (항상 동일)
        olive: {
          50: '#f5f7f0',
          100: '#e8eddb',
          200: '#d1dbb8',
          300: '#b3c48a',
          400: '#8fa85c',
          500: '#6b8e3a',
          600: '#5e7a3a',
          700: '#4B5320',
          800: '#3d4420',
          900: '#343a1e',
          950: '#1a1f0e',
        },
        // Semantic colors via CSS variables (opacity modifier 호환)
        frost: 'rgb(var(--color-frost) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        steel: 'rgb(var(--color-steel) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        signal: 'rgb(var(--color-signal) / <alpha-value>)',
        mint: 'rgb(var(--color-mint) / <alpha-value>)',
        ember: 'rgb(var(--color-ember) / <alpha-value>)',
        warn: 'rgb(var(--color-warn) / <alpha-value>)',
      },
      boxShadow: {
        subtle: '0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.06)',
        lifted: '0 4px 24px -4px rgba(0, 0, 0, 0.08)',
      },
    },
  },
  plugins: [],
}
export default config
```

### 3.4 하드코딩 색상 마이그레이션 전략

> **결정**: CSS 변수 기반으로 일괄 교체. `dark:` 프리픽스 불필요.

기존 코드에서 `bg-white`, `text-ink`, `border-border` 등 하드코딩 Tailwind 클래스가 49개 파일에 걸쳐 사용 중.
CSS 변수 기반 semantic color로 전환하면 다크 모드 시 `dark:` 프리픽스 없이 자동 전환됨.

**마이그레이션 규칙**:
| 기존 | 변경 | 이유 |
|------|------|------|
| `bg-white` | `bg-surface` | CSS 변수가 테마에 맞게 자동 전환 |
| `bg-[#0a0a0a]` (코드 블록) | 유지 | 코드 블록은 항상 다크 |
| `text-gray-100` (코드 블록 내) | 유지 | 코드 블록은 항상 다크 |
| `bg-frost` | `bg-frost` | 이미 semantic name, CSS 변수로 전환됨 |
| `text-ink` | `text-ink` | 이미 semantic name, CSS 변수로 전환됨 |
| `border-border` | `border-border` | 이미 semantic name |
| `bg-red-50`, `border-red-200` 등 | 유지 | 에러 상태는 테마 무관 |

### 3.5 Dark Mode Implementation (next-themes)

```bash
pnpm --filter web add next-themes
```

**providers.tsx** (NEW):
```tsx
// apps/web/app/providers.tsx
'use client'

import { ThemeProvider } from 'next-themes'
import type { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </ThemeProvider>
  )
}
```

**layout.tsx 수정**:
```tsx
// apps/web/app/layout.tsx
import { Providers } from './providers'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#fafafa" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0a0a0a" media="(prefers-color-scheme: dark)" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

**ThemeToggle 컴포넌트**:
- 3-state: System / Light / Dark (순환 버튼)
- `useTheme()` + `mounted` state guard
- **인라인 SVG 아이콘** (lucide-react 미설치, 의존성 최소화)
- SiteHeader 오른쪽에 배치

---

## 4. Dashboard Removal

### 4.1 삭제 대상 파일/디렉토리

#### Pages & Components
- `apps/web/app/dashboard/` (전체 디렉토리)

#### API Routes (부분 삭제)
- `apps/web/app/api/dashboard/metrics/` → 삭제
- `apps/web/app/api/dashboard/audit-logs/` → 삭제
- `apps/web/app/api/dashboard/threat-intel/` → 삭제
- `apps/web/app/api/dashboard/utils.ts` → `/api/shared/` 하위로 이동 (audit log reader)

#### API Routes (이전)
- `apps/web/app/api/dashboard/policy/` → **`apps/web/app/api/policy/`로 이동**
  - Playground config 페이지가 이 API에 의존 (`playground/config/page.tsx:36`)

### 4.2 Dashboard 참조 정리 (전체 목록)

| 파일 | 라인 | 내용 | 조치 |
|------|------|------|------|
| `(marketing)/components/site-header.tsx` | 네비 | "Dashboard" 링크 | 제거 |
| `(marketing)/page.tsx` | CTA | Dashboard 버튼 | 제거 |
| `(marketing)/components/demo-preview.tsx` | :32 | `href="/dashboard"` "View dashboard" | Playground 링크로 변경 |
| `(marketing)/components/quickstart-preview.tsx` | :26,:33 | "대시보드 실행" 텍스트 + `npx sapper-ai dashboard` | 텍스트 수정, 코드 블록 변경 |
| `(marketing)/quickstart/config.ts` | :39 | `highlights[2]` "대시보드" | 삭제 또는 대체 |
| `(marketing)/quickstart/config.ts` | :103-109 | SDK step 4 "대시보드 실행" | 삭제 또는 대체 |
| `playground/layout.tsx` | 네비 | Dashboard 링크 | 제거 |
| `playground/config/page.tsx` | :36 | `fetch('/api/dashboard/policy')` | `/api/policy`로 변경 |
| `playground/config/page.tsx` | :85 | `href="/dashboard/policy"` | 링크 제거 또는 Playground 내 다른 페이지로 |

### 4.3 보존 대상
- `apps/web/app/api/adversary-campaign/` (Playground에서 사용)
- `apps/web/app/api/policy/` (dashboard에서 이전, Playground config에서 사용)
- `apps/web/app/components/` 공유 컴포넌트 (Playground에서 사용 중인 것만)
  - `risk-bar.tsx`, `status-badge.tsx`, `circular-gauge.tsx` → Playground에서 사용
- Dashboard 전용 컴포넌트 (삭제):
  - `dashboard/components/dashboard-nav.tsx`
  - `dashboard/components/metric-card.tsx`
  - `dashboard/components/timeline-chart.tsx`
  - `dashboard/components/threat-list.tsx`

---

## 5. Layout Restructure

### 5.1 업계 분석 요약

| 사이트 | 히어로 | 색상 전략 | 네비게이션 | 특징 |
|--------|--------|----------|-----------|------|
| **Snyk** | Full-width, 왼쪽 정렬 | 듀얼 에셋(다크/라이트) | 메가메뉴 3컬럼 | 통계 강조, 로고 마키 |
| **CrowdStrike** | 캐러셀, 2컬럼 분할 | 레드/블루, 다크 히어로 | 유틸리티 바 + 메인 네비 | F-패턴, 티어드 프라이싱 |
| **SentinelOne** | 중앙 정렬, 대형 스크린샷 | 다크 퍼플, 다크모드 우선 | 메가메뉴 5항목 | 85px 헤드라인, 통계 카운터 |
| **Darktrace** | 2줄 헤드라인, 듀얼 CTA | 블랙 + 오렌지 액센트 | A/B 테스팅 CTA | 로고 마키, 탭 쇼케이스 |
| **Wiz** | 그라디언트 배경, 이메일 캡처 | 클라우드 이미지 중심 | 최소 탑바 + 메인 네비 | Fortune 100 강조 |

### 5.2 제안 레이아웃 (Single-Page Marketing)

```
┌──────────────────────────────────────────────────────┐
│  [1] STICKY HEADER (Glass morphism)                   │
│  Logo "SapperAI" | Playground | Quickstart | GitHub  │
│  ─────────────────────────────── [Theme Toggle] [CTA]│
├──────────────────────────────────────────────────────┤
│  [2] HERO SECTION (다크 그라디언트 배경)                │
│                                                       │
│  "AI 에이전트 공격을 실시간으로 차단하세요"              │
│  Subtitle text...                                     │
│                                                       │
│  ┌────────┐ ┌────────┐ ┌────────┐                    │
│  │ 96%    │ │ 0%     │ │ p99    │  ← 통계 배지       │
│  │ 차단율  │ │ 오탐률  │ │0.002ms│                    │
│  └────────┘ └────────┘ └────────┘                    │
│                                                       │
│  [Playground 시작하기]  [Quickstart 보기]              │
│                                                       │
├──────────────────────────────────────────────────────┤
│  [3] BENTO FEATURE GRID (grid-cols-3 grid-rows-2)    │
│  ┌──────────────────┬──────────┐                     │
│  │  col-span-2      │ col-1    │                     │
│  │  row-span-2      │ row-1    │                     │
│  │  Interactive Demo │ "60+ 룰" │                     │
│  │  (코드 프리뷰)    │          │                     │
│  ├────────┬─────────┼──────────┤                     │
│  │ col-1  │ col-1   │ col-1    │                     │
│  │ row-1  │ row-1   │ row-1    │                     │
│  │ MCP    │ OpenAI  │ Direct   │                     │
│  │ Proxy  │ Agents  │ SDK      │                     │
│  └────────┴─────────┴──────────┘                     │
│                                                       │
│  Tailwind: grid grid-cols-3 grid-rows-2 gap-4        │
│  Hero card: col-span-2 row-span-2                    │
│  Mobile: grid-cols-1 (모바일에서 순차 스택)             │
├──────────────────────────────────────────────────────┤
│  [4] HOW IT WORKS (Glass Cards)                      │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐              │
│  │ 1. Wrap │→ │ 2. Scan │→ │ 3. Block│              │
│  │ glass   │  │ glass   │  │ glass   │              │
│  └─────────┘  └─────────┘  └─────────┘              │
├──────────────────────────────────────────────────────┤
│  [5] QUICKSTART                                      │
│  3-step terminal preview (dark code block)           │
│  pnpm add sapper-ai → configure → protect           │
├──────────────────────────────────────────────────────┤
│  [6] FOOTER                                          │
│  Brand + tagline | GitHub | npm | Docs               │
└──────────────────────────────────────────────────────┘
```

### 5.3 섹션별 디자인 스펙

#### [1] Sticky Header
- Glass morphism: `bg-frost/80 backdrop-blur-xl border-b border-border`
- 네비: Playground | Quickstart | GitHub
- 오른쪽: ThemeToggle + "Get Started" CTA
- 로고 다크 모드: `bg-ink text-frost` → `dark:bg-olive-400 dark:text-ink` (다크 배경에서 구분)
- **다크 모드 자동 적용** (CSS 변수 기반, `dark:` 프리픽스 불필요)

#### [2] Hero Section
- 라이트: 기존 signal/mint blur 효과 유지
- 다크: olive 그라디언트 배경 (`dark:from-olive-950 dark:via-olive-900 dark:to-frost`)
- 통계 배지: Glass card (`bg-surface/60 backdrop-blur border border-border`)
- CTA: Primary(filled, `bg-signal text-frost`) + Secondary(outlined, `border-border text-ink`)

#### [3] Bento Feature Grid
- **Grid**: `grid grid-cols-3 grid-rows-2 gap-4`
- **Hero Card**: `col-span-2 row-span-2` (Interactive Demo)
- **Standard Cards**: `col-span-1 row-span-1` (4개)
- **Mobile**: `grid-cols-1` (모바일 순차 스택, hero card는 `col-span-1 row-span-1`)
- 카드 스타일: `bg-surface border border-border rounded-2xl p-6 shadow-subtle`
- 호버: `hover:shadow-lifted hover:scale-[1.01] transition-all duration-200`

#### [4] How It Works
- 3-step glass card: `bg-surface/60 backdrop-blur-lg border border-border rounded-2xl`
- 스텝 간 화살표(→): `text-signal` 색상

#### [5] Quickstart
- 다크 코드 블록: `bg-[#0a0a0a]` (항상 다크, 변경 불필요)
- 3-step list: `bg-surface border border-border`

#### [6] Footer
- `bg-frost border-t border-border`
- 링크: GitHub, npm, Documentation
- 다크 모드 자동 적용 (CSS 변수)

---

## 6. Implementation TODO List

### Phase 1: Design System Foundation

> **의존성**: 없음 (독립 실행 가능)
> **Phase 1 완료 후 필수 검증**: `bg-frost/80` opacity modifier 정상 동작 확인

- [ ] `globals.css` 수정
  - 기존 `:root` CSS 변수를 RGB 채널 방식으로 변경
  - `.dark` 블록 추가 (올리브 틴트 적용)
  - glass morphism 변수 추가
  - **위 3.2절의 코드 그대로 적용**
  - **파일**: `apps/web/app/globals.css`
  - **검증**:
    1. `pnpm --filter web dev` → http://localhost:3000 접속
    2. DevTools → Elements → `<html>` 선택 → Styles 패널에서 `:root` 펼침
    3. `--color-frost: 250 250 250` 형태인지 확인 (hex `#fafafa` 아님)
    4. `.dark` 블록이 존재하고 `--color-signal: 143 168 92` 포함 확인

- [ ] `tailwind.config.ts` 수정
  - `darkMode: 'class'` 추가
  - `olive` 색상 팔레트 추가 (static hex)
  - 기존 semantic colors를 `rgb(var(--color-xxx) / <alpha-value>)` 형태로 변경
  - **위 3.3절의 코드 그대로 적용**
  - **파일**: `apps/web/tailwind.config.ts`
  - **검증**:
    1. `pnpm --filter web build` 성공 (에러 없음)
    2. 브라우저에서 SiteHeader 요소 우클릭 → Inspect
    3. Computed Styles에서 `background-color` 확인
    4. 예상값: `rgba(250, 250, 250, 0.8)` (frost/80 opacity modifier 정상 동작)

- [ ] `next-themes` 설치 및 ThemeProvider 설정
  - `pnpm --filter web add next-themes`
  - `apps/web/app/providers.tsx` 생성 (**`'use client'` 디렉티브 필수**)
  - `apps/web/app/layout.tsx` 수정:
    - `<html lang="ko" suppressHydrationWarning>`
    - `<head>` 내 `theme-color` 메타 태그 2개 추가
    - `<body>` 내 `<Providers>` 래핑
  - **위 3.5절의 코드 그대로 적용**
  - **검증**: 시스템 다크 모드 전환 시 `<html class="dark">` 자동 적용, FOUC 없음

- [ ] ThemeToggle 컴포넌트 생성
  - `apps/web/app/components/theme-toggle.tsx`
  - `'use client'` 디렉티브
  - 3-state: System → Light → Dark (순환)
  - `useTheme()` + `useState(false)` mounted guard
  - 인라인 SVG 아이콘 (Sun/Moon/Monitor)
  - **검증**: 토글 클릭 시 테마 전환, 새로고침 후 선택 유지 (localStorage)

### Phase 2: Dashboard Removal

> **의존성**: Phase 1 불필요 (독립 실행 가능, Phase 1과 병렬 가능)

- [ ] Policy API 이전
  - `mkdir -p apps/web/app/api/shared` (디렉토리 생성)
  - `apps/web/app/api/dashboard/utils.ts` → `apps/web/app/api/shared/utils.ts`로 이동
  - `apps/web/app/api/dashboard/policy/` → `apps/web/app/api/policy/`로 이동
  - `apps/web/app/api/policy/route.ts` 내 import 경로 업데이트: `import { ... } from '../shared/utils'`
  - **검증**:
    1. `ls apps/web/app/api/shared/utils.ts` → 파일 존재 확인
    2. `pnpm --filter web build` → 에러 없음
    3. `pnpm --filter web dev` → `curl http://localhost:3000/api/policy` 정상 응답 (200 OK)

- [ ] Playground config 페이지 업데이트
  - `apps/web/app/playground/config/page.tsx`
    - `:36` `fetch('/api/dashboard/policy')` → `fetch('/api/policy')`
    - `:85` `/dashboard/policy` 링크가 포함된 "Open Policy Editor" 버튼/링크 **전체 삭제** (Dashboard 삭제로 경로 무효화)
  - **검증**:
    1. `pnpm --filter web dev` → http://localhost:3000/playground/config 접속
    2. 정책 데이터 정상 로드 (fetch 성공)
    3. `/dashboard/policy` 링크가 페이지에 존재하지 않음 (DevTools Ctrl+F로 "dashboard" 검색 → 0건)

- [ ] Dashboard 페이지/컴포넌트 삭제
  - `rm -rf apps/web/app/dashboard/`
  - **검증**: `pnpm --filter web build` 에러 없음

- [ ] Dashboard API 라우트 삭제 (이전 완료된 것 제외)
  - `rm -rf apps/web/app/api/dashboard/` (policy, utils 이미 이전됨)
  - **검증**: `pnpm --filter web build` 에러 없음

- [ ] Dashboard 참조 정리 (7개 파일)
  - `(marketing)/components/site-header.tsx`: "Dashboard" 링크 제거
  - `(marketing)/page.tsx`: Dashboard CTA 버튼 제거
  - `(marketing)/components/demo-preview.tsx:32`: `/dashboard` 링크 → `/playground` 변경
  - `(marketing)/components/quickstart-preview.tsx:26,33`: "대시보드 실행" → 적절한 텍스트로 변경, `npx sapper-ai dashboard` → `npx sapper-ai scan` 등으로 수정
  - `(marketing)/quickstart/config.ts:39`: SDK highlights의 "대시보드" 항목 수정 또는 삭제
  - `(marketing)/quickstart/config.ts:103-109`: SDK step 4 "대시보드 실행" 수정 또는 삭제
  - `playground/layout.tsx`: Dashboard 관련 링크 제거
  - **검증**: `grep -r "dashboard" apps/web/app/ --include="*.tsx" --include="*.ts" -l` → 결과 0건 (api/shared 제외)

### Phase 3: Component Dark Mode Migration

> **의존성**: Phase 1 완료 필수 (CSS 변수 + Tailwind 설정)
> **핵심**: CSS 변수 기반이므로 `dark:` 프리픽스 대부분 불필요.
> `bg-surface`, `text-ink` 등은 자동 전환됨.
> `dark:` 프리픽스는 olive gradient 등 테마별 고유 스타일에만 사용.

- [ ] `bg-white` → `bg-surface` 일괄 교체
  - 대상: `apps/web/app/` 내 모든 `.tsx` 파일
  - 제외: 코드 블록 내 `bg-[#0a0a0a]` (유지)
  - **검증**: `grep -r "bg-white" apps/web/app/ --include="*.tsx" -l` → 결과 0건

- [ ] SiteHeader 업데이트
  - ThemeToggle 컴포넌트 추가 (GitHub 버튼 옆)
  - 로고: `dark:bg-olive-400 dark:text-ink` 추가 (다크 배경에서 구분)
  - `bg-frost/80` → 유지 (CSS 변수로 자동 전환)
  - **파일**: `apps/web/app/(marketing)/components/site-header.tsx`
  - **검증**: SiteHeader 다크 모드 체크리스트
    1. `pnpm --filter web dev` → http://localhost:3000 접속
    2. DevTools → Elements → `<html>` 에 `class="dark"` 수동 추가
    3. 다음 항목 확인:
       - [ ] 헤더 배경이 투명+blur (`background-color` Computed에서 `rgba(10, 10, 10, 0.8)`)
       - [ ] 로고 배경이 olive-400 (`background-color: #8fa85c` 또는 `rgb(143, 168, 92)`)
       - [ ] 네비 링크 텍스트가 steel 색상으로 읽기 가능 (`color: rgb(156, 163, 175)`)
       - [ ] GitHub 버튼 border가 보임 (border-border → `rgb(45, 58, 46)`)
    4. ThemeToggle 클릭 → 라이트 모드 전환 → 위 항목이 라이트 값으로 역전됨
    5. 브라우저 새로고침 → 선택한 테마 유지 (localStorage 확인)

- [ ] Footer 업데이트
  - 기존 색상이 CSS 변수 기반이면 자동 전환
  - 추가 필요 시: `dark:` 접두사 스타일
  - **파일**: `apps/web/app/components/footer.tsx`
  - **검증**: Footer 다크 모드 체크리스트
    1. DevTools에서 `<html class="dark">` 적용
    2. 다음 항목 확인:
       - [ ] 푸터 배경이 `bg-frost` → `rgb(10, 10, 10)` 전환됨
       - [ ] 상단 border가 보임 (border-border)
       - [ ] 링크 텍스트가 읽기 가능 (steel 또는 ink 색상)

- [ ] 공유 컴포넌트 다크 모드
  - `risk-bar.tsx`: mint/ember/warn 색상은 CSS 변수로 자동 전환
  - `status-badge.tsx`: 배경/텍스트 CSS 변수 전환 확인
  - `circular-gauge.tsx`: SVG stroke/fill 색상 CSS 변수 연동
  - **검증**: 공유 컴포넌트 다크 모드 체크리스트
    1. http://localhost:3000/playground/runtime 접속
    2. DevTools에서 `<html class="dark">` 적용
    3. 검출 결과 하나 실행 후 다음 확인:
       - [ ] RiskBar: mint(허용)/ember(차단) 색상이 다크 배경에서 선명히 보임
       - [ ] StatusBadge: 배경/텍스트 대비가 읽기 가능
       - [ ] CircularGauge: SVG stroke 색상이 다크 배경에서 구분됨
    4. `<html class="dark">` 제거 → 라이트 모드에서 기존과 동일한지 확인

### Phase 4: Page-Level Dark Mode

> **의존성**: Phase 3 완료 필수

- [ ] 홈페이지 다크 모드 (`(marketing)/page.tsx`)
  - Hero 배경 blur: `dark:` 접두사로 olive 계열 변경
    - `bg-signal/10` → 추가: `dark:bg-olive-500/10`
    - `bg-mint/10` → 추가: `dark:bg-olive-400/10`
  - 카드: `bg-surface` 이미 자동 전환
  - 통계 배지: glass card 스타일 적용
  - 코드 블록: 기존 `bg-[#0a0a0a]` 유지 (변경 불필요)
  - **검증**: 홈페이지 다크 모드 체크리스트
    1. http://localhost:3000 접속 → DevTools에서 `<html class="dark">` 적용
    2. Hero 섹션:
       - [ ] Hero 카드 배경이 `bg-surface` → `rgb(26, 26, 26)` 전환됨
       - [ ] 배경 blur 효과가 olive 계열 색상으로 전환됨 (우상단/좌하단)
       - [ ] 제목 "SapperAI" 텍스트가 signal 색상 → olive-400 (`rgb(143, 168, 92)`)
       - [ ] 통계 배지 배경/border가 다크 테마에 맞게 전환됨
    3. 하단 카드 섹션:
       - [ ] 3개 article 카드 배경이 `bg-surface` → `rgb(26, 26, 26)`
       - [ ] 카드 내 제목(ink)/본문(steel) 텍스트가 읽기 가능
    4. `<html class="dark">` 제거 → 라이트 모드에서 기존 디자인과 동일한지 확인

- [ ] Quickstart 페이지 다크 모드
  - 카드: `bg-surface` 자동 전환
  - 코드 블록: 유지
  - **검증**: Quickstart 다크 모드 체크리스트
    1. http://localhost:3000/quickstart/sdk 접속 → `<html class="dark">` 적용
    2. 다음 항목 확인:
       - [ ] 페이지 배경이 `bg-frost` → `rgb(10, 10, 10)` 전환됨
       - [ ] 스텝 카드 배경이 `bg-surface` → `rgb(26, 26, 26)` 전환됨
       - [ ] 코드 블록 `bg-[#0a0a0a]` 은 변경 없음 (항상 다크)
       - [ ] 텍스트(ink/steel) 가독성 확보됨
    3. `/quickstart/mcp`, `/quickstart/agents` 동일 확인

- [ ] Playground 레이아웃/페이지 다크 모드
  - `playground/layout.tsx`: 탭 네비 색상 자동 전환 확인
  - 각 서브 페이지: `bg-white` → `bg-surface` 이미 Phase 3에서 교체됨
  - **검증**: Playground 다크 모드 체크리스트
    1. http://localhost:3000/playground 접속 → `<html class="dark">` 적용
    2. 레이아웃:
       - [ ] 탭 네비 배경/텍스트가 다크 테마에 맞게 전환됨
       - [ ] 활성 탭 표시가 구분 가능
    3. 서브페이지 순회 (runtime, skill-scan, agent, adversary, config):
       - [ ] 각 페이지 배경이 `bg-surface` → `rgb(26, 26, 26)` 전환됨
       - [ ] 입력 폼/버튼의 border가 다크 테마에서 보임
    4. `<html class="dark">` 제거 → 라이트 모드에서 기존과 동일 확인

### Phase 5: Layout Enhancement

> **의존성**: Phase 4 완료 권장 (다크 모드 스타일이 적용된 상태에서 레이아웃 변경)

- [ ] 홈페이지 레이아웃 리디자인
  - Hero 섹션: 그라디언트 배경 + 통계 배지 Glass Card 개선
  - Bento Feature Grid 적용:
    - `grid grid-cols-3 grid-rows-2 gap-4` (데스크톱)
    - `grid-cols-1` (모바일)
    - Hero card: `col-span-2 row-span-2` → 모바일: `col-span-1`
  - How It Works: Glass card 3-step 플로우
  - Quickstart Preview 개선
  - **파일**: `apps/web/app/(marketing)/page.tsx`
  - **파일**: `apps/web/app/(marketing)/components/` (필요 시 신규 컴포넌트)
  - **검증**: 레이아웃 리디자인 체크리스트
    1. **데스크톱 (1280px)**:
       - [ ] Bento Grid가 `grid-cols-3 grid-rows-2` 레이아웃으로 렌더링
       - [ ] Hero card가 `col-span-2 row-span-2` 차지
       - [ ] 4개 standard card가 나머지 공간에 배치
       - [ ] Glass card에 backdrop-blur 효과 적용됨
    2. **태블릿 (768px)**: DevTools → device toolbar로 확인
       - [ ] 그리드가 적절히 축소 (2 column 또는 stacked)
       - [ ] 카드 내 텍스트 잘림 없음
    3. **모바일 (375px)**:
       - [ ] Bento Grid가 `grid-cols-1`로 순차 스택됨
       - [ ] Hero card가 `col-span-1`로 전환됨
       - [ ] How It Works glass card가 세로 스택
       - [ ] ThemeToggle 터치 타겟이 44px 이상 (DevTools에서 크기 확인)
    4. **다크 모드**: 위 3개 뷰포트에서 `<html class="dark">` 적용 → olive 톤 + glass 효과 정상

### Phase 6: QA & Polish

> **의존성**: Phase 5 완료 필수

- [ ] WCAG 접근성 점검
  1. https://webaim.org/resources/contrastchecker/ 접속
  2. 다음 대비율 조합 검증 (AA 기준: 일반 텍스트 4.5:1, 대형 텍스트 3:1):
     - [ ] `#8fa85c` (olive-400, signal dark) on `#1a1a1a` (surface dark) → 예상: ~5.5:1 ✅
     - [ ] `#e5e7eb` (ink dark) on `#0a0a0a` (frost dark) → 예상: ~15.8:1 ✅
     - [ ] `#9ca3af` (steel dark) on `#1a1a1a` (surface dark) → 예상: ~5.2:1 ✅
     - [ ] `#9ca3af` (steel dark) on `#0a0a0a` (frost dark) → 예상: ~5.9:1 ✅
     - [ ] `#4ade80` (mint dark) on `#1a1a1a` → 예상: ~8.5:1 ✅
     - [ ] `#f87171` (ember dark) on `#1a1a1a` → 예상: ~4.6:1 ✅
  3. Glass morphism 카드: `bg-surface/60` 위 텍스트 → 배경 blur로 실질 대비율 저하 가능
     - [ ] DevTools에서 glass card 요소의 Computed color 확인 → 4.5:1 이상

- [ ] 라이트/다크 모드 전체 페이지 시각 점검
  - 페이지 목록: `/` (홈), `/quickstart/sdk`, `/quickstart/mcp`, `/playground`, `/playground/runtime`, `/playground/config`
  - 각 페이지에서:
    - [ ] ThemeToggle로 라이트 → 다크 전환 시 FOUC(깜빡임) 없음
    - [ ] 다크 → 라이트 전환 시 FOUC 없음
    - [ ] 시스템 설정 변경 시 자동 전환 (macOS: System Preferences → Appearance 전환)
    - [ ] 새로고침 후 선택한 테마 유지 (localStorage `theme` 키 확인)

- [ ] 반응형 확인
  - DevTools → device toolbar에서 3개 뷰포트 순회:
    - [ ] 모바일 (375px): 레이아웃 깨짐 없음, 텍스트 잘림 없음, 스크롤 정상
    - [ ] 태블릿 (768px): 그리드 적절히 축소, 카드 가독성
    - [ ] 데스크톱 (1280px): Bento Grid 정상 렌더링
  - [ ] ThemeToggle 모바일 터치 타겟 44px 이상 (DevTools에서 요소 크기 확인)

- [ ] API 엔드포인트 smoke test
  - `curl http://localhost:3000/api/policy` → 200 OK
  - `curl http://localhost:3000/api/dashboard/policy` → 404 Not Found (삭제 확인)
  - `curl -X POST http://localhost:3000/api/detect -H "Content-Type: application/json" -d '{"toolName":"shell","arguments":{"cmd":"ls"}}'` → 정상 응답

- [ ] 빌드/배포 검증
  - `pnpm build` 전체 성공
  - `pnpm --filter web build` standalone 빌드 성공
  - Vercel Preview 배포 확인
  - Chrome DevTools → Lighthouse 실행:
    - [ ] Performance: 90+
    - [ ] Accessibility: 90+
    - [ ] Best Practices: 90+

---

## 7. Dependencies

| 패키지 | 용도 | 설치 방법 |
|--------|------|----------|
| `next-themes` | 다크 모드 토글 (FOUC 방지) | `pnpm --filter web add next-themes` |

**설치하지 않는 것**:
- `lucide-react`: 인라인 SVG로 대체 (의존성 최소화)

---

## 8. Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| 다크 모드 FOUC | UX 저하 | next-themes의 inline script injection 활용 |
| CSS 변수 RGB 채널 방식의 직관성 저하 | DX | globals.css에 hex 주석 병기 (예: `/* #fafafa */`) |
| 국방색 대비율 부족 | 접근성 위반 | olive-400 사용 (5.5:1), Phase 6에서 WebAIM 검증 |
| Dashboard 삭제 후 깨진 참조 | 빌드 실패 | Phase 2 마지막에 `grep -r "dashboard"` 전수 검사 |
| Playground config API 깨짐 | 런타임 에러 | Policy API를 `/api/policy`로 이전 후 삭제 |
| Glass morphism 모바일 성능 | 렌더링 지연 | blur 강도 제한 (12-16px), `will-change: auto` |
| `bg-white` 일괄 교체 시 누락 | 불완전 다크 모드 | Phase 3에서 grep 검증 후 진행 |

---

## 9. References

### 업계 사이트
- [Snyk](https://snyk.io/) - 듀얼 에셋 다크/라이트, 통계 강조
- [CrowdStrike](https://www.crowdstrike.com/) - 레드/블루 그라디언트, F-패턴
- [SentinelOne](https://www.sentinelone.com/) - 다크모드 우선, 85px 헤드라인
- [Darktrace](https://www.darktrace.com/) - 블랙 + 오렌지 액센트
- [Wiz](https://www.wiz.io/) - 클라우드 이미지, 신뢰 신호
- [Orca Security](https://orca.security/) - 네이비 + 블루 액센트

### 기술 참고
- [next-themes](https://github.com/pacocoursey/next-themes) - Next.js 다크 모드
- [Tailwind CSS Dark Mode](https://tailwindcss.com/docs/dark-mode)
- [Tailwind CSS Colors with opacity](https://tailwindcss.com/docs/customizing-colors#using-css-variables)
- [Bento Grid Design Guide 2026](https://www.saasframe.io/blog/designing-bento-grids-that-actually-work-a-2026-practical-guide)
- [Glassmorphism 2026](https://invernessdesignstudio.com/glassmorphism-what-it-is-and-how-to-use-it-in-2026)
- [WCAG Contrast Checker](https://webaim.org/resources/contrastchecker/)
