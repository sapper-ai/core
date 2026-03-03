# @sapper-ai/web

## 0.1.3

### Patch Changes

- cbb1bc7: feat: add OpenAI organization ID and project ID support

  Add `orgId` and `projectId` optional fields to `LlmConfig` for OpenAI organization and project scoping. When configured via `OPENAI_ORG_ID`/`OPENAI_PROJECT_ID` environment variables or `~/.sapperai/auth.json`, the `OpenAI-Organization` and `OpenAI-Project` headers are included in all OpenAI API requests.

- Updated dependencies [cbb1bc7]
  - @sapper-ai/types@0.4.0
  - @sapper-ai/core@0.4.0

## 0.1.2

### Patch Changes

- Updated dependencies [96f1a4b]
  - @sapper-ai/core@0.3.0
  - @sapper-ai/types@0.3.0

## 0.1.1

### Patch Changes

- Updated dependencies
  - @sapper-ai/core@0.2.2
  - @sapper-ai/openai@0.2.2
