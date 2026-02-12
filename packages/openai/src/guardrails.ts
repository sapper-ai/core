import { AuditLogger, createDetectors, DecisionEngine, Guard } from '@sapper-ai/core'
import type { ThreatIntelEntry } from '@sapper-ai/core'
import type { AuditLogEntry, Policy, ToolCall, ToolResult } from '@sapper-ai/types'

interface GuardrailOptions {
  logger?: { log: (entry: AuditLogEntry) => void }
  threatIntelEntries?: ThreatIntelEntry[]
}

/**
 * Create a tool input guardrail that integrates SapperAI Guard with OpenAI Agents SDK.
 * The guardrail intercepts tool calls before execution and blocks malicious inputs.
 *
 * @param policy - Security policy configuration
 * @param options - Optional guardrail options (logger, threatIntelEntries)
 * @returns Guardrail handler function for testing and integration
 */
export function createToolInputGuardrail(policy: Policy, options?: GuardrailOptions) {
  const detectors = createDetectors({
    policy,
    threatIntelEntries: options?.threatIntelEntries,
  })
  const auditLogger = options?.logger
    ? ({ log: options.logger.log } as unknown as AuditLogger)
    : new AuditLogger()
  const decisionEngine = new DecisionEngine(detectors)
  const guard = new Guard(decisionEngine, auditLogger, policy)

  return async (toolCall: unknown) => {
    const decision = await guard.preTool(toolCall as ToolCall)

    if (decision.action === 'block') {
      const reason = decision.evidence[0]?.reasons[0] || 'Security policy violation'
      throw new Error(`Tool call blocked: ${reason}`)
    }
  }
}

/**
 * Create a tool output guardrail that integrates SapperAI Guard with OpenAI Agents SDK.
 * The guardrail intercepts tool results after execution and blocks malicious outputs.
 *
 * @param policy - Security policy configuration
 * @param options - Optional guardrail options (logger, threatIntelEntries)
 * @returns Guardrail handler function for testing and integration
 */
export function createToolOutputGuardrail(policy: Policy, options?: GuardrailOptions) {
  const detectors = createDetectors({
    policy,
    threatIntelEntries: options?.threatIntelEntries,
  })
  const auditLogger = options?.logger
    ? ({ log: options.logger.log } as unknown as AuditLogger)
    : new AuditLogger()
  const decisionEngine = new DecisionEngine(detectors)
  const guard = new Guard(decisionEngine, auditLogger, policy)

  return async (toolCall: unknown, toolResult: unknown) => {
    const decision = await guard.postTool(toolCall as ToolCall, toolResult as ToolResult)

    if (decision.action === 'block') {
      const reason = decision.evidence[0]?.reasons[0] || 'Tool result blocked'
      throw new Error(`Tool result blocked: ${reason}`)
    }
  }
}
