# SapperAI Monetization Strategy

**Date**: 2026-02-10
**Stage**: Pre-launch (npm publish 전)
**Author**: SapperAI Founding Team

---

## 1. Executive Summary

SapperAI는 AI 에이전트의 Tool Layer 보안에 특화된 TypeScript 프레임워크다. 기존 솔루션(Lakera, LLM Guard, NeMo Guardrails)이 프롬프트 I/O 레이어에 집중하는 반면, SapperAI는 **도구 호출 시점의 보안**이라는 미개척 영역을 타겟한다.

**전략 핵심**: 무료 + 강력한 오픈소스로 최대한 많은 개발자를 확보한 뒤, 트랙션이 생기면 엔터프라이즈/클라우드 기능으로 수익화한다.

### 확정된 의사결정

| 항목 | 결정 |
|------|------|
| 타겟 고객 | MCP 도구 개발자 우선 |
| GTM 전략 | 오픈소스 커뮤니티 + MCP 에코시스템 |
| 가격 철학 | 무료로 강력하게, 최대 사용자 확보 |
| 수익화 시점 | 구조만 미리 설계, 과금은 트랙션 후 |
| 라이선스 | MIT |
| 목표 규모 | VC-backed 스타트업 |

---

## 2. Market Context

### 2.1 AI 에이전트 보안 시장 (2026년 2월)

**시장 단계**: 초기 성장기 — 프로덕션에 AI 에이전트를 운영하는 기업은 20%에 불과하지만, 57.5%가 보안 승인 없이 배포를 진행 중이다. 수요는 존재하나 공급이 부족한 상태.

**투자 동향**:
- AI 보안 스타트업 총 펀딩 (2024-2025): $8.5B, 175개 회사
- 주요 라운드: Cyera $400M Series F ($9B 밸류), Adaptive Security $81M Series B (OpenAI Startup Fund 참여)
- M&A 활발: Check Point → Lakera, Palo Alto → Protect AI, ServiceNow $11.6B 보안 인수

**CISO 예산 우선순위** (2026년):
1. 데이터 유출 방지
2. Shadow AI 통제
3. 에이전트 거버넌스
4. 과도한 권한 관리

### 2.2 경쟁 환경

| 회사 | 포지셔닝 | 가격 모델 | 레이턴시 | 비고 |
|------|---------|----------|---------|------|
| **Lakera** (Check Point) | 프롬프트 인젝션 방어 | Free → $8/user/mo → $21 → Enterprise | <50ms | Gandalf 게임으로 80M+ 프롬프트 수집 |
| **Protect AI** (Palo Alto) | AI 모델 전체 라이프사이클 | Enterprise Contact Sales | - | LLM Guard 오픈소스, 4.84M+ 모델 스캔 |
| **Lasso Security** | 엔터프라이즈 AI 통제 | Enterprise Contact Sales | <50ms | MCP 게이트웨이 오픈소스 |
| **Pillar Security** | AI 전체 라이프사이클 | Enterprise Contact Sales | - | RedGraph 공격 표면 매핑 |
| **Socket.dev** | 공급망 보안 | Free → $25/dev/mo → $50 → Enterprise | - | Reachability Analysis로 60% FP 감소 |

### 2.3 SapperAI 차별화 포인트

| 차별화 | SapperAI | 경쟁사 |
|--------|---------|--------|
| **보안 레이어** | Tool Layer 전담 | I/O Layer 중심 |
| **통합 방식** | SDK 플러그인 (코드 레벨) | Gateway/Proxy (인프라 레벨) |
| **레이턴시** | p99 0.037ms | 50ms+ |
| **오탐률** | 0% (120개 샘플) | 미공개 |
| **탐지율** | 96% (50개 공격 샘플) | 99.8% (Lasso, 자체 기준) |
| **언어** | TypeScript 네이티브 | Python 중심 |
| **정책** | Per-tool 정책 | 전역 정책 |

**핵심 메시지**: "AI 에이전트가 도구를 호출할 때, 0.04ms 안에 96%의 공격을 잡아낸다. 오탐 제로."

---

## 3. Target Customer

### 3.1 Primary: MCP 도구 개발자

**페르소나**: MCP 서버를 만들어 Claude Desktop, Cursor, OpenCode 등에서 사용하는 개발자/소규모 팀.

**니즈**:
- MCP 서버에 보안 레이어를 쉽게 추가하고 싶다
- 프롬프트 인젝션으로 도구가 악용되는 것을 막고 싶다
- 설정 최소화, 코드 한 줄로 적용하고 싶다

**채택 동기**:
- 무료 + 오픈소스 (MIT)
- npm install 한 줄로 시작
- MCP 프록시: 기존 코드 수정 없이 감싸기만 하면 됨

**지불 의향**: 개인은 낮음 ($0). 하지만 팀/회사에서 쓰기 시작하면 $25-50/dev/mo 가능.

### 3.2 Secondary: AI 에이전트 빌더 (스타트업)

OpenAI Agents SDK, LangChain 등으로 에이전트를 구축하는 팀. 프로덕션 배포 시점에 보안 요구사항이 급증한다. MCP 개발자 커뮤니티에서 자연스럽게 유입.

### 3.3 Tertiary: 엔터프라이즈 AI/보안팀

AI 에이전트를 사내 도입하는 대기업. 컴플라이언스/거버넌스 중심. 커뮤니티에서 신뢰가 쌓인 후 엔터프라이즈 세일즈 시작.

---

## 4. Go-to-Market Strategy

### Phase 1: 무료 확산 (0-6개월)

**목표**: 1,000+ GitHub Stars, 500+ weekly npm downloads, 100+ active users

#### 4.1.1 오픈소스 런칭

```
Week 1-2: npm publish + GitHub repo public
Week 3-4: Hacker News "Show HN" + Reddit r/programming, r/artificial
Week 5-8: Dev.to, Medium 기술 블로그 시리즈
Week 9-12: 콘퍼런스 발표 (온라인 meetup, AI 보안 관련)
```

**콘텐츠 전략**:
- "Why Your MCP Server Needs Security" — 문제 인식 유도
- "How We Detect Prompt Injection in 0.04ms" — 기술적 깊이
- "MCP Security Best Practices" — SEO + 권위 구축
- 공격 데모 영상: 보안 없는 MCP 서버가 어떻게 뚫리는지 시연

#### 4.1.2 MCP 에코시스템 진입

- MCP 공식 디렉토리/마켓플레이스에 보안 도구로 등록
- Anthropic 파트너 에코시스템에 포지셔닝
- Claude Desktop, Cursor, OpenCode 등의 MCP 사용 환경에 최적화
- MCP 서버 작성 가이드에 "보안 섹션"으로 SapperAI 추천받기

#### 4.1.3 커뮤니티 빌딩

- GitHub Discussions 활성화
- Discord 서버 개설
- "SapperAI Security Rules" 커뮤니티 규칙 기여 프로그램
- 보안 연구자/화이트해커 커뮤니티와 협업

### Phase 2: 트랙션 확인 + 구조 설계 (6-12개월)

**목표**: 5,000+ GitHub Stars, 2,000+ weekly downloads, 10+ 기업 사용

이 시점에서 유료 전환 구조를 본격 설계한다:
- 사용자 행동 데이터 분석 (어떤 기능을 가장 많이 쓰는지)
- 유료 전환 트리거 포인트 식별
- 클라우드 서비스 MVP 개발 시작

### Phase 3: 수익화 전환 (12-18개월)

**목표**: 첫 매출 발생, 50+ paying teams

트랙션이 검증되면 유료 기능 출시:
- 클라우드 대시보드 (팀 관리, 로그 분석)
- LLM 기반 고급 탐지 (Cloud API)
- 엔터프라이즈 기능 (SSO, RBAC, 감사 로그)

---

## 5. Monetization Architecture (미리 설계)

### 5.1 오픈소스 코어 (영원히 무료)

현재 MVP의 모든 기능은 무료로 유지한다:

```
@sapperai/types    — 타입 정의 (MIT, 무료)
@sapperai/core     — RulesDetector, DecisionEngine, Guard, Scanner (MIT, 무료)
@sapperai/mcp      — MCP Security Proxy + CLI (MIT, 무료)
@sapperai/openai   — OpenAI Agents SDK Guardrails (MIT, 무료)
```

**무료 코어의 가치**:
- 60+ 규칙 기반 탐지 패턴
- 96% 탐지율, 0% 오탐
- Sub-millisecond 레이턴시
- Per-tool 정책 설정
- 구조화된 감사 로그
- MCP 프록시 + OpenAI SDK 통합

**원칙**: 개인 개발자와 소규모 팀이 프로덕션에서 사용하는 데 아무런 제약이 없어야 한다.

### 5.2 유료 영역 (인터페이스만 미리 설계)

실제 구현/과금은 트랙션 후. 지금은 **확장 포인트(인터페이스)만** 설계한다.

#### Tier 1: Cloud Dashboard (Team)

**예상 가격**: $30-50/dev/mo (트랙션 후 확정)

| 기능 | 설명 | 인터페이스 준비 |
|------|------|---------------|
| 중앙 로그 수집 | 여러 서비스의 감사 로그 통합 | AuditLogger에 remote sink 인터페이스 |
| 실시간 대시보드 | 탐지/차단 현황, 트렌드 | AuditLogEntry 타입 이미 정의됨 |
| 팀 정책 관리 | UI로 정책 설정/배포 | PolicyManager의 loadPolicies() |
| 알림 통합 | Slack, PagerDuty, Webhook | Guard의 이벤트 훅 인터페이스 |
| CI/CD 통합 | GitHub Actions, GitLab CI | Scanner의 CLI 인터페이스 |

#### Tier 2: Advanced Detection (Team/Enterprise)

**예상 가격**: Cloud 포함 또는 별도 과금

| 기능 | 설명 | 인터페이스 준비 |
|------|------|---------------|
| LLM 기반 정밀 탐지 | OpenAI/Anthropic API로 고위험 도구 호출 정밀 분석 | LlmDetector 인터페이스 이미 존재 |
| 커스텀 규칙 엔진 | 사용자 정의 탐지 규칙 | Detector 인터페이스 (플러그인) |
| 위협 인텔리전스 | 최신 공격 패턴 자동 업데이트 | RulesDetector의 규칙 로딩 구조 |
| ML 기반 탐지 | 임베딩/분류 모델 | Detector 인터페이스 (v0.3.0 로드맵) |

#### Tier 3: Enterprise Governance

**예상 가격**: $5K-20K/mo (엔터프라이즈 세일즈)

| 기능 | 설명 |
|------|------|
| SSO/SAML | 엔터프라이즈 인증 통합 |
| RBAC | 역할 기반 접근 제어 |
| 감사 보고서 | SOC2, ISO 27001 컴플라이언스 |
| SLA | 가용성/응답시간 보장 |
| 전담 지원 | 온보딩, 커스텀 규칙, 아키텍처 컨설팅 |
| Self-hosted | 온프레미스 배포 옵션 |

### 5.3 수익화 전환 트리거

유료 전환은 **자연스러운 시점**에 발생해야 한다. 강제하지 않는다.

| 시그널 | 전환 포인트 | 액션 |
|--------|-----------|------|
| 팀 크기 5명+ | 로그가 분산되어 중앙 관리 필요 | Cloud Dashboard 제안 |
| 월 10,000+ 스캔 | 규칙만으로 부족, 정밀 탐지 필요 | LLM Detection 제안 |
| SSO 로그인 시도 | 엔터프라이즈 신호 | 영업팀 연락 |
| 커스텀 규칙 요청 | 도메인 특화 필요 | Advanced Detection 제안 |
| 컴플라이언스 문의 | 규제 대응 필요 | Enterprise 제안 |

---

## 6. Competitive Positioning

### 6.1 포지셔닝 맵

```
                    Tool Layer Focus
                         ▲
                         │
                         │  ★ SapperAI
                         │  (Tool Layer + SDK Plugin)
                         │
          Lasso ●        │
          (Gateway)      │
                         │
    ─────────────────────┼─────────────────────► Developer-First
                         │
         Lakera ●        │         ● Socket.dev
         (I/O Layer)     │         (Supply Chain)
                         │
         Protect AI ●    │
         (Full Lifecycle)│
                         │
                    Enterprise-First
```

### 6.2 경쟁 우위 메시지

**vs Lakera**: "Lakera는 프롬프트를 보호한다. SapperAI는 도구 호출을 보호한다. 둘 다 필요하다."
- 경쟁이 아닌 보완 관계로 포지셔닝
- 레이턴시: SapperAI 0.04ms vs Lakera 50ms (1,250배 빠름)

**vs Lasso**: "Lasso는 게이트웨이, SapperAI는 SDK. 인프라 변경 없이 코드 한 줄로 적용."
- 게이트웨이 vs SDK 접근 방식의 차이 강조

**vs Protect AI**: "Protect AI는 모델 전체를 본다. SapperAI는 도구 호출만 깊이 판다."
- 범위의 차이 → 전문성 강조

**vs 자체 구축**: "60+ 패턴, 170개 테스트 샘플, 96% 탐지율. 직접 만들 필요 없다."
- 시간/비용 절감 메시지

---

## 7. VC Funding Roadmap

### 7.1 Seed Round (Target: 12-18개월 후)

**목표**: $1-3M raise at $10-15M valuation

**필요 지표**:
- 5,000+ GitHub Stars
- 2,000+ weekly npm downloads
- 10+ 기업 사용 (로고)
- 첫 매출 또는 강력한 LOI (Letter of Intent)
- 팀 구성 (최소 2-3명 핵심 멤버)

**투자자 타겟**:
- AI 보안 특화 VC: OpenAI Startup Fund, Bain Capital (Adaptive Security 투자)
- Developer Tools VC: Accel, a16z, Sequoia
- 한국 VC: 한국투자파트너스, 소프트뱅크벤처스

**피치 핵심**:
> "AI 에이전트 시장이 폭발하고 있다. 20%만 프로덕션에 에이전트를 쓰지만, 57.5%가 보안 승인 없이 배포한다. SapperAI는 이 갭을 메운다. 도구 호출 보안이라는 새로운 카테고리를 만들고 있다."

### 7.2 Series A (Target: 24-36개월 후)

**목표**: $10-20M raise at $50-100M valuation

**필요 지표**:
- $1-3M ARR
- 100+ paying customers
- 엔터프라이즈 고객 5+
- Net Revenue Retention 120%+
- 팀 10-20명

**성장 벤치마크** (업계 참고):
- Snyk: $343M ARR, $7.4B 밸류, 12% YoY 성장
- Socket.dev: $40M Series B, 10K+ GitHub Marketplace 설치
- Semgrep: $40/contributor/mo, Cross-file analysis로 차별화

---

## 8. Revenue Projections (Conservative)

### 시나리오: Community-First Growth

| 기간 | GitHub Stars | Weekly Downloads | Paying Teams | ARR |
|------|-------------|-----------------|-------------|-----|
| Month 6 | 1,000 | 500 | 0 | $0 |
| Month 12 | 3,000 | 2,000 | 0 | $0 |
| Month 18 | 5,000 | 5,000 | 20 | $50K |
| Month 24 | 10,000 | 10,000 | 100 | $500K |
| Month 36 | 20,000 | 20,000 | 500 | $3M |

**가정**:
- Free → Paid 전환율: 2-3% (업계 평균)
- 평균 Team 가격: $40/dev/mo, 평균 5 devs = $200/team/mo
- Enterprise 고객은 Month 24+부터 (높은 ACV로 ARR 가속)

### 비용 구조 (Pre-Seed)

| 항목 | 월 비용 |
|------|--------|
| 클라우드 인프라 | $0 (오픈소스, 로컬 실행) |
| 도메인/SSL | ~$10 |
| CI/CD (GitHub Actions) | 무료 (오픈소스) |
| 마케팅 | $0 (콘텐츠 마케팅, 시간 투자) |
| **Total** | **~$10/mo** |

수익화 이전까지 거의 비용이 들지 않는 구조.

---

## 9. Product Roadmap (Revenue-Aligned)

### v0.1.0 — Open Source Launch (Now)
- [x] npm publish 준비 완료
- [ ] GitHub repo public + git init
- [ ] CI/CD (GitHub Actions)
- [ ] npm publish (@sapperai/types, core, mcp, openai)

### v0.2.0 — Community Growth (Month 1-6)
- [ ] LlmDetector 구현 (OpenAI, Anthropic)
- [ ] LangChain 플러그인 (@sapperai/langchain)
- [ ] VSCode Extension (실시간 보안 경고)
- [ ] 추가 프레임워크 지원 (Vercel AI SDK, CrewAI)

### v0.3.0 — Cloud Foundation (Month 6-12)
- [ ] 클라우드 대시보드 MVP (로그 수집 + 시각화)
- [ ] 팀 관리 기능
- [ ] Webhook/알림 통합
- [ ] ML 기반 탐지 (@huggingface/transformers)

### v1.0.0 — Revenue Launch (Month 12-18)
- [ ] Team 플랜 출시
- [ ] CI/CD 통합 (GitHub Actions, GitLab CI)
- [ ] 위협 인텔리전스 (자동 규칙 업데이트)
- [ ] 결제 시스템 (Stripe)

### v2.0.0 — Enterprise (Month 18-36)
- [ ] SSO/SAML
- [ ] RBAC
- [ ] 컴플라이언스 보고서 (SOC2, ISO 27001)
- [ ] Self-hosted 옵션
- [ ] 엔터프라이즈 영업팀 구성

---

## 10. Risk Analysis

### 10.1 주요 리스크

| 리스크 | 영향 | 확률 | 대응 |
|--------|------|------|------|
| **플랫폼 리스크**: MCP 표준이 변경/쇠퇴 | High | Low | OpenAI, LangChain 등 다중 통합으로 분산 |
| **경쟁사 진입**: Lakera/Lasso가 Tool Layer로 확장 | High | Medium | 속도 우위 유지 + 커뮤니티 선점 |
| **대형 플레이어**: GitHub Advanced Security가 AI 보안 번들링 | High | Medium | 전문성 + 커스터마이징으로 차별화 |
| **채택 속도**: MCP 개발자 풀이 예상보다 작음 | Medium | Medium | OpenAI Agents, LangChain으로 타겟 확대 |
| **기술 부채**: Rules-only로는 고도화된 공격 못 막음 | Medium | High | LLM + ML 탐지 로드맵으로 보완 |
| **오픈소스 포크**: 커뮤니티가 포크해서 경쟁 | Low | Low | 클라우드 서비스로 수익 확보, MIT 라이선스 유지 |

### 10.2 완화 전략

1. **다중 프레임워크 지원**: MCP만이 아닌 OpenAI, LangChain, Vercel AI SDK 등으로 확장
2. **커뮤니티 선점**: 빠른 오픈소스 런칭으로 "AI Tool Layer Security = SapperAI" 인식 구축
3. **기술적 해자**: LLM + ML 탐지 계층으로 Rules-only 한계 극복
4. **클라우드 락인**: 대시보드/팀 기능은 클라우드 전용으로 포크 방어

---

## 11. Immediate Next Steps

### Week 1-2
1. git init + GitHub repo 생성 (public)
2. GitHub Actions CI/CD 설정
3. npm publish (4개 패키지)
4. README 개선 (배지, 설치 가이드, 데모 GIF)

### Week 3-4
5. "Show HN" 포스트 작성 + 제출
6. MCP 디렉토리/마켓플레이스 등록
7. Discord 커뮤니티 개설
8. 첫 기술 블로그 게시 ("Why Your MCP Server Needs Security")

### Month 2-3
9. 사용자 피드백 수집 + 반영
10. LangChain 플러그인 개발 시작
11. VSCode Extension 프로토타입
12. 추가 프레임워크 지원 조사

---

## Appendix A: Market Research Sources

- AI 에이전트 보안 시장 조사 (2026-02-10, Librarian Agent)
- 오픈소스 보안 도구 수익화 성공 사례 조사 (2026-02-10, Librarian Agent)
- 경쟁사 분석: Lakera, Protect AI, Lasso Security, Pillar Security, Socket.dev
- 벤치마크: Snyk ($343M ARR), Semgrep, GitGuardian

## Appendix B: Pricing Benchmarks

| 도구 | Free | Team | Enterprise |
|------|------|------|------------|
| **Lakera** | 3 users | $8/user/mo | $21/user/mo → Custom |
| **Semgrep** | Community rules | $40/contributor/mo | Custom |
| **GitGuardian** | 25 devs | Contact Sales | Custom |
| **Socket.dev** | 1,000 scans/mo | $25/dev/mo | $50/dev/mo → Custom |
| **Snyk** | Open source | $52/dev/mo | Custom |
| **SapperAI (계획)** | 전체 코어 무료 | ~$30-50/dev/mo (미정) | ~$5K-20K/mo (미정) |

## Appendix C: SapperAI Technical Metrics

- **Detection Rate**: 96% (48/50 malicious samples)
- **False Positives**: 0% (0/100 benign + 0/20 edge cases)
- **Latency**: p99 0.0018-0.0370ms (Rules-only)
- **Throughput**: 713K ops/sec (small), 30K ops/sec (large)
- **Test Coverage**: 90 tests, 4 packages
- **Detection Patterns**: 60+ (prompt injection, command injection, data exfiltration, code injection, path traversal)
