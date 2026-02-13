# README Installation Command Simplification

## Goal

Simplify installation commands in root README to use only `npm install` and `pnpm install`, removing `pnpm add` and redundant sections.

## Decisions

- **Commands**: `pnpm add` → `npm install` / `pnpm install` (parallel display with `# or`)
- **Scope**: Root `README.md` only (sub-package READMEs unchanged)
- **Installation section**: Remove "Individual packages" block (redundant with Quick Start)

## TODO List

### 1. Update Quick Start - Option 1 (line 20-23)

**File**: `README.md`

**Before**:
```bash
pnpm add sapper-ai
npx sapper-ai init
```

**After**:
```bash
npm install sapper-ai
# or
pnpm install sapper-ai

npx sapper-ai init
```

### 2. Update Quick Start - Option 2 (line 34-36)

**File**: `README.md`

**Before**:
```bash
pnpm add @sapper-ai/mcp
```

**After**:
```bash
npm install @sapper-ai/mcp
# or
pnpm install @sapper-ai/mcp
```

### 3. Update Quick Start - Option 3 (line 50-52)

**File**: `README.md`

**Before**:
```bash
pnpm add @sapper-ai/openai
```

**After**:
```bash
npm install @sapper-ai/openai
# or
pnpm install @sapper-ai/openai
```

### 4. Remove "Individual packages" from Installation section (line 172-175)

**File**: `README.md`

**Before**:
```bash
# Full monorepo (for development)
git clone https://github.com/sapper-ai/sapperai.git
cd sapperai
pnpm install
pnpm build

# Individual packages (for usage)
pnpm add @sapper-ai/core
pnpm add @sapper-ai/mcp
pnpm add @sapper-ai/openai
```

**After**:
```bash
# Full monorepo (for development)
git clone https://github.com/sapper-ai/sapperai.git
cd sapperai
pnpm install
pnpm build
```

## Not Changed

- Sub-package READMEs (`packages/*/README.md`) — keep `pnpm add` as-is
- `npx sapper-ai init` — unchanged (package manager agnostic)
- All code examples — unchanged

## Verification

- [ ] `pnpm add` does not appear in root README
- [ ] All 3 Quick Start options show `npm install` / `# or` / `pnpm install`
- [ ] Installation section only contains monorepo clone instructions
- [ ] No other content modified
