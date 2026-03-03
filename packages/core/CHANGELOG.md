# @sapper-ai/core

## 0.4.0

### Minor Changes

- cbb1bc7: feat: add OpenAI organization ID and project ID support

  Add `orgId` and `projectId` optional fields to `LlmConfig` for OpenAI organization and project scoping. When configured via `OPENAI_ORG_ID`/`OPENAI_PROJECT_ID` environment variables or `~/.sapperai/auth.json`, the `OpenAI-Organization` and `OpenAI-Project` headers are included in all OpenAI API requests.

### Patch Changes

- Updated dependencies [cbb1bc7]
  - @sapper-ai/types@0.4.0

## 0.3.0

### Minor Changes

- 96f1a4b: Add OpenClaw Skill Scanner with two-phase security analysis

  - New types: SkillMetadata, Honeytoken, HoneytokenFinding, SkillScanResult
  - New SkillParser with YAML size limits and frontmatter validation
  - Static scanning via RulesDetector-based prompt injection detection
  - Dynamic scanning via Docker sandbox + mitmproxy honeytoken exfiltration detection
  - CLI `sapper-ai openclaw` subcommand with interactive wizard
  - Security hardening: YAML bomb defense, error path sanitization, false positive separation

### Patch Changes

- Updated dependencies [96f1a4b]
  - @sapper-ai/types@0.3.0

## 0.2.2

### Patch Changes

- fix(core): safer quarantine restore (refuse overwrite unless forced) + export policy resolver

## 0.2.1

### Patch Changes

- fix: publish post-0.2.0 changes including DetectorFactory, threat-intel, Korean detection
- Updated dependencies
  - @sapper-ai/types@0.2.1

## 0.2.0

### Minor Changes

- Initial public release of SapperAI security framework.

  - Rules-based threat detection engine with 60+ patterns
  - MCP security proxy for wrapping any MCP server
  - OpenAI Agents SDK guardrails integration
  - 96% detection rate with zero false positives

### Patch Changes

- Updated dependencies
  - @sapper-ai/types@0.2.0
