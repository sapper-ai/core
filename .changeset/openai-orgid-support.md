---
"@sapper-ai/types": minor
"@sapper-ai/core": minor
"sapper-ai": minor
"@sapper-ai/web": patch
---

feat: add OpenAI organization ID and project ID support

Add `orgId` and `projectId` optional fields to `LlmConfig` for OpenAI organization and project scoping. When configured via `OPENAI_ORG_ID`/`OPENAI_PROJECT_ID` environment variables or `~/.sapperai/auth.json`, the `OpenAI-Organization` and `OpenAI-Project` headers are included in all OpenAI API requests.
