# API 키 관리 (인라인 프롬프트)

**작성일**: 2026-02-15
**선행 조건**: CLI 출력 리디자인 (2026-02-15-cli-output-redesign.md) 완료 후 진행
**참고**: OpenCode CLI의 auth 패턴 (`opencode auth login/list/logout`)

---

## 문제

현재 `--ai` 플래그 사용 시 `OPENAI_API_KEY` 환경변수가 없으면 에러만 출력:

```
Error: OPENAI_API_KEY environment variable is required
```

유저는 어디서 키를 설정하는지 모름.

---

## 해결: 인라인 프롬프트 + 로컬 저장

```
$ npx sapper-ai scan --ai

  No OpenAI API key found.

  Get one at https://platform.openai.com/api-keys    ← olive green
  ? Enter your API key: sk-████████████████

  Key saved to ~/.sapperai/auth.json                  ← dim

  Scanning 42 files...
```

---

## 키 우선순위

1. 환경변수 `OPENAI_API_KEY` (최우선)
2. `~/.sapperai/auth.json`
3. 없으면 인라인 프롬프트 (TTY일 때만)
4. non-TTY + 키 없음 → 에러 메시지 + exit 1

---

## auth.json 형식

**경로**: `~/.sapperai/auth.json`
**퍼미션**: `0o600` (소유자만 읽기/쓰기)

```json
{
  "openai": {
    "apiKey": "sk-...",
    "savedAt": "2026-02-15T10:30:00.000Z"
  }
}
```

---

## 구현 참고

### 파일 퍼미션

`atomicWriteFile()` (`packages/sapper-ai/src/utils/fs.ts:40-49`)은 현재 `mode` 옵션을 지원하지 않음. auth.json 전용으로 `fs.writeFile(path, content, { mode: 0o600 })`을 직접 사용하거나, `atomicWriteFile`에 mode 옵션을 추가할 것.

**Windows 참고**: `chmod 600`은 Windows에서 no-op. Windows 유저에게는 환경변수 사용을 권장.

### 키 입력 마스킹

두 가지 선택지:
- **A. `@inquirer/password` 추가** (권장): 기존 `@inquirer/select`와 일관성, 마스킹 1줄
- **B. `readline` raw mode**: 의존성 없음, 20-30줄 추가 코드

---

## Codex TODO List

- [ ] **auth 모듈 생성**
  - 파일: `packages/sapper-ai/src/auth.ts` (신규)
  - `getAuthPath()`: `~/.sapperai/auth.json` 경로 반환
  - `loadApiKey()`: env → auth.json 순으로 키 로드
  - `promptAndSaveApiKey()`: 인라인 프롬프트 → 저장 (mode 0o600)
  - 입력 시 마스킹 (앞 3자 + ████)

- [ ] **scan --ai에 auth 통합**
  - 파일: `packages/sapper-ai/src/scan.ts`
  - 기존 `OPENAI_API_KEY` 환경변수 체크 로직 (라인 540-544)을 `loadApiKey()`로 교체
  - 키 없으면 `promptAndSaveApiKey()` 호출 (TTY일 때만)
  - non-TTY + 키 없음 → 기존 에러 메시지 유지

- [ ] **auth 테스트 작성**
  - `loadApiKey()`: env 우선, auth.json fallback 확인
  - `promptAndSaveApiKey()`: 파일 생성 + 퍼미션 확인
  - mock으로 readline/inquirer 테스트
