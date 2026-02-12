#!/usr/bin/env bash
set -euo pipefail

INPUT_JSON="$(cat)"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

HOOK_OUTPUT="$(
  HOOK_INPUT="$INPUT_JSON" REPO_ROOT="$REPO_ROOT" node <<'NODE'
const path = require('node:path')

async function main() {
  const payload = JSON.parse(process.env.HOOK_INPUT || '{}')
  const repoRoot = process.env.REPO_ROOT

  const core = require(path.join(repoRoot, 'packages/core/dist/index.js'))
  const { AuditLogger, DecisionEngine, Guard, PolicyManager, RulesDetector, LlmDetector } = core

  const openAiApiKey = (process.env.OPENAI_API_KEY || '').trim()
  const policyRaw = {
    mode: 'enforce',
    defaultAction: 'allow',
    failOpen: true,
    detectors: openAiApiKey ? ['rules', 'llm'] : ['rules'],
    thresholds: {
      riskThreshold: 0.7,
      blockMinConfidence: 0.65,
    },
    ...(openAiApiKey
      ? {
          llm: {
            provider: 'openai',
            apiKey: openAiApiKey,
            model: 'gpt-4.1-mini',
          },
        }
      : {}),
  }

  const policy = new PolicyManager().loadFromObject(policyRaw)
  const detectors = [new RulesDetector()]
  if (openAiApiKey) {
    detectors.push(new LlmDetector(policy.llm))
  }

  const guard = new Guard(new DecisionEngine(detectors), new AuditLogger(), policy)

  const toolName = typeof payload.tool_name === 'string' ? payload.tool_name : typeof payload.toolName === 'string' ? payload.toolName : 'unknown'
  const toolInput = payload.tool_input ?? payload.toolInput ?? {}
  const toolResult = payload.tool_output ?? payload.toolOutput ?? payload.result ?? payload.response ?? {}

  const decision = await guard.postTool(
    {
      toolName,
      arguments: toolInput,
      meta: {
        hookEventName: 'PostToolUse',
        sessionId: payload.session_id ?? payload.sessionId,
      },
    },
    {
      content: toolResult,
      meta: {
        hookEventName: 'PostToolUse',
      },
    }
  )

  const severity = decision.action === 'block' ? 'warning' : 'info'
  const reason = decision.reasons[0] || 'No policy reason'

  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        severity,
        message: `SapperAI post-check ${decision.action.toUpperCase()}: ${reason}`,
      },
    })
  )
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        severity: 'info',
        message: `SapperAI post-check fallback: ${message}`,
      },
    })
  )
})
NODE
)"

printf '%s\n' "$HOOK_OUTPUT"
