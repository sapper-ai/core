/**
 * Guard action to allow or block tool execution
 */
export type GuardAction = 'allow' | 'block';
/**
 * Tool call representation
 */
export interface ToolCall {
    toolName: string;
    arguments: unknown;
    meta?: Record<string, unknown>;
}
export interface ToolMetadata {
    name?: string;
    version?: string;
    packageName?: string;
    ecosystem?: 'npm' | 'pypi' | 'mcp' | 'unknown';
    sourceUrl?: string;
    sha256?: string;
}
/**
 * Tool result representation
 */
export interface ToolResult {
    content: unknown;
    meta?: Record<string, unknown>;
}
/**
 * Assessment context for detector evaluation
 */
export interface AssessmentContext {
    kind: 'install_scan' | 'pre_tool_call' | 'post_tool_result';
    toolCall?: ToolCall;
    toolResult?: ToolResult;
    policy: Policy;
    toolMetadata?: ToolMetadata;
    meta?: Record<string, unknown>;
}
/**
 * Detector interface for security assessments
 */
export interface Detector {
    id: string;
    appliesTo(ctx: AssessmentContext): boolean;
    run(ctx: AssessmentContext): Promise<DetectorOutput | null>;
}
/**
 * Output from a detector run
 */
export interface DetectorOutput {
    detectorId: string;
    risk: number;
    confidence: number;
    reasons: string[];
    evidence?: unknown;
}
/**
 * Final decision from guard
 */
export interface Decision {
    action: GuardAction;
    risk: number;
    confidence: number;
    reasons: string[];
    evidence: DetectorOutput[];
}
/**
 * Tool policy configuration
 */
export interface ToolPolicy {
    mode?: 'monitor' | 'enforce';
    detectors?: string[];
    thresholds?: {
        riskThreshold?: number;
        blockMinConfidence?: number;
    };
    allowlist?: MatchList;
    blocklist?: MatchList;
}
export interface MatchList {
    toolNames?: string[];
    urlPatterns?: string[];
    contentPatterns?: string[];
    packageNames?: string[];
    sha256?: string[];
}
export interface ThreatFeedConfig {
    enabled?: boolean;
    sources?: string[];
    ttlMinutes?: number;
    autoSync?: boolean;
    failOpen?: boolean;
    cachePath?: string;
}
/**
 * LLM configuration
 */
export interface LlmConfig {
    provider: 'openai' | 'anthropic' | 'sapperai';
    apiKey?: string;
    endpoint?: string;
    model?: string;
}
/**
 * Policy configuration for guard
 */
export interface Policy {
    mode: 'monitor' | 'enforce';
    defaultAction: GuardAction;
    failOpen: boolean;
    detectors?: string[];
    thresholds?: {
        riskThreshold?: number;
        blockMinConfidence?: number;
    };
    toolOverrides?: Record<string, ToolPolicy>;
    allowlist?: MatchList;
    blocklist?: MatchList;
    threatFeed?: ThreatFeedConfig;
    llm?: LlmConfig;
}
/**
 * Audit log entry for tracking decisions
 */
export interface AuditLogEntry {
    timestamp: string;
    context: AssessmentContext;
    decision: Decision;
    durationMs: number;
}
export declare const version = "0.1.0";
//# sourceMappingURL=index.d.ts.map
