# SapperAI 해커톤 발표 영상 슬라이드 계획

> **작성일**: 2026-02-17
> **이벤트**: 조코딩 x OpenAI x Primer AI 해커톤
> **마감**: 2026-02-20 (금) 23:59
> **산출물**: 제품 URL + 서비스 소개/시연 영상 (유튜브 업로드)
> **팀**: 김규동 (1인)

---

## 심사 기준 (총 30점)

| 구분 | 항목 | 배점 | 어필 전략 |
|------|------|------|-----------|
| 기획 | 시장성/사업성 | **10** | 슬라이드 5(고객), 6(경쟁사+BM), 8(비전) |
| 기획 | 차별성/독창성 | 5 | 슬라이드 2(문제), 6(포지셔닝 맵 — Tool Layer 빈 공간) |
| 개발 | 개발 완성도 | 5 | 데모 전체 (실제 작동), 슬라이드 3(메트릭) |
| 개발 | AI 활용도 | 5 | 슬라이드 3-4(GPT-4.1-mini LlmDetector), 데모 2(scan with LLM) |
| 디자인 | UI/UX | 3 | 데모 1(랜딩페이지), 데모 3(HTML 리포트) |
| 디자인 | 심미성 | 2 | 슬라이드 전체 디자인 (다크+올리브 톤, 터미널 미학) |

**필수 요건**: OpenAI API 최소 1개 이상 활용 → LlmDetector (GPT-4.1-mini via Responses API) 확인 완료

---

## 영상 구조 (총 약 5분)

```
[슬라이드 1-4] ──전환──> [데모 1-4] ──전환──> [슬라이드 5-9]
  0:00~1:20        "직접 보여드리겠습니다"      "시장과 비즈니스
  타이틀               1:20~3:00              모델을 말씀드리겠습니다"
  문제 제기                                     3:00~5:00
  솔루션 소개
  아키텍처
```

---

## 슬라이드 상세 설계

### 슬라이드 1: 타이틀 (0:00 ~ 0:10, 10초)

**내용**:
- SapperAI 로고
- 태그라인: "AI 에이전트의 도구 호출을 실시간으로 보호합니다"
- 발표자: 김규동 (Solo)
- 이벤트 배지: 조코딩 x OpenAI x Primer AI 해커톤

**시각**: 다크 배경 + 올리브/그린 악센트, 모노스페이스 폰트

**스크립트**: "안녕하세요. AI 에이전트 보안 가드레일 SapperAI를 만든 김규동입니다."

---

### 슬라이드 2: 문제 제기 (0:10 ~ 0:40, 30초)

**내용**:
- 문제 상황 3가지:
  1. AI 에이전트가 `rm -rf /` 를 실행하려 한다면?
  2. MCP 스킬이 API 키를 외부로 전송하려 한다면?
  3. 프롬프트 인젝션으로 시스템 프롬프트를 탈취하려 한다면?
- 실제 사건: **ClawHavoc** — 341개 악성 스킬, 9,000+ 설치 피해 (2026년 2월, CNBC 보도)

**시각**: 좌측 터미널 빨간 경고, 우측 텍스트 3줄, 하단 ClawHavoc 뉴스 인용

**스크립트**: "2026년 2월, OpenClaw에서 341개의 악성 스킬이 발견되어 9,000건 이상 설치되는 사건이 있었습니다. AI 에이전트가 도구를 자유롭게 호출하는 시대, 도구 호출 자체를 보호하는 레이어가 필요합니다."

---

### 슬라이드 3: 솔루션 + 핵심 메트릭 (0:40 ~ 1:05, 25초)

**내용**:
- SapperAI = Tool Layer 전담 보안 가드레일
- 3대 숫자 (크게 가로 배치):
  - **96%** 탐지율 (50개 악성 샘플)
  - **0%** 오탐률 (120개 정상 샘플)
  - **p99 0.002ms** 레이턴시
- 부가: 60+ 탐지 룰, 737K ops/sec, MIT 라이선스 무료
- **OpenAI GPT-4.1-mini 기반 2차 분석** ← AI 활용도 어필

**시각**: 카드 3개 가로 배치 (방패/체크/번개 아이콘)

**스크립트**: "SapperAI는 도구 호출 레이어를 전담으로 보호합니다. 50개 악성 샘플에서 96% 탐지율, 120개 정상 샘플에서 오탐 제로, 레이턴시는 0.002밀리초입니다. 그리고 고위험 호출은 OpenAI GPT-4.1-mini로 2차 분석합니다."

---

### 슬라이드 4: 아키텍처 파이프라인 (1:05 ~ 1:20, 15초)

**내용**:
```
ToolCall → ThreatIntelDetector → RulesDetector (60+ 패턴, 737K ops/sec)
  → LlmDetector (GPT-4.1-mini, 고위험 시 활성화) → DecisionEngine → Allow/Block
```
- OpenAI Responses API 연동 강조

**시각**: 가로 흐름 다이어그램, 각 단계 박스 + 화살표, Allow(초록)/Block(빨강) 분기

**스크립트**: "도구 호출이 들어오면 위협 인텔리전스 확인, 60개 이상의 룰로 패턴 매칭, 고위험이면 OpenAI GPT-4.1-mini로 2차 분석까지 수행합니다."

---

### 전환: "직접 보여드리겠습니다." (1:20)

---

### 데모 1: 랜딩페이지 접속 (1:20 ~ 1:40, 20초)

**화면**: 브라우저 `https://sapper-ai.com`
- 메인 히어로 영역
- Quick Start 섹션 스크롤

**스크립트**: "sapper-ai.com에 접속하면 바로 설치 방법을 확인할 수 있습니다."

---

### 데모 2: 설치 + 스캔 (1:40 ~ 2:20, 40초)

**화면**: 터미널
```bash
pnpm install sapper-ai
npx sapper-ai scan
```
- 스캔 결과: 222개 파일, Critical 4건

**스크립트**: "한 줄로 설치하고, scan 명령어 하나로 현재 환경의 MCP 서버, 스킬, 에이전트 파일을 전부 검사합니다. 제 실제 개발 환경에서 222개 파일을 스캔한 결과 Critical 4건이 발견되었습니다."

---

### 데모 3: HTML 리포트 (2:20 ~ 2:40, 20초)

**화면**: 브라우저에서 HTML 리포트 열기
- 파일: `docs/reports/2026-02-10-real-env-mcp-scan.html`
- 심각도별 분류 + Critical 항목 상세 클릭

**스크립트**: "스캔 결과는 HTML 리포트로 자동 생성됩니다. 심각도별로 분류되어 있고, 각 항목에서 어떤 패턴이 탐지되었는지 확인할 수 있습니다."

---

### 데모 4: OpenClaw 보호 적용 (2:40 ~ 3:00, 20초)

**화면**: 터미널
```bash
npx sapper-ai harden --apply
```
- MCP config Before/After 비교

**스크립트**: "harden 명령어 하나로 기존 MCP 서버를 SapperAI 프록시로 감쌉니다. 코드 변경 없이, 모든 도구 호출이 자동으로 보안 검사를 거칩니다."

---

### 전환: "이제 SapperAI의 시장과 비즈니스 모델을 말씀드리겠습니다." (3:00)

---

### 슬라이드 5: 타겟 고객 (3:00 ~ 3:15, 15초)

**내용** (2컬럼):

| Claude Code 이용자 | OpenClaw 이용자 |
|---|---|
| MCP 서버/도구 사용 개발자 | ~196K GitHub Stars, 3,000+ 스킬 마켓 |
| `sapper-ai scan`으로 보안 스캔 | ClawHavoc: 341개 악성 스킬, 9,000+ 피해 |
| MCP Proxy 자동 래핑 | 스킬 스캐너 (정적+동적 분석) |

**스크립트**: "두 가지 큰 사용자 풀이 있습니다. Claude Code 사용자와 OpenClaw 사용자. 둘 다 AI 에이전트의 도구 호출 보안이라는 미해결 문제를 공유합니다."

---

### 슬라이드 6: 경쟁사 + BM (3:15 ~ 3:45, 30초) ★ 시장성/사업성 10점

**내용**:

포지셔닝 맵:
```
                Tool Layer Focus ▲
                     │ ★ SapperAI (p99 0.002ms, 무료)
          Lasso ●    │
    ─────────────────┼──────────────► Developer-First
         Lakera ●    │    ● Socket.dev
         Protect AI ●│
                Enterprise-First
```

비교표:
| | Lakera | Lasso | Socket.dev | **SapperAI** |
|---|---|---|---|---|
| 보호 대상 | 프롬프트 I/O | MCP 게이트웨이 | 공급망 | **Tool Layer** |
| 가격 | $8~21/user/mo | Enterprise | $25~50/dev/mo | **무료 코어** |
| 레이턴시 | <50ms | <50ms | -- | **p99 0.002ms** |

BM 피라미드: Free Core → Team $30-50/dev/mo → Enterprise $5K-20K/mo

**스크립트**: "기존 경쟁사들은 프롬프트 I/O나 게이트웨이에서 보호합니다. 도구 호출 레이어를 전담하는 건 SapperAI뿐입니다. 그리고 1,250배 빠릅니다. 코어는 영원히 무료이고, 트랙션이 생기면 클라우드 대시보드와 엔터프라이즈 기능으로 수익화합니다."

---

### 슬라이드 7: 고도화 현황 (3:45 ~ 4:10, 25초)

**내용** (2컬럼):

좌: **MCP Proxy**
```
AI Client <-> [SapperAI Proxy] <-> MCP Server
               Guard.preTool()
               Guard.postTool()
```
- 코드 변경 0줄, 모든 도구 호출 자동 인터셉트

우: **Adversary Campaign Runner**
- 5가지 내장 공격 (Prompt/Command/Data/Code/Path)
- 4가지 변형 자동 생성 = 20 테스트
- 탐지율 리포트 자동 출력

**스크립트**: "이미 동작하는 제품 위에 두 가지를 고도화하고 있습니다. MCP Proxy는 코드 변경 없이 모든 도구 호출을 인터셉트합니다. Adversary Campaign은 자동화된 공격 시뮬레이션으로 탐지율을 검증합니다."

---

### 슬라이드 8: 미래 비전 (4:10 ~ 4:30, 20초)

**내용**:

타임라인:
```
NOW                    NEAR FUTURE              FAR FUTURE
─●─────────────────────●───────────────────────●─────→
오픈소스 가드레일        클라우드 플랫폼           에이전트 세금
개발자가 설치/실행       팀이 중앙에서 관리        에이전트가 자동 결제
```

비전 다이어그램:
```
AI Agent → 도구 호출 → [SapperAI Guard] → 검증 완료, 비용: 0.001¢, 자동 결제 ✓
                         ↓
                    안전한 AI 에코시스템
```

핵심 메시지: **"에이전트 세금 — 안전한 AI 에코시스템의 인프라 비용. SapperAI는 그 톨게이트가 된다."**

**스크립트**: "마지막으로 먼 미래의 비전입니다. AI 에이전트들이 자율적으로 행동하는 시대가 옵니다. 에이전트가 도구를 호출할 때마다 보안 비용을 마이크로 자동 결제하는 세계. 도로를 달리려면 통행료를 내듯, SapperAI는 AI 에코시스템의 톨게이트가 됩니다."

---

### 슬라이드 9: 클로징 (4:30 ~ 4:40, 10초)

**내용**:
```bash
npm install sapper-ai && npx sapper-ai scan
```
- Web: https://sapper-ai.com
- GitHub: https://github.com/sapper-ai/sapperai
- QR 코드 (sapper-ai.com)

**스크립트**: "지금 바로 시작하세요. 감사합니다."

---

## 제작 도구

| 도구 | 용도 |
|------|------|
| **Marp** | Markdown → PDF/PPTX 슬라이드 |
| **OBS Studio** | 화면 녹화 (슬라이드/브라우저/터미널 전환) |
| **분할 편집** | 슬라이드 구간 + 데모 구간 별도 녹화 후 합치기 |

---

## TODO List

### 1. 슬라이드 Marp 파일 작성
- [ ] `docs/slides/hackathon-2026-02-20.md` — Marp 형식 슬라이드 9장 작성
  - Marp frontmatter: `marp: true`, `theme: sapperai`, `paginate: true`
  - 각 슬라이드는 `---`로 구분
- [ ] `docs/slides/theme.css` — 다크 테마 + 올리브 악센트
  - 배경: `#0a0a0a`, 텍스트: `#e5e5e5`, 악센트: `#84cc16` (올리브)
  - 폰트: `JetBrains Mono` 또는 시스템 monospace
  - 코드 블록: 터미널 크롬 스타일
- [ ] 아키텍처 다이어그램 (슬라이드 4) — ASCII 또는 Mermaid
- [ ] 포지셔닝 맵 (슬라이드 6) — ASCII 2x2 매트릭스
- [ ] BM 피라미드 (슬라이드 6) — 3단 텍스트 피라미드
- [ ] 검증: `npx @marp-team/marp-cli --html docs/slides/hackathon-2026-02-20.md -o docs/slides/output.pdf`

### 2. 발표 스크립트 작성
- [ ] `docs/slides/script.md` — 이 문서의 스크립트 섹션을 통합 정리
- [ ] 전환점 멘트 2개 포함
- [ ] 총 시간 5분 이내 확인 (글자 수 기준 약 1,200자 한국어 = 5분)

### 3. 데모 시나리오 준비
- [ ] `docs/slides/demo-scenario.md` — 데모 4개 순서 + 정확한 명령어
- [ ] OpenAI API 키 설정 확인 (`OPENAI_API_KEY` 또는 `~/.sapperai/auth.json`)
- [ ] `npx sapper-ai scan` 실행 → LlmDetector 동작 확인
- [ ] `npx sapper-ai harden --apply` 실행 → MCP config 래핑 확인
- [ ] HTML 리포트 파일 존재 확인: `docs/reports/2026-02-10-real-env-mcp-scan.html`
- [ ] 사전 녹화 백업 GIF/영상 준비 (네트워크 실패 대비)

### 4. 영상 제작
- [ ] OBS Studio 장면 설정 (슬라이드/브라우저/터미널)
- [ ] 슬라이드 구간 녹화
- [ ] 데모 구간 녹화
- [ ] 편집 + 합치기
- [ ] 유튜브 업로드
- [ ] hack.primer.kr에 영상 URL + 제품 URL 입력

---

## 참고 파일

| 파일 | 용도 |
|------|------|
| `docs/plans/2026-02-12-hackathon-submission-plan.md` | 기존 해커톤 계획 |
| `docs/plans/2026-02-10-monetization-strategy.md` | 경쟁사 분석, BM, 가격 벤치마크 |
| `docs/plans/2026-02-16-feedback-synthesis.md` | 외부 피드백 5건 종합 + 액션 플랜 |
| `docs/plans/2026-02-17-openclaw-integration-strategy.md` | OpenClaw 통합 전략 |
| `docs/reports/2026-02-10-real-env-mcp-scan.html` | 데모용 HTML 리포트 |
| `packages/core/src/detectors/LlmDetector.ts` | OpenAI API 활용 코드 (GPT-4.1-mini) |
| `apps/web/app/api/adversary-campaign/route.ts` | Adversary Campaign + OpenAI 연동 |
| `packages/sapper-ai/src/auth.ts` | OpenAI API 키 관리 |
