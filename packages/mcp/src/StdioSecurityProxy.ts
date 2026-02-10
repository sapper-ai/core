import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { ReadBuffer, serializeMessage } from '@modelcontextprotocol/sdk/shared/stdio.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  AuditLogger,
  DecisionEngine,
  Guard,
  LlmDetector,
  PolicyManager,
  RulesDetector,
  Scanner,
} from '@sapperai/core'
import type {
  AssessmentContext,
  AuditLogEntry,
  Decision,
  Detector,
  Policy,
  ToolCall,
  ToolResult,
} from '@sapperai/types'

type JsonRpcId = string | number | null

interface JsonRpcRequestMessage {
  jsonrpc?: '2.0'
  id?: JsonRpcId
  method: string
  params?: unknown
}

interface JsonRpcResponseMessage {
  jsonrpc?: '2.0'
  id: JsonRpcId
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

type JsonRpcMessage = JsonRpcRequestMessage | JsonRpcResponseMessage

interface ProxyTransport {
  onclose?: () => void
  onerror?: (error: Error) => void
  onmessage?: (...args: any[]) => void
  start(): Promise<void>
  close(): Promise<void>
  send(message: unknown, options?: unknown): Promise<void>
}

interface ExtendedPolicy extends Policy {
  detectors?: string[]
}

type GuardKind = 'pre_tool_call' | 'post_tool_result'

type AuditLoggerLike = Pick<AuditLogger, 'log'>

interface StdioSecurityProxyOptions {
  policy: Policy
  upstreamCommand?: string
  upstreamArgs?: string[]
  upstreamCwd?: string
  upstreamEnv?: Record<string, string>
  downstreamTransport?: ProxyTransport
  upstreamTransport?: ProxyTransport
  detectors?: Detector[]
  policyManager?: PolicyManager
  scanner?: Scanner
  auditLogger?: AuditLoggerLike
}

const BLOCKED_ERROR_CODE = -32010

export class StdioSecurityProxy {
  private readonly policy: Policy
  private readonly downstreamTransport: ProxyTransport
  private readonly upstreamTransport: ProxyTransport
  private readonly policyManager: PolicyManager
  private readonly scanner: Scanner
  private readonly auditLogger: AuditLoggerLike
  private readonly detectors?: Detector[]

  private readonly pendingToolCalls = new Map<string, ToolCall>()
  private readonly pendingToolLists = new Set<string>()

  private started = false
  private closed = false

  constructor(options: StdioSecurityProxyOptions) {
    this.policy = options.policy
    this.policyManager = options.policyManager ?? new PolicyManager()
    this.scanner = options.scanner ?? new Scanner()
    this.detectors = options.detectors

    this.auditLogger =
      options.auditLogger ?? new AuditLogger({ filePath: process.env.SAPPERAI_AUDIT_LOG_PATH ?? '/tmp/sapperai-proxy.audit.log' })

    this.downstreamTransport = options.downstreamTransport ?? new StdioServerTransport()
    this.upstreamTransport =
      options.upstreamTransport ??
      this.createUpstreamTransport(options.upstreamCommand, options.upstreamArgs, options.upstreamEnv, options.upstreamCwd)
  }

  async start(): Promise<void> {
    if (this.started) {
      throw new Error('StdioSecurityProxy already started')
    }

    this.started = true

    this.downstreamTransport.onmessage = (message) => {
      void this.handleDownstreamMessage(message as JsonRpcMessage)
    }
    this.downstreamTransport.onerror = (error) => {
      this.upstreamTransport.onerror?.(error)
    }

    this.upstreamTransport.onmessage = (message) => {
      void this.handleUpstreamMessage(message as JsonRpcMessage)
    }
    this.upstreamTransport.onerror = (error) => {
      this.downstreamTransport.onerror?.(error)
    }

    await Promise.all([this.downstreamTransport.start(), this.upstreamTransport.start()])
  }

  async close(): Promise<void> {
    if (this.closed) {
      return
    }

    this.closed = true
    await Promise.allSettled([this.downstreamTransport.close(), this.upstreamTransport.close()])
  }

  private createUpstreamTransport(
    command?: string,
    args: string[] = [],
    env?: Record<string, string>,
    cwd?: string
  ): ProxyTransport {
    if (!command) {
      throw new Error('upstreamCommand is required when upstreamTransport is not provided')
    }

    return new StdioClientTransport({
      command,
      args,
      env,
      cwd,
    }) as unknown as ProxyTransport
  }

  private async handleDownstreamMessage(message: JsonRpcMessage): Promise<void> {
    try {
      if (!this.isRequestMessage(message)) {
        await this.forwardToUpstream(message)
        return
      }

      if (message.method === 'tools/list' && message.id !== undefined) {
        this.pendingToolLists.add(this.toRequestKey(message.id))
        await this.forwardToUpstream(message)
        return
      }

      if (message.method !== 'tools/call') {
        await this.forwardToUpstream(message)
        return
      }

      const toolCall = this.toToolCall(message)
      if (!toolCall || message.id === undefined) {
        await this.forwardToUpstream(message)
        return
      }

      const preDecision = await this.runGuard('pre_tool_call', toolCall)
      if (preDecision.action === 'block') {
        await this.forwardToDownstream(this.createBlockedResponse(message.id, 'pre_tool_call', preDecision.reasons))
        return
      }

      this.pendingToolCalls.set(this.toRequestKey(message.id), toolCall)
      await this.forwardToUpstream(message)
    } catch (error) {
      this.downstreamTransport.onerror?.(this.ensureError(error))
    }
  }

  private async handleUpstreamMessage(message: JsonRpcMessage): Promise<void> {
    try {
      if (!this.isResponseMessage(message)) {
        await this.forwardToDownstream(message)
        return
      }

      const requestKey = this.toRequestKey(message.id)

      if (this.pendingToolLists.has(requestKey)) {
        this.pendingToolLists.delete(requestKey)
        const intercepted = await this.interceptToolsListResponse(message)
        await this.forwardToDownstream(intercepted)
        return
      }

      const toolCall = this.pendingToolCalls.get(requestKey)
      if (!toolCall) {
        await this.forwardToDownstream(message)
        return
      }

      this.pendingToolCalls.delete(requestKey)

      const intercepted = await this.interceptToolCallResponse(message, toolCall)
      await this.forwardToDownstream(intercepted)
    } catch (error) {
      this.downstreamTransport.onerror?.(this.ensureError(error))
    }
  }

  private async interceptToolsListResponse(message: JsonRpcResponseMessage): Promise<JsonRpcResponseMessage> {
    if (message.error || !this.isRecord(message.result)) {
      return message
    }

    const tools = Array.isArray(message.result.tools) ? message.result.tools : null
    if (!tools) {
      return message
    }

    const nextTools: unknown[] = []
    for (const rawTool of tools) {
      if (!this.isRecord(rawTool) || typeof rawTool.name !== 'string') {
        nextTools.push(rawTool)
        continue
      }

      const toolName = rawTool.name
      const description = typeof rawTool.description === 'string' ? rawTool.description : ''
      const policy = this.resolvePolicy(toolName)
      const decision = await this.scanToolDescription(toolName, description, policy)

      if (decision.action === 'block' && policy.mode === 'enforce') {
        continue
      }

      if (decision.action === 'block') {
        nextTools.push({
          ...rawTool,
          description: this.addRiskMarker(description, decision),
        })
        continue
      }

      nextTools.push(rawTool)
    }

    return {
      ...message,
      result: {
        ...message.result,
        tools: nextTools,
      },
    }
  }

  private async interceptToolCallResponse(
    message: JsonRpcResponseMessage,
    toolCall: ToolCall
  ): Promise<JsonRpcResponseMessage> {
    if (message.error) {
      return message
    }

    const toolResult = this.toToolResult(message.result)
    const postDecision = await this.runGuard('post_tool_result', toolCall, toolResult)

    if (postDecision.action === 'block') {
      return this.createBlockedResponse(message.id, 'post_tool_result', postDecision.reasons)
    }

    return message
  }

  private async runGuard(kind: GuardKind, toolCall: ToolCall, toolResult?: ToolResult): Promise<Decision> {
    const policy = this.resolvePolicy(toolCall.toolName)
    const detectors = this.resolveDetectors(policy)
    const guard = new Guard(
      new DecisionEngine(detectors),
      this.auditLogger as unknown as AuditLogger,
      policy
    )

    try {
      if (kind === 'pre_tool_call') {
        return await guard.preTool(toolCall)
      }

      if (!toolResult) {
        throw new Error('toolResult is required for post_tool_result guard check')
      }

      return await guard.postTool(toolCall, toolResult)
    } catch (error) {
      if (!policy.failOpen) {
        throw error
      }

      const decision = this.createFailOpenDecision(this.ensureError(error), `Proxy guard ${kind} error`)
      this.logAuditEntry({
        kind,
        toolCall,
        toolResult,
        policy,
      } as AssessmentContext,
      decision)

      return decision
    }
  }

  private async scanToolDescription(toolName: string, description: string, policy: Policy): Promise<Decision> {
    const detectors = this.resolveDetectors(policy)
    const scanContext = {
      kind: 'install_scan',
      policy,
      meta: {
        toolName,
        scanText: description,
      },
    } as AssessmentContext

    try {
      const decision = await this.scanner.scanTool(toolName, description, policy, detectors)
      this.logAuditEntry(scanContext, decision)
      return decision
    } catch (error) {
      if (!policy.failOpen) {
        throw error
      }

      const decision = this.createFailOpenDecision(this.ensureError(error), 'Proxy install_scan error')
      this.logAuditEntry(scanContext, decision)
      return decision
    }
  }

  private resolveDetectors(policy: Policy): Detector[] {
    if (this.detectors) {
      return this.detectors
    }

    const detectorNames = (policy as ExtendedPolicy).detectors ?? ['rules']
    const detectors: Detector[] = []

    for (const detectorName of detectorNames) {
      if (detectorName === 'rules') {
        detectors.push(new RulesDetector())
      }

      if (detectorName === 'llm') {
        detectors.push(new LlmDetector(policy.llm))
      }
    }

    if (detectors.length === 0) {
      detectors.push(new RulesDetector())
    }

    return detectors
  }

  private resolvePolicy(toolName: string): Policy {
    return this.policyManager.resolvePolicy(toolName, this.policy)
  }

  private toToolCall(message: JsonRpcRequestMessage): ToolCall | null {
    if (!this.isRecord(message.params)) {
      return null
    }

    if (typeof message.params.name !== 'string') {
      return null
    }

    return {
      toolName: message.params.name,
      arguments: message.params.arguments ?? {},
    }
  }

  private toToolResult(rawResult: unknown): ToolResult {
    if (this.isRecord(rawResult)) {
      return {
        content: rawResult.content ?? rawResult,
        meta: rawResult,
      }
    }

    return {
      content: rawResult,
    }
  }

  private createBlockedResponse(id: JsonRpcId, phase: GuardKind, reasons: string[]): JsonRpcResponseMessage {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: BLOCKED_ERROR_CODE,
        message: `Blocked by SapperAI (${phase})`,
        data: {
          phase,
          reasons,
        },
      },
    }
  }

  private addRiskMarker(description: string, decision: Decision): string {
    const reasons = decision.reasons.slice(0, 3).join('; ')
    return `${description}\n[SapperAI flagged risk=${decision.risk.toFixed(2)} confidence=${decision.confidence.toFixed(2)} reasons=${reasons}]`
  }

  private createFailOpenDecision(error: Error, source: string): Decision {
    return {
      action: 'allow',
      risk: 0,
      confidence: 0,
      reasons: [`${source}: ${error.message}`],
      evidence: [],
    }
  }

  private logAuditEntry(context: AssessmentContext, decision: Decision): void {
    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      context,
      decision,
      durationMs: 0,
    }

    this.auditLogger.log(entry)
  }

  private async forwardToUpstream(message: JsonRpcMessage): Promise<void> {
    await this.upstreamTransport.send(this.normalizeMessage(message))
  }

  private async forwardToDownstream(message: JsonRpcMessage): Promise<void> {
    await this.downstreamTransport.send(this.normalizeMessage(message))
  }

  private normalizeMessage(message: JsonRpcMessage): JsonRpcMessage {
    const readBuffer = new ReadBuffer()
    readBuffer.append(Buffer.from(serializeMessage(message as never), 'utf8'))
    return (readBuffer.readMessage() ?? message) as JsonRpcMessage
  }

  private toRequestKey(id: JsonRpcId): string {
    return JSON.stringify(id)
  }

  private isRequestMessage(message: JsonRpcMessage): message is JsonRpcRequestMessage {
    return this.isRecord(message) && typeof message.method === 'string'
  }

  private isResponseMessage(message: JsonRpcMessage): message is JsonRpcResponseMessage {
    return this.isRecord(message) && 'id' in message && !('method' in message)
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
  }

  private ensureError(error: unknown): Error {
    if (error instanceof Error) {
      return error
    }

    return new Error(String(error))
  }
}
