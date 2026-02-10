# SapperAI 공개 및 npm 배포 구현 계획 (Publication Plan)

이 문서는 SapperAI 프로젝트를 GitHub 및 npm에 공개(`public`)하고, CI/CD를 통한 자동 배포 파이프라인을 구축하기 위한 단계별 실행 계획입니다.

**전략 선택 사항:**
1.  **Identity**: Brand-First (`@sapperai` npm org, `sapperai` GitHub org)
2.  **Versioning**: Automated (Changesets)
3.  **CI/CD**: Immediate (Include in initial commit)

---

## Phase 0: Pre-flight Check (사전 점검)

배포 전 로컬 환경과 코드가 깨끗한 상태인지 확인합니다.

-   **예상 소요 시간**: 5분
-   **실행 주체**: [AUTO] (Agent)

### 0.1 빌드 및 테스트 검증
모든 패키지가 정상적으로 빌드되고 테스트를 통과하는지 확인합니다.
```bash
pnpm install
pnpm build
pnpm test
```

### 0.2 민감 파일 스캔
`package.json`의 `files` 필드가 `dist`만 포함하고 있는지 재확인하고, `.gitignore`에 포함되어야 할 민감한 파일 목록을 확정합니다.

**제외 대상 (반드시 확인):**
-   `scripts/run-real-env-mcp-scan.mjs` (로컬 경로 포함)
-   `docs/reports/` (스캔 결과 데이터)
-   `.env`, `.DS_Store`, `node_modules`, `dist`, `.turbo`

---

## Phase 1: Local Git & Project Configuration (로컬 설정)

Git 저장소를 초기화하고 필수 설정 파일을 생성합니다.

-   **예상 소요 시간**: 10분
-   **실행 주체**: [AUTO] (Agent)

### 1.1 `.gitignore` 생성
루트 디렉토리에 다음 내용을 포함한 `.gitignore`를 생성합니다.
```text
# Dependencies & Build
node_modules
dist
.turbo
coverage

# System
.DS_Store
.env
*.log

# Sensitive Project Files
docs/reports/
scripts/run-real-env-mcp-scan.mjs
```

### 1.2 `LICENSE` 파일 생성
패키지에 명시된 MIT License 전문을 담은 `LICENSE` 파일을 루트에 생성합니다.

### 1.3 Changesets 설정
자동 버전 관리를 위한 Changesets를 설치하고 초기화합니다.
```bash
# 설치
pnpm add -D -w @changesets/cli

# 초기화
pnpm changeset init
```
`.changeset/config.json` 수정:
-   `access`: "public"
-   `baseBranch`: "main"
-   `commit`: false (CI에서 처리)

### 1.4 Git 초기화
```bash
git init
git add .
git commit -m "feat: initial commit with project structure and config"
```

---

## Phase 2: Organization Setup (조직 설정)

**⚠️ 중요 결정 구간 (Decision Point)**
GitHub 및 npm 조직(Organization)을 생성합니다. 이름 선점이 불가능할 경우 Fallback 전략을 사용합니다.

-   **예상 소요 시간**: 15분
-   **실행 주체**: [MANUAL] (User)

### 2.1 npm Organization 생성 (웹) [MANUAL]
1.  [npmjs.com](https://www.npmjs.com/) 로그인
2.  우측 상단 프로필 -> "+ Add Organization" 클릭
3.  Org Name: `sapperai` 입력 및 생성 (무료 플랜 선택)
    *   ⚠️ **실패 시 (이름 선점됨)**: Fallback 전략(Phase 2.3)으로 이동

### 2.2 GitHub Organization 생성 (웹) [MANUAL]
1.  [github.com](https://github.com/) 로그인
2.  Top right "+" -> "New organization"
3.  Org Name: `sapperai` 입력 및 생성 (Free Plan)
    *   ⚠️ **실패 시 (이름 선점됨)**: Fallback 전략(Phase 2.3)으로 이동

### 2.3 Fallback 전략 (이름 선점 실패 시)
만약 `sapperai` 이름을 사용할 수 없는 경우:
-   **GitHub**: `KIMGYUDONG/sapperai` (개인 계정) 사용
-   **npm**: `@kimgyudong` (사용자 스코프) 사용
-   **Action**: 모든 `package.json`의 `name` 필드를 `@sapperai/*` -> `@kimgyudong/sapperai-*`로 일괄 변경해야 함 (Agent에게 요청).

---

## Phase 3: Remote Connection & Secrets (원격 연결 및 보안)

로컬 저장소를 GitHub에 연결하고 CI/CD를 위한 비밀키를 설정합니다.

-   **예상 소요 시간**: 10분
-   **실행 주체**: [MIXED] (User + Agent)

### 3.1 GitHub Repo 생성 [AUTO]
(GitHub Org `sapperai` 생성 성공 가정)
```bash
# GitHub CLI를 사용하여 Org 하위에 Public Repo 생성
gh repo create sapperai/sapperai --public --source=. --remote=origin
```

### 3.2 NPM Token 발급 [MANUAL]
1.  [npmjs.com](https://www.npmjs.com/) -> Profile -> Access Tokens
2.  "Generate New Token" -> "Granular Access Token" 선택
3.  Permissions: **Read and Write**
4.  Select packages: "All packages" (또는 `@sapperai` scope)
5.  토큰 값 복사 (`npm_...`)

### 3.3 GitHub Secrets 등록 [AUTO/MANUAL]
발급받은 NPM 토큰을 GitHub Secrets에 등록합니다.
```bash
gh secret set NPM_TOKEN --body "npm_..."
```
*(Agent가 `gh` 명령어로 등록 가능하나, 토큰 값은 사용자가 입력해야 안전함)*

---

## Phase 4: CI/CD Pipeline Setup (자동화 구축)

GitHub Actions 워크플로우를 작성합니다.

-   **예상 소요 시간**: 5분
-   **실행 주체**: [AUTO] (Agent)

### 4.1 Release Workflow 생성
`.github/workflows/release.yml` 파일 생성:
-   **Trigger**: `push` to `main`
-   **Permissions**: `id-token: write` (Provenance용), `contents: write` (Changesets용)
-   **Steps**:
    1.  Checkout & Setup Node/pnpm
    2.  Install Dependencies (`pnpm install --frozen-lockfile`)
    3.  Build & Test (`pnpm -r build && pnpm -r test`)
    4.  Create Release Pull Request (by Changesets)
    5.  Publish to npm (on version packages merge)

### 4.2 Workflow 커밋 및 푸시
```bash
git add .github/workflows/release.yml
git commit -m "ci: add release workflow with provenance"
git push origin main
```

---

## Phase 5: First Release Execution (첫 배포 실행)

첫 번째 npm 패키지를 배포합니다.

-   **예상 소요 시간**: 10분
-   **실행 주체**: [MIXED]

### 5.1 첫 Changeset 생성 [AUTO]
```bash
pnpm changeset
```
-   모든 패키지 선택
-   Summary: "Initial public release"
-   Type: `minor` (0.1.0 -> 0.2.0) 또는 `patch`

### 5.2 Version Bump (로컬) [AUTO]
```bash
pnpm changeset version
git add .
git commit -m "chore: version packages for initial release"
git push origin main
```

### 5.3 배포 모니터링 [MANUAL]
GitHub Actions 탭에서 `Release` 워크플로우가 성공하는지 확인합니다.
-   성공 시: npmjs.com/@sapperai 에서 패키지 확인
-   실패 시: 로그 분석 후 수정 (Rollback: `npm unpublish`는 72시간 내 가능하나 권장되지 않음, `deprecated` 처리 후 재배포 권장)

---

## Phase 6: Verification (검증)

배포된 패키지가 정상적으로 작동하는지 외부에서 확인합니다.

-   **예상 소요 시간**: 5분
-   **실행 주체**: [AUTO] (Agent)

### 6.1 설치 테스트
임시 디렉토리에서 패키지를 설치해봅니다.
```bash
mkdir /tmp/sapper-test && cd /tmp/sapper-test
npm init -y
npm install @sapperai/core @sapperai/mcp
```

### 6.2 실행 테스트
간단한 스크립트로 모듈 로딩을 확인합니다.
```bash
node -e "require('@sapperai/core')"
```

---

## Rollback Plan (롤백 계획)

-   **Git**: 문제 발생 시 `git reset --hard <commit-hash>` 및 `git push -f` (초기 단계이므로 가능)
-   **npm**:
    -   배포 직후(72시간 내): `npm unpublish @sapperai/package --force` (주의: 영구적으로 해당 버전 재사용 불가)
    -   일반적 대응: `npm deprecate` 사용 후 픽스 버전 배포
-   **GitHub**: Repo 삭제 후 재생성 (`gh repo delete`)

---

## Next Step for You (사용자 할 일)

이 계획을 승인하시면 다음 명령을 내려주세요:
`"Phase 0부터 Phase 1까지 실행해줘"`

또는 특정 Phase만 먼저 실행할 수 있습니다.
가장 먼저 **[MANUAL] Phase 2 (조직 생성)**을 수행해주셔야 합니다.
