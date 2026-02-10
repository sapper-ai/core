import { AuditLogger, DecisionEngine, Guard, LlmDetector, RulesDetector } from '@sapperai/core'
import type { AuditLogEntry, Detector, Policy, ToolCall, ToolResult } from '@sapperai/types'
import { defineToolInputGuardrail, defineToolOutputGuardrail } from '@openai/agents'

/**
 * Create a tool input guardrail that integrates SapperAI Guard with OpenAI Agents SDK.
 * The guardrail intercepts tool calls before execution and blocks malicious inputs.
 *
 * @param policy - Security policy configuration
 * @param logger - Optional audit logger for decision tracking
 * @returns Guardrail handler function for testing and integration
 */
export function createToolInputGuardrail(policy: Policy, logger?: { log: (entry: AuditLogEntry) => void }) {
  const handler = async (toolCall: unknown) => {
    const detectors: Detector[] = [new RulesDetector()]
    if (policy.llm) {
      detectors.push(new LlmDetector(policy.llm))
    }

    const auditLogger = logger ? { log: logger.log } as unknown as AuditLogger : new AuditLogger()
    const decisionEngine = new DecisionEngine(detectors)
    const guard = new Guard(decisionEngine, auditLogger, policy)

    const decision = await guard.preTool(toolCall as ToolCall)

    if (decision.action === 'block') {
      const reason = decision.evidence[0]?.reasons[0] || 'Security policy violation'
      throw new Error(`Tool call blocked: ${reason}`)
    }
  }

  return handler
}

/**
 * Create a tool output guardrail that integrates SapperAI Guard with OpenAI Agents SDK.
 * The guardrail intercepts tool results after execution and blocks malicious outputs.
 *
 * @param policy - Security policy configuration
 * @param logger - Optional audit logger for decision tracking
 * @returns Guardrail handler function for testing and integration
 */
export function createToolOutputGuardrail(policy: Policy, logger?: { log: (entry: AuditLogEntry) => void }) {
  const handler = async (toolCall: unknown, toolResult: unknown) => {
    const detectors: Detector[] = [new RulesDetector()]
    if (policy.llm) {
      detectors.push(new LlmDetector(policy.llm))
    }

    const auditLogger = logger ? { log: logger.log } as unknown as AuditLogger : new AuditLogger()
    const decisionEngine = new DecisionEngine(detectors)
    const guard = new Guard(decisionEngine, auditLogger, policy)

    const decision = await guard.postTool(toolCall as ToolCall, toolResult as ToolResult)

    if (decision.action === 'block') {
      const reason = decision.evidence[0]?.reasons[0] || 'Tool result blocked'
      throw new Error(`Tool result blocked: ${reason}`)
    }
  }

  return handler
}
