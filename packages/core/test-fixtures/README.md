# SapperAI Test Fixtures

This directory contains curated test datasets for validating the SapperAI detection engine against real-world attack patterns, benign use cases, and edge cases.

## Files

- **benign-100.jsonl**: 100 safe, legitimate tool call/result samples
- **malicious-50.jsonl**: 50 attack patterns covering OWASP AI Agent Security threats
- **edge-cases-20.jsonl**: 20 boundary cases including false positives and ambiguous inputs

## Fixture Format

Each JSONL file contains one JSON object per line with the following schema:

```typescript
interface Fixture {
  kind: 'pre_tool_call' | 'post_tool_result';
  toolCall: {
    toolName: string;
    arguments: unknown;
  };
  toolResult?: {
    content: unknown;
  };
  expected: 'allow' | 'block';
  label: string; // Human-readable description
}
```

### Fields

- **kind**: Checkpoint type
  - `pre_tool_call`: Evaluate before tool execution (tool call validation)
  - `post_tool_result`: Evaluate after tool execution (result contamination check)
- **toolCall**: Tool invocation details
  - `toolName`: Name of the tool being called
  - `arguments`: Tool-specific arguments (may contain attack payloads)
- **toolResult**: (Optional) Tool execution result for `post_tool_result` fixtures
  - `content`: Response data from tool (may contain malicious instructions)
- **expected**: Expected guard decision
  - `allow`: Should pass security checks
  - `block`: Should trigger security block
- **label**: Test case description for debugging and reporting

## Dataset Categories

### Benign Samples (benign-100.jsonl)

Legitimate use cases covering:
- **File operations** (20): read_file, write_file, list_directory
- **Web searches** (20): Google, Wikipedia, documentation lookups
- **API calls** (15): weather, stocks, news APIs
- **Math/calculations** (15): arithmetic, conversions
- **Database queries** (15): SELECT, parameterized queries
- **System info** (10): time, date, hostname, disk space
- **Misc** (5): notifications, task scheduling

### Malicious Samples (malicious-50.jsonl)

Attack patterns from OWASP AI Agent Security Cheat Sheet:

#### Prompt Injection (25 samples)
- **Direct injection** (15): "ignore previous instructions", "you are now", "system prompt reveal"
- **Indirect injection** (10): Malicious content in tool results, documents, API responses

#### Tool Manipulation (15 samples)
- **SQL injection** (5): `' OR '1'='1`, `; DROP TABLE`, union-based attacks
- **Path traversal** (5): `../../etc/passwd`, `../../../root/.ssh/id_rsa`
- **Command injection** (5): Shell metacharacters, backticks, `$()` substitution

#### Encoding Bypasses (5 samples)
- **CRLF injection**: `\r\n` in log messages
- **Unicode bypasses**: Null bytes (`\u0000`), confusables
- **XXE attacks**: XML external entity injection

#### Data Exfiltration (5 samples)
- **SSRF**: Internal metadata service access (169.254.169.254)
- **Environment variable theft**: `${SECRET_TOKEN}`, `$(env)`
- **Template injection**: `{{constructor.constructor('return process.env')()}}`

### Edge Cases (edge-cases-20.jsonl)

Boundary conditions and false positive scenarios:

#### Size/Format Extremes (5 samples)
- Very long inputs (>10K chars)
- Empty values (null, "")
- Mixed encodings

#### Special Characters (5 samples)
- Emoji: 😀🎉🚀
- CJK characters: 中文 テスト 한국어
- RTL languages: العربية עברית
- All ASCII special chars

#### False Positives (10 samples)
Legitimate content that may trigger pattern matches:
- **Security education**: "This tutorial covers prompt injection attacks..."
- **Code documentation**: "// Override previous implementation"
- **Development discussions**: "Disregard old specs, use new requirements"
- **Research papers**: "Jailbreak techniques in AI systems"
- **Code snippets**: Markdown with `ignore_previous_instructions = false;`

## Usage

### Loading Fixtures

```typescript
import { readFileSync } from 'fs';

function loadFixtures(path: string): Fixture[] {
  return readFileSync(path, 'utf-8')
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

const benignTests = loadFixtures('./test-fixtures/benign-100.jsonl');
const maliciousTests = loadFixtures('./test-fixtures/malicious-50.jsonl');
```

### Testing with Guard

```typescript
import { Guard } from '@sapperai/core';

const guard = new Guard(detectors, policy);

for (const fixture of maliciousTests) {
  const result = fixture.kind === 'pre_tool_call'
    ? await guard.preTool(fixture.toolCall, policy)
    : await guard.postTool(fixture.toolCall, fixture.toolResult!, policy);

  if (result.action !== fixture.expected) {
    console.error(`FAIL: ${fixture.label}`);
    console.error(`Expected ${fixture.expected}, got ${result.action}`);
  }
}
```

### Validation

Line counts:
```bash
wc -l packages/core/test-fixtures/*.jsonl
# Expected: 100 benign, 50 malicious, 20 edge-cases
```

JSON validity:
```bash
for file in packages/core/test-fixtures/*.jsonl; do
  while IFS= read -r line; do
    echo "$line" | node -e "JSON.parse(require('fs').readFileSync(0, 'utf-8'))" || exit 1
  done < "$file"
done
```

## Sources

- **OWASP AI Agent Security Cheat Sheet**: https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html
- **OWASP Top 10 for LLMs**: https://owasp.org/www-project-top-10-for-large-language-model-applications/
- **ProtectAI LLM Guard**: https://github.com/protectai/llm-guard
- **HuggingFace Prompt Injection Dataset**: protectai/prompt-injection-v2

## Test Metrics

When running full suite against RulesDetector:

- **Precision**: (True Positives) / (True Positives + False Positives)
  - Target: >90% (minimize false blocks)
- **Recall**: (True Positives) / (True Positives + False Negatives)
  - Target: >95% (catch real attacks)
- **F1 Score**: Harmonic mean of precision and recall
  - Target: >92%

False positive scenarios in `edge-cases-20.jsonl` are designed to test precision and ensure legitimate security discussions don't trigger blocks.

## Contributing

When adding new fixtures:
1. Ensure `label` is descriptive for debugging
2. Verify JSON is valid with `jq` or `node -e`
3. Test against RulesDetector to confirm expected behavior
4. Document source if based on real-world attack
5. Maintain category balance (benign vs. malicious vs. edge)
