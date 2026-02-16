# SapperAI Web Redesign Plan v1

> **Status**: Draft (Planner 초안 - Architect/Critic 리뷰 대기)
> **Date**: 2026-02-16
> **Scope**: Design system overhaul, Dashboard removal, Layout restructure

---

## 1. Overview

SapperAI 마케팅 웹사이트의 디자인 시스템을 전면 개편한다.

### Goals
1. **다크/라이트 모드 지원** - 시스템 설정(prefers-color-scheme) 기반 자동 전환 + 수동 토글
2. **다크 모드 Primary Color: 국방색(Olive Drab)** - `#4B5320` 계열
3. **Dashboard 섹션 완전 삭제**
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
- **Shadow**: subtle, lifted
- **Glass**: SiteHeader backdrop-blur만 제한적 사용
- **Typography**: system-ui + Apple SD Gothic Neo + Noto Sans KR

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
signal:    #5e7a3a   → 강조 (PRIMARY: 국방색/Olive Drab)
mint:      #4ade80   → 성공 (밝기 보정)
ember:     #f87171   → 위험 (밝기 보정)
warn:      #fbbf24   → 경고 (밝기 보정)
```

#### 국방색 (Olive Drab) 팔레트
```
olive-50:   #f5f7f0    (라이트 모드 배지/뱃지 배경)
olive-100:  #e8eddb
olive-200:  #d1dbb8
olive-300:  #b3c48a
olive-400:  #8fa85c
olive-500:  #6b8e3a    (기본값)
olive-600:  #5e7a3a    (다크 모드 primary)
olive-700:  #4B5320    (진한 국방색 - 브랜드 앵커)
olive-800:  #3d4420
olive-900:  #343a1e
olive-950:  #1a1f0e
```

### 3.2 CSS Variables Architecture

```css
/* globals.css */
:root {
  /* Semantic tokens - Light mode defaults */
  --color-bg: #fafafa;
  --color-surface: #ffffff;
  --color-text: #0a0a0a;
  --color-text-secondary: #4b5563;
  --color-border: #e5e7eb;
  --color-muted: #f3f4f6;
  --color-primary: #3b82f6;
  --color-success: #22c55e;
  --color-danger: #ef4444;
  --color-warning: #f59e0b;

  /* Glass morphism */
  --glass-bg: rgba(255, 255, 255, 0.7);
  --glass-border: rgba(255, 255, 255, 0.3);
  --glass-blur: 12px;
}

.dark {
  --color-bg: #0a0a0a;
  --color-surface: #1a1a1a;
  --color-text: #e5e7eb;
  --color-text-secondary: #9ca3af;
  --color-border: #2d3a2e;
  --color-muted: #1f2a1f;
  --color-primary: #6b8e3a;
  --color-success: #4ade80;
  --color-danger: #f87171;
  --color-warning: #fbbf24;

  /* Glass morphism - dark */
  --glass-bg: rgba(27, 27, 27, 0.8);
  --glass-border: rgba(107, 142, 58, 0.2);
  --glass-blur: 16px;
}
```

### 3.3 Tailwind Config Changes

```typescript
// tailwind.config.ts
export default {
  darkMode: 'class',  // next-themes와 호환
  theme: {
    extend: {
      colors: {
        // 기존 색상 유지 + CSS 변수 참조
        olive: {
          50: '#f5f7f0',
          100: '#e8eddb',
          // ... 전체 팔레트
          700: '#4B5320',
          950: '#1a1f0e',
        },
        // Semantic aliases via CSS variables
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        // ...
      },
    },
  },
}
```

### 3.4 Dark Mode Implementation (next-themes)

```bash
pnpm --filter web add next-themes
```

**ThemeProvider 설정**:
- `attribute="class"` (Tailwind darkMode: 'class' 호환)
- `defaultTheme="system"` (시스템 설정 우선)
- `enableSystem={true}`
- `suppressHydrationWarning` on `<html>`

**ThemeToggle 컴포넌트**:
- 3-state: System / Light / Dark
- `useTheme()` hook + mounted guard
- SiteHeader에 배치

---

## 4. Dashboard Removal

### 4.1 삭제 대상 파일/디렉토리

#### Pages & Components
- `apps/web/app/dashboard/` (전체 디렉토리)
  - `page.tsx` (Overview)
  - `layout.tsx`
  - `audit/` (페이지 + 컴포넌트)
  - `campaign/` (페이지 + 컴포넌트)
  - `policy/` (페이지 + 컴포넌트)
  - `threat-intel/` (페이지 + 컴포넌트)
  - `components/` (dashboard-nav, metric-card, timeline-chart, threat-list)

#### API Routes
- `apps/web/app/api/dashboard/` (전체 디렉토리)
  - `metrics/`
  - `audit-logs/`
  - `policy/`
  - `threat-intel/`

#### Navigation References
- `site-header.tsx` → "Dashboard" 링크 제거
- `(marketing)/page.tsx` → Dashboard CTA 버튼 제거
- `playground/layout.tsx` → Dashboard 링크 제거

### 4.2 보존 대상
- `apps/web/app/api/adversary-campaign/` (Playground에서 사용)
- `apps/web/app/components/` 공유 컴포넌트 (다른 페이지에서 사용 중인 것만)
  - `risk-bar.tsx`, `status-badge.tsx`, `circular-gauge.tsx` → Playground에서 사용
  - `metric-card.tsx` → Dashboard 전용이므로 삭제 가능
  - `timeline-chart.tsx` → Dashboard 전용이므로 삭제 가능
  - `threat-list.tsx` → Dashboard 전용이므로 삭제 가능

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
│  [1] STICKY HEADER                                    │
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
│  [3] BENTO FEATURE GRID                              │
│  ┌──────────────────┬──────────┐                     │
│  │  2×2 HERO CARD   │ 1×1 CARD │                     │
│  │  Interactive Demo │ "60+ 룰" │                     │
│  │  (코드 프리뷰)    │          │                     │
│  ├────────┬─────────┼──────────┤                     │
│  │ 1×1    │ 1×1     │ 1×1      │                     │
│  │ MCP    │ OpenAI  │ Direct   │                     │
│  │ Proxy  │ Agents  │ SDK      │                     │
│  └────────┴─────────┴──────────┘                     │
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
- Glass morphism: `bg-surface/80 backdrop-blur-xl`
- Dark mode: `dark:bg-surface/80 dark:border-olive-700/30`
- 네비: Playground | Quickstart | GitHub
- 오른쪽: Theme Toggle (Sun/Moon/Monitor 아이콘) + "Get Started" CTA
- Dashboard 링크 제거

#### [2] Hero Section
- 배경: 다크 모드에서 olive 그라디언트 (`from-olive-950 via-olive-900 to-bg`)
- 라이트 모드: 기존 signal/mint blur 효과 유지
- 통계 배지: Glass card 스타일
- CTA: Primary(filled olive/signal) + Secondary(outlined)

#### [3] Bento Feature Grid
- CSS Grid 기반 (2026 트렌드)
- 2×2 Hero Card: Interactive Demo 프리뷰
- 1×1 Cards: 탐지 범위, 통합 방식별 (MCP/OpenAI/SDK)
- 다크 모드: `dark:bg-surface dark:border-olive-700/20`
- 호버 효과: 미묘한 스케일 + 그림자 변화

#### [4] How It Works
- 3-step glass card flow
- Glass morphism 강화: `backdrop-blur-xl`
- 다크 모드에서 olive 틴트 글래스

#### [5] Quickstart
- 다크 코드 블록 (기존 유지)
- 3-step numbered list

#### [6] Footer
- 다크 모드: `dark:bg-olive-950`
- 링크: GitHub, npm, Documentation

### 5.4 Routing Changes

**Before:**
```
/ → Home
/quickstart → Quickstart
/quickstart/[target] → SDK/MCP/Agents guide
/dashboard → Dashboard Overview (삭제)
/dashboard/audit → Audit Log (삭제)
/dashboard/policy → Policy Editor (삭제)
/dashboard/threat-intel → Threat Intel (삭제)
/dashboard/campaign → Campaign (삭제)
/playground → Playground
/playground/runtime → Runtime Demo
/playground/skill-scan → Skill Scan
/playground/agent → Agent Demo
/playground/adversary → Adversary Demo
/playground/config → Config Demo
```

**After:**
```
/ → Home (redesigned)
/quickstart → Quickstart
/quickstart/[target] → SDK/MCP/Agents guide
/playground → Playground
/playground/runtime → Runtime Demo
/playground/skill-scan → Skill Scan
/playground/agent → Agent Demo
/playground/adversary → Adversary Demo
/playground/config → Config Demo
```

---

## 6. Implementation TODO List

### Phase 1: Design System Foundation
- [ ] `tailwind.config.ts` 수정
  - `darkMode: 'class'` 추가
  - `olive` 색상 팔레트 추가
  - CSS 변수 기반 semantic color aliases 추가
  - **파일**: `apps/web/tailwind.config.ts`
  - **검증**: `pnpm --filter web build` 성공

- [ ] `globals.css` 수정
  - `:root` 및 `.dark` CSS 변수 블록 추가
  - Glass morphism 변수 추가
  - `body` transition 추가 (`background 0.3s, color 0.3s`)
  - **파일**: `apps/web/app/globals.css`
  - **검증**: CSS 변수가 정상 적용되는지 브라우저 DevTools 확인

- [ ] `next-themes` 설치 및 ThemeProvider 설정
  - `pnpm --filter web add next-themes`
  - `apps/web/app/providers.tsx` 생성 (ThemeProvider 래퍼)
  - `apps/web/app/layout.tsx` 수정: `<html suppressHydrationWarning>` + ThemeProvider 래핑
  - **검증**: 시스템 다크 모드 전환 시 `<html class="dark">` 자동 적용

- [ ] ThemeToggle 컴포넌트 생성
  - `apps/web/app/components/theme-toggle.tsx`
  - 3-state: System / Light / Dark (드롭다운 또는 순환 버튼)
  - `useTheme()` + mounted guard (hydration mismatch 방지)
  - Sun / Moon / Monitor 아이콘 (lucide-react 또는 인라인 SVG)
  - **검증**: 토글 클릭 시 테마 전환, localStorage 영속성

### Phase 2: Dashboard Removal
- [ ] Dashboard 페이지/컴포넌트 삭제
  - `rm -rf apps/web/app/dashboard/`
  - **검증**: 빌드 에러 없음

- [ ] Dashboard API 라우트 삭제
  - `rm -rf apps/web/app/api/dashboard/`
  - **검증**: 빌드 에러 없음

- [ ] Dashboard 참조 정리
  - `apps/web/app/(marketing)/components/site-header.tsx`: "Dashboard" 링크 제거
  - `apps/web/app/(marketing)/page.tsx`: Dashboard CTA 제거
  - `apps/web/app/playground/layout.tsx`: Dashboard 관련 링크 제거
  - **검증**: `pnpm --filter web build` 성공, 모든 링크 정상

- [ ] Dashboard 전용 공유 컴포넌트 정리 (사용처 확인 후)
  - `dashboard-nav.tsx` → 삭제
  - `metric-card.tsx` → Playground에서 미사용 시 삭제
  - `timeline-chart.tsx` → Playground에서 미사용 시 삭제
  - `threat-list.tsx` → Playground에서 미사용 시 삭제
  - **검증**: grep으로 import 참조 0건 확인

### Phase 3: Component Dark Mode Migration
- [ ] SiteHeader 다크 모드 적용
  - `dark:bg-surface/80 dark:border-olive-700/30 dark:text-ink`
  - ThemeToggle 컴포넌트 추가
  - **파일**: `apps/web/app/(marketing)/components/site-header.tsx`

- [ ] Footer 다크 모드 적용
  - `dark:bg-olive-950 dark:text-steel dark:border-olive-800/30`
  - **파일**: `apps/web/app/components/footer.tsx`

- [ ] 공유 컴포넌트 다크 모드
  - `risk-bar.tsx`: `dark:` 변형 추가
  - `status-badge.tsx`: 배경/텍스트 색상 dark 변형
  - `circular-gauge.tsx`: SVG 색상 dark 변형
  - **검증**: Playground 페이지에서 다크 모드 시각 확인

### Phase 4: Page-Level Dark Mode
- [ ] 홈페이지 다크 모드 (`(marketing)/page.tsx`)
  - Hero 배경: `dark:from-olive-950 dark:via-olive-900`
  - 카드: `dark:bg-surface dark:border-olive-700/20`
  - 통계 배지: glass card 스타일
  - 코드 블록: 기존 다크 유지 (변경 불필요)

- [ ] Quickstart 페이지 다크 모드
  - 카드/코드 블록 다크 변형

- [ ] Playground 레이아웃/페이지 다크 모드
  - `playground/layout.tsx`: 네비 탭 다크 변형
  - 각 서브 페이지: 카드, 폼, 결과 표시 다크 변형

### Phase 5: Layout Enhancement
- [ ] 홈페이지 레이아웃 리디자인
  - Hero 섹션: 그라디언트 배경 + 통계 배지 개선
  - Bento Feature Grid 적용 (기존 3-column → CSS Grid 벤토)
  - How It Works: Glass card 플로우
  - Quickstart Preview 개선
  - **파일**: `apps/web/app/(marketing)/page.tsx`
  - **파일**: `apps/web/app/(marketing)/components/` (필요 시 신규 컴포넌트)

- [ ] SiteHeader 네비 업데이트
  - Dashboard 링크 제거
  - Theme Toggle 추가
  - **파일**: `apps/web/app/(marketing)/components/site-header.tsx`

### Phase 6: QA & Polish
- [ ] 라이트/다크 모드 전체 페이지 시각 점검
  - 대비율 WCAG 4.5:1 확인
  - 전환 애니메이션 smooth
  - Flash of unstyled content (FOUC) 없음

- [ ] 반응형 확인
  - 모바일/태블릿/데스크톱 breakpoint
  - 벤토 그리드 모바일 스택

- [ ] 빌드/배포 검증
  - `pnpm build` 전체 성공
  - Vercel Preview 배포 확인
  - Lighthouse 성능 점수 유지

---

## 7. Dependencies

- `next-themes` (신규 설치)
- 기존 Tailwind CSS 3.4.17 유지
- lucide-react 또는 인라인 SVG (아이콘)

---

## 8. Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| 다크 모드 FOUC | UX 저하 | next-themes의 script injection 활용 |
| 국방색 대비율 부족 | 접근성 위반 | olive-500/600 사용, WCAG checker로 검증 |
| Dashboard 삭제 후 깨진 참조 | 빌드 실패 | grep으로 모든 import 참조 사전 확인 |
| Glass morphism 모바일 성능 | 렌더링 지연 | blur 강도 제한, will-change 힌트 |

---

## 9. References

### 업계 사이트
- [Snyk](https://snyk.io/) - 듀얼 에셋 다크/라이트
- [CrowdStrike](https://www.crowdstrike.com/) - 레드/블루 그라디언트, F-패턴
- [SentinelOne](https://www.sentinelone.com/) - 다크모드 우선, 85px 헤드라인
- [Darktrace](https://www.darktrace.com/) - 블랙 + 오렌지 액센트
- [Wiz](https://www.wiz.io/) - 클라우드 이미지, 신뢰 신호
- [Orca Security](https://orca.security/) - 네이비 + 블루 액센트

### 기술 참고
- [next-themes](https://github.com/pacocoursey/next-themes) - Next.js 다크 모드
- [Tailwind CSS Dark Mode](https://tailwindcss.com/docs/dark-mode)
- [Bento Grid Design Guide 2026](https://www.saasframe.io/blog/designing-bento-grids-that-actually-work-a-2026-practical-guide)
- [Glassmorphism 2026](https://invernessdesignstudio.com/glassmorphism-what-it-is-and-how-to-use-it-in-2026)
