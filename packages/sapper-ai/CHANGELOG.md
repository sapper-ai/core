# sapper-ai

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
