# Zero-Config Scan UX: postinstall + `sapper-ai scan`

## Goal

Make `pnpm install sapper-ai` the only step needed to start using SapperAI. After install, a postinstall message guides the user to run `npx sapper-ai scan` for a one-shot environment security scan.

## User Flow

```
$ pnpm install sapper-ai

  SapperAI installed. Run 'npx sapper-ai scan' to check your environment.

$ npx sapper-ai scan

  SapperAI Environment Scan

  Scanning:
    ~/.claude/plugins
    ~/.config/claude-code
    ./

  Results:
    ✓ 12 files scanned, 2 threats detected

    1. ~/.claude/plugins/sketchy-plugin/index.js
       Risk: 0.92 | command_injection

    2. ~/.config/claude-code/mcp.json
       Risk: 0.85 | suspicious_url

  Run 'npx sapper-ai scan --fix' to quarantine blocked files.
```

## Architecture

```
sapper-ai scan
  ├── fs.readdir (recursive) on target directories
  ├── isConfigLikeFile() filter          ← @sapper-ai/core (already dependency)
  ├── readFile → normalizeSurfaceText()  ← @sapper-ai/core
  ├── Scanner.scanTool() per file        ← @sapper-ai/core
  └── Terminal report + exit code
```

No new dependencies required. All scan logic comes from `@sapper-ai/core`.

## Decisions

- **Trigger**: postinstall prints guidance message only (no interactive prompt)
- **Command**: `npx sapper-ai scan` (new CLI subcommand)
- **Default targets**: `~/.claude/plugins`, `~/.config/claude-code`, CWD (same as FileWatcher defaults)
- **Policy**: standard preset (enforce, rules-only, failOpen: true) unless `sapperai.config.yaml` exists
- **Exit code**: 0 = clean, 1 = threats detected (CI-friendly)
- **`--fix` flag**: quarantine blocked files using existing QuarantineManager

## TODO List

### 1. Create postinstall script

**File**: `packages/sapper-ai/src/postinstall.ts`

- Print single line: `SapperAI installed. Run 'npx sapper-ai scan' to check your environment.`
- No interactive prompts, no scanning, no side effects
- Wrap in try/catch so it never fails the install

### 2. Add postinstall script to package.json

**File**: `packages/sapper-ai/package.json`

Add to `"scripts"`:
```json
"postinstall": "node dist/postinstall.js"
```

### 3. Create scan command module

**File**: `packages/sapper-ai/src/scan.ts`

Implement `runScan(options)` function:

- **Input**: `{ targets: string[], fix: boolean }`
- **Default targets**: `~/.claude/plugins`, `~/.config/claude-code`, `process.cwd()`
- **Logic**:
  1. Resolve policy: load `sapperai.config.yaml` if exists, else standard preset
  2. For each target directory, recursively collect files
  3. Filter with `isConfigLikeFile()` from `@sapper-ai/core`
  4. For each file: `readFile` → `normalizeSurfaceText()` → `Scanner.scanTool()`
  5. Collect results (path, decision, risk, reasons)
  6. If `--fix` and decision is block: `QuarantineManager.quarantine()`
- **Output**: Print formatted report to stdout
- **Return**: exit code (0 = clean, 1 = threats found)

Reuse from `@sapper-ai/core`:
- `Scanner`, `RulesDetector`, `DecisionEngine`, `createDetectors`
- `isConfigLikeFile`, `normalizeSurfaceText`, `buildEntryName`, `classifyTargetType`
- `QuarantineManager` (for `--fix`)
- `PolicyManager` (for config file loading)

### 4. Add scan subcommand to CLI

**File**: `packages/sapper-ai/src/cli.ts`

- Add `scan` case to `runCli()` function (alongside existing `init`, `dashboard`)
- Parse `--fix` flag from argv
- Parse optional path arguments: `npx sapper-ai scan [paths...]`
- Call `runScan()` from scan module
- Update `printUsage()` to include scan command

### 5. Add tests for scan command

**File**: `packages/sapper-ai/src/__tests__/scan.test.ts`

- Test: scans directory and finds threats in malicious fixture
- Test: clean directory returns exit code 0
- Test: `--fix` flag triggers quarantine
- Test: missing directories are skipped gracefully
- Test: respects `sapperai.config.yaml` if present

### 6. Add tests for postinstall

**File**: `packages/sapper-ai/src/__tests__/postinstall.test.ts`

- Test: outputs guidance message
- Test: never throws (wrapped in try/catch)

### 7. Update printUsage in CLI

**File**: `packages/sapper-ai/src/cli.ts`

Update help text:
```
sapper-ai - AI security guardrails

Usage:
  sapper-ai scan          Scan environment for threats
  sapper-ai scan --fix    Scan and quarantine blocked files
  sapper-ai init          Interactive setup wizard
  sapper-ai dashboard     Launch web dashboard
  sapper-ai --help        Show this help
```

Note: `scan` is listed first as the primary command.

## Not Changed

- `@sapper-ai/mcp` — FileWatcher stays as-is for long-running watch mode
- `sapper-ai init` — wizard preserved
- `sapper-ai dashboard` — preserved
- Sub-package READMEs — unchanged

## Verification

- [ ] `pnpm install sapper-ai` prints postinstall guidance message
- [ ] `npx sapper-ai scan` scans default directories and prints report
- [ ] `npx sapper-ai scan --fix` quarantines blocked files
- [ ] `npx sapper-ai scan /custom/path` scans specified path
- [ ] Exit code 0 when clean, 1 when threats detected
- [ ] Existing tests still pass (`pnpm test`)
- [ ] postinstall never fails the install (try/catch wrapped)
