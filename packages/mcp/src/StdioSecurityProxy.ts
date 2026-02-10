import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { ReadBuffer, serializeMessage } from '@modelcontextprotocol/sdk/shared/stdio.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  AuditLogger,
  buildMatchListFromIntel,
  DecisionEngine,
  evaluatePolicyMatch,
  Guard,
  LlmDetector,
  PolicyManager,
  RulesDetector,
  Scanner,
  ThreatIntelDetector,
  ThreatIntelStore,
} from '@sapper-ai/core'
import type {
  AssessmentContext,
  AuditLogEntry,
  Decision,
  Detector,
  Policy,
  ToolCall,
  ToolResult,
} from '@sapper-ai/types'

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
  allowlist?: {
    toolNames?: string[]
    urlPatterns?: string[]
    contentPatterns?: string[]
    packageNames?: string[]
    sha256?: string[]
  }
  blocklist?: {
    toolNames?: string[]
    urlPatterns?: string[]
    contentPatterns?: string[]
    packageNames?: string[]
    sha256?: string[]
  }
  threatFeed?: {
    enabled?: boolean
    sources?: string[]
    autoSync?: boolean
    failOpen?: boolean
    cachePath?: string
  }
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
  threatIntelStore?: ThreatIntelStore
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
  private readonly threatIntelStore: ThreatIntelStore

  private threatIntelEntries: Array<{
    id: string
    type: 'toolName' | 'packageName' | 'urlPattern' | 'contentPattern' | 'sha256'
    value: string
    reason: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    source: string
    addedAt: string
    expiresAt?: string
  }> = []

  private readonly pendingToolCalls = new Map<string, ToolCall>()
  private readonly pendingToolLists = new Set<string>()

  private started = false
  private closed = false

  constructor(options: StdioSecurityProxyOptions) {
    this.policy = options.policy
    this.policyManager = options.policyManager ?? new PolicyManager()
    this.scanner = options.scanner ?? new Scanner()
    this.detectors = options.detectors
    this.threatIntelStore = options.threatIntelStore ?? new ThreatIntelStore({ cachePath: process.env.SAPPERAI_THREAT_FEED_CACHE })

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

    await this.loadThreatIntel()

    this.downstreamTransport.onmessage = (message) => {
      void this.handleDownstreamMessage(message as JsonRpcMessage)
    }
    this.downstreamTransport.onerror = (error) => {
      console.error(`[SapperAI] downstream error: ${error.message}`)
    }

    this.upstreamTransport.onmessage = (message) => {
      void this.handleUpstreamMessage(message as JsonRpcMessage)
    }
    this.upstreamTransport.onerror = (error) => {
      console.error(`[SapperAI] upstream error: ${error.message}`)
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

      const policy = this.resolvePolicy(toolCall.toolName)
      const preMatch = this.matchPolicy(policy, {
        toolName: toolCall.toolName,
        toolCall,
        metadata: this.toToolMetadataFromRecord(toolCall.meta),
      })
      if (preMatch.action === 'block' && policy.mode === 'enforce') {
        await this.forwardToDownstream(this.createBlockedResponse(message.id, 'pre_tool_call', preMatch.reasons))
        return
      }

      if (preMatch.action === 'allow') {
        this.pendingToolCalls.set(this.toRequestKey(message.id), toolCall)
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
      const installMatch = this.matchPolicy(policy, {
        toolName,
        content: description,
        metadata: {
          name: toolName,
          packageName: typeof rawTool.packageName === 'string' ? rawTool.packageName : undefined,
          sourceUrl: typeof rawTool.url === 'string' ? rawTool.url : undefined,
          sha256: typeof rawTool.sha256 === 'string' ? rawTool.sha256 : undefined,
        },
      })

      if (installMatch.action === 'block' && policy.mode === 'enforce') {
        continue
      }

      if (installMatch.action === 'allow') {
        nextTools.push(rawTool)
        continue
      }

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
    const policy = this.resolvePolicy(toolCall.toolName)
    const postMatch = this.matchPolicy(policy, {
      toolName: toolCall.toolName,
      toolCall,
      toolResult,
      metadata: this.toToolMetadataFromRecord(toolResult.meta),
    })

    if (postMatch.action === 'block' && policy.mode === 'enforce') {
      return this.createBlockedResponse(message.id, 'post_tool_result', postMatch.reasons)
    }

    if (postMatch.action === 'allow') {
      return message
    }

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

    if (this.threatIntelEntries.length > 0) {
      detectors.push(new ThreatIntelDetector(this.threatIntelEntries))
    }

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
      meta: this.isRecord(message.params.meta) ? message.params.meta : undefined,
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

  private toToolMetadataFromRecord(meta: unknown): {
    name?: string
    packageName?: string
    sourceUrl?: string
    sha256?: string
    version?: string
    ecosystem?: string
  } | undefined {
    if (!this.isRecord(meta)) {
      return undefined
    }

    return {
      name: typeof meta.name === 'string' ? meta.name : undefined,
      packageName: typeof meta.packageName === 'string' ? meta.packageName : undefined,
      sourceUrl: typeof meta.sourceUrl === 'string' ? meta.sourceUrl : typeof meta.url === 'string' ? meta.url : undefined,
      sha256: typeof meta.sha256 === 'string' ? meta.sha256 : undefined,
      version: typeof meta.version === 'string' ? meta.version : undefined,
      ecosystem: typeof meta.ecosystem === 'string' ? meta.ecosystem : undefined,
    }
  }

  private matchPolicy(
    policy: Policy,
    subject: {
      toolName?: string
      content?: string
      metadata?: {
        name?: string
        packageName?: string
        sourceUrl?: string
        sha256?: string
        version?: string
        ecosystem?: string
      }
      toolCall?: ToolCall
      toolResult?: ToolResult
      fileHash?: string
    }
  ): { action: 'allow' | 'block' | 'none'; reasons: string[] } {
    const policyWithIntel = this.withThreatIntel(policy)
    return evaluatePolicyMatch(policyWithIntel, subject)
  }

  private withThreatIntel(policy: Policy): Policy {
    if (this.threatIntelEntries.length === 0) {
      return policy
    }

    const extended = policy as ExtendedPolicy
    const intelBlocklist = buildMatchListFromIntel(this.threatIntelEntries)

    return {
      ...extended,
      blocklist: {
        ...(extended.blocklist ?? {}),
        toolNames: [...(extended.blocklist?.toolNames ?? []), ...(intelBlocklist.toolNames ?? [])],
        packageNames: [...(extended.blocklist?.packageNames ?? []), ...(intelBlocklist.packageNames ?? [])],
        urlPatterns: [...(extended.blocklist?.urlPatterns ?? []), ...(intelBlocklist.urlPatterns ?? [])],
        contentPatterns: [...(extended.blocklist?.contentPatterns ?? []), ...(intelBlocklist.contentPatterns ?? [])],
        sha256: [...(extended.blocklist?.sha256 ?? []), ...(intelBlocklist.sha256 ?? [])],
      },
    } as Policy
  }

  private async loadThreatIntel(): Promise<void> {
    const policy = this.policy as ExtendedPolicy
    const feed = policy.threatFeed
    if (!feed?.enabled) {
      this.threatIntelEntries = []
      return
    }

    try {
      const store = feed.cachePath ? new ThreatIntelStore({ cachePath: feed.cachePath }) : this.threatIntelStore

      if (feed.autoSync && Array.isArray(feed.sources) && feed.sources.length > 0) {
        await store.syncFromSources(feed.sources)
      }

      const snapshot = await store.loadSnapshot()
      this.threatIntelEntries = snapshot.entries
    } catch (error) {
      const failOpen = feed.failOpen ?? true
      if (!failOpen) {
        throw error
      }

      this.threatIntelEntries = []
      const err = this.ensureError(error)
      this.logAuditEntry(
        {
          kind: 'install_scan',
          policy: this.policy,
          meta: {
            phase: 'threat_feed_load_error',
            error: err.message,
          },
        } as AssessmentContext,
        {
          action: 'allow',
          risk: 0,
          confidence: 0,
          reasons: [`Threat feed load failed (fail-open): ${err.message}`],
          evidence: [],
        }
      )
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
