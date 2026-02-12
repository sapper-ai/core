# /sapperai-status

SapperAI 플러그인 상태를 점검합니다.

1. 플러그인 파일 존재 여부 확인
2. 훅 실행 권한 확인
3. `@sapper-ai/core` 빌드 산출물 존재 여부 확인
4. OpenAI LLM 2차 분석 활성화 여부(`OPENAI_API_KEY`) 확인

아래 순서대로 실행하세요:

```bash
ls -la .claude/plugins/sapperai
ls -la .claude/plugins/sapperai/hooks
test -x .claude/plugins/sapperai/hooks/pre-tool-use.sh && echo "pre-hook: executable" || echo "pre-hook: not executable"
test -x .claude/plugins/sapperai/hooks/post-tool-use.sh && echo "post-hook: executable" || echo "post-hook: not executable"
test -f packages/core/dist/index.js && echo "core dist: ready" || echo "core dist: missing"
if [ -n "${OPENAI_API_KEY:-}" ]; then echo "llm detector: enabled"; else echo "llm detector: disabled (rules-only)"; fi
```
