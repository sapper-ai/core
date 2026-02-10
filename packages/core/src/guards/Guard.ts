import type { AssessmentContext, Decision, Policy, ToolCall, ToolResult } from '@sapperai/types'

import { DecisionEngine } from '../engine/DecisionEngine'
import { AuditLogger } from '../logger/AuditLogger'

export class Guard {
  constructor(
    private readonly engine: DecisionEngine,
    private readonly auditLogger: AuditLogger,
    private readonly policy: Policy
  ) {}

  async preTool(toolCall: ToolCall): Promise<Decision> {
    const startTime = Date.now()

    const context: AssessmentContext = {
      kind: 'pre_tool_call',
      toolCall,
      policy: this.policy,
    }

    const decision = await this.engine.assess(context)

    this.auditLogger.log({
      timestamp: new Date().toISOString(),
      context,
      decision,
      durationMs: Date.now() - startTime,
    })

    return decision
  }

  async postTool(toolCall: ToolCall, toolResult: ToolResult): Promise<Decision> {
    const startTime = Date.now()

    const context: AssessmentContext = {
      kind: 'post_tool_result',
      toolCall,
      toolResult,
      policy: this.policy,
    }

    const decision = await this.engine.assess(context)

    this.auditLogger.log({
      timestamp: new Date().toISOString(),
      context,
      decision,
      durationMs: Date.now() - startTime,
    })

    return decision
  }
}
