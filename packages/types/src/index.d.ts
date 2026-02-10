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
        blockMinConfidence?: number;
    };
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
    toolOverrides?: Record<string, ToolPolicy>;
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