# sapper-ai

## 0.8.2

### Patch Changes

- 59a258f: fix: detect symlinked binary name in isDirectExecution so global installs and npx work correctly

## 0.8.1

### Patch Changes

- 70a693c: Extract interactive prompt utility and unify TTY/CI checks with structured reason reporting

## 0.8.0

### Minor Changes

- ee7b5b0: Add Skill Guard: automatic security scanning for Claude Code skills and plugins. Includes `sapper-ai setup` for hook registration, `sapper-ai guard scan/check/dismiss/rescan/cache` commands, HMAC-verified scan cache, and TOCTOU defense.

## 0.7.0

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
  - @sapper-ai/core@0.3.0
  - @sapper-ai/types@0.3.0
  - @sapper-ai/mcp@0.3.2

## 0.6.2

### Patch Changes

- d3093a0: Remove the optional `@sapper-ai/openai` peer dependency and simplify the default web/demo surface by dropping OpenAI Agents-specific quickstart and playground paths. Also remove the legacy `sapper-ai dashboard` command path as part of monorepo cleanup.

## 0.6.1

### Patch Changes

- fix(cli): polish scan output and inline OpenAI API key onboarding for --ai mode
- Updated dependencies
  - @sapper-ai/mcp@0.3.1

## 0.6.0

### Minor Changes

- feat(cli): scan -> harden end-to-end UX (no-prompt, quarantine, MCP config helpers)

### Patch Changes

- Updated dependencies
  - @sapper-ai/mcp@0.3.0
  - @sapper-ai/core@0.2.2
  - @sapper-ai/openai@0.2.2

## 0.5.0

### Minor Changes

- 6319ab6: Auto-generate HTML report on every scan

  - Remove --report flag; HTML report is now always generated alongside JSON
  - Save both to ~/.sapperai/scans/{timestamp}.\*
  - Auto-open report in browser (suppress with --no-open)
  - --no-save skips both JSON and HTML

## 0.4.0

### Minor Changes

- 4a31990: Add interactive scan UX, AI deep scan, and HTML report

  - Arrow-key scan scope selection with @inquirer/select
  - --ai flag for 2-pass scan (rules + LLM via OpenAI gpt-4.1-mini)
  - --report flag for self-contained HTML report with dark/light theme, file tree, risk chart
  - Auto-save scan results as JSON to ~/.sapperai/scans/
  - --no-save flag to skip result persistence
  - Fix XSS in HTML report and command injection in browser open

## 0.3.0

### Minor Changes

- 649d9a2: Redesign scan CLI UX: interactive scope selection, progress bar, colored findings table

## 0.2.2

### Patch Changes

- Updated dependencies
  - @sapper-ai/core@0.2.1
  - @sapper-ai/types@0.2.1
  - @sapper-ai/mcp@0.2.1
  - @sapper-ai/openai@0.2.1

## 0.2.1

### Patch Changes

- feat: initial publish of sapper-ai wrapper package
