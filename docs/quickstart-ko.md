# SapperAI 사용자용 빠른 시작 (CLI)

목표: `sapper-ai`를 설치하고 `scan` 한 번 실행하면, 안내(Enter 기본값)대로 진행하면서 설정/CI/MCP 보호까지 한 번에 켜는 흐름입니다.

## 1) 설치

프로젝트 루트에서:

```bash
# npm
npm install --save-dev sapper-ai

# pnpm
pnpm add -D sapper-ai
```

## 2) 첫 실행: 스캔

```bash
npx sapper-ai scan
```

- TTY(터미널)에서는 스캔 범위를 선택하고(Enter 기본값), 필요 시 AI 분석(옵션)을 선택합니다.
- 스캔이 끝나면, 가능한 경우 `harden`(권장 설정 적용)을 바로 진행할지 묻습니다.

## 3) 자동 개선: harden

스캔 후 프롬프트를 건너뛰었거나, 다시 실행하고 싶으면:

```bash
# 변경 계획만 보기 (기본 동작, 파일 수정 없음)
npx sapper-ai harden

# 프로젝트 변경 적용 (파일 생성/수정)
npx sapper-ai harden --apply

# 시스템 변경까지 포함 (홈 디렉토리 파일 변경)
npx sapper-ai harden --apply --include-system
```

`harden`가 하는 일(가능한 경우):

- 프로젝트 정책 파일 생성: `./sapperai.config.yaml`
- GitHub Actions 워크플로 생성: `./.github/workflows/sapperai.yml`
- 전역 정책 파일 생성: `~/.sapperai/policy.yaml`
- Claude Code의 MCP 서버를 `sapperai-proxy` 뒤로 감싸기: `~/.config/claude-code/config.json`

## 4) CI에서 쓰는 한 줄 (프롬프트 없이)

```bash
npx -y sapper-ai@0.9.0 scan --policy ./sapperai.config.yaml --no-prompt --no-open --no-save
```

## 5) 격리(Quarantine) 사용

스캔 중 차단(block)된 파일을 격리하려면:

```bash
npx sapper-ai scan --fix
```

격리 목록/복구:

```bash
npx sapper-ai quarantine list
npx sapper-ai quarantine restore <id>

# 복구 경로에 파일이 이미 있으면 덮어쓰지 않습니다.
# 정말로 덮어써야 하면:
npx sapper-ai quarantine restore <id> --force
```

## 6) MCP 설정만 따로 감싸기/해제

```bash
# Claude Code 기본 설정 파일을 감쌉니다(백업 생성).
npx sapper-ai mcp wrap-config

# 되돌리기
npx sapper-ai mcp unwrap-config
```
