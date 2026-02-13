# Fix: npm publish failures for sapper-ai and @sapper-ai/dashboard

## Context

`pnpm changeset version` → `git push` → GitHub Actions Release workflow에서 npm publish가 2개 패키지에서 실패.

## Issue 1: `sapper-ai` — E403 Forbidden

```
E403 403 Forbidden - PUT https://registry.npmjs.org/sapper-ai
You may not perform that action with these credentials.
```

### Root Cause

GitHub Secrets의 `NPM_TOKEN`이 `@sapper-ai/*` 스코프 패키지만 publish할 수 있는 **Granular Access Token**일 가능성. unscoped 패키지(`sapper-ai`)는 범위 밖.

### Fix (manual, npm website)

Option A: Granular Token의 패키지 범위에 `sapper-ai` 추가
Option B: Classic **Automation** 토큰으로 교체 (모든 패키지 publish 가능)

1. https://www.npmjs.com → Access Tokens
2. 새 토큰 발급 (Classic > Automation)
3. GitHub repo > Settings > Secrets > `NPM_TOKEN` 값 교체

## Issue 2: `@sapper-ai/dashboard` — E422 provenance mismatch

```
Error verifying sigstore provenance bundle:
package.json: "repository.url" is "", expected to match "https://github.com/sapper-ai/core"
```

### Root Cause

`packages/dashboard/package.json`에 `repository` 필드가 누락.

### Fix (code, already applied locally)

**File**: `packages/dashboard/package.json`

Added:
```json
"license": "MIT",
"author": "SapperAI",
"homepage": "https://github.com/sapper-ai/sapperai#readme",
"repository": {
  "type": "git",
  "url": "https://github.com/sapper-ai/sapperai.git",
  "directory": "packages/dashboard"
},
"publishConfig": {
  "access": "public"
}
```

## TODO

- [ ] (Manual) NPM 토큰을 Classic Automation으로 교체하고 GitHub Secrets 업데이트
- [ ] (Code) dashboard package.json 수정 커밋 & push
- [ ] (Auto) GitHub Actions Release 재실행
- [ ] (Verify) `npm view sapper-ai` 로 publish 확인

## Already Fixed in This Session

- `pnpm-lock.yaml` sync with dashboard package
- postinstall script resilience (`|| exit 0`)
- FileWatcher chokidar v5 flaky test (50ms settling delay)
