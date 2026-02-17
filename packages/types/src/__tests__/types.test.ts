import { expectTypeOf, describe, it } from 'vitest';
import {
  GuardAction,
  ToolCall,
  ToolResult,
  AssessmentContext,
  Detector,
  DetectorOutput,
  Decision,
  ToolPolicy,
  MatchList,
  ThreatFeedConfig,
  ToolMetadata,
  SkillMetadata,
  Honeytoken,
  HoneytokenFinding,
  SkillScanResult,
  LlmConfig,
  Policy,
  AuditLogEntry,
} from '../index.js';

describe('Types', () => {
  it('GuardAction should only accept allow or block', () => {
    expectTypeOf<GuardAction>().toEqualTypeOf<'allow' | 'block'>();
  });

  it('ToolCall should have required toolName and arguments', () => {
    expectTypeOf<ToolCall>().toMatchTypeOf<{
      toolName: string;
      arguments: unknown;
    }>();
  });

  it('ToolCall meta should be optional', () => {
    const tc: ToolCall = {
      toolName: 'exec',
      arguments: { cmd: 'ls' },
    };
    expectTypeOf(tc.meta).toEqualTypeOf<Record<string, unknown> | undefined>();
  });

  it('ToolResult should have required content', () => {
    expectTypeOf<ToolResult>().toMatchTypeOf<{
      content: unknown;
    }>();
  });

  it('ToolResult meta should be optional', () => {
    const tr: ToolResult = {
      content: 'success',
    };
    expectTypeOf(tr.meta).toEqualTypeOf<Record<string, unknown> | undefined>();
  });

  it('AssessmentContext should have required kind and policy', () => {
    expectTypeOf<AssessmentContext>().toMatchTypeOf<{
      kind: 'install_scan' | 'pre_tool_call' | 'post_tool_result';
      policy: Policy;
    }>();
  });

  it('AssessmentContext toolCall and toolResult should be optional', () => {
    const ctx: AssessmentContext = {
      kind: 'install_scan',
      policy: {
        mode: 'monitor',
        defaultAction: 'allow',
        failOpen: true,
      },
    };
    expectTypeOf(ctx.toolCall).toEqualTypeOf<ToolCall | undefined>();
    expectTypeOf(ctx.toolResult).toEqualTypeOf<ToolResult | undefined>();
    expectTypeOf(ctx.toolMetadata).toEqualTypeOf<ToolMetadata | undefined>();
  });

  it('Detector should have required id and methods', () => {
    expectTypeOf<Detector>().toMatchTypeOf<{
      id: string;
      appliesTo(ctx: AssessmentContext): boolean;
      run(ctx: AssessmentContext): Promise<DetectorOutput | null>;
    }>();
  });

  it('DetectorOutput should have required fields', () => {
    expectTypeOf<DetectorOutput>().toMatchTypeOf<{
      detectorId: string;
      risk: number;
      confidence: number;
      reasons: string[];
    }>();
  });

  it('DetectorOutput evidence should be optional', () => {
    const output: DetectorOutput = {
      detectorId: 'test',
      risk: 0.5,
      confidence: 0.9,
      reasons: ['test reason'],
    };
    expectTypeOf(output.evidence).toEqualTypeOf<unknown>();
  });

  it('Decision should include action and evidence array', () => {
    expectTypeOf<Decision>().toMatchTypeOf<{
      action: GuardAction;
      evidence: DetectorOutput[];
    }>();
  });

  it('Decision should have required risk and confidence', () => {
    expectTypeOf<Decision>().toMatchTypeOf<{
      risk: number;
      confidence: number;
      reasons: string[];
    }>();
  });

  it('ToolPolicy fields should be optional', () => {
    const tp: ToolPolicy = {};
    expectTypeOf(tp.mode).toEqualTypeOf<'monitor' | 'enforce' | undefined>();
    expectTypeOf(tp.detectors).toEqualTypeOf<string[] | undefined>();
    expectTypeOf(tp.thresholds).toEqualTypeOf<
      { riskThreshold?: number; blockMinConfidence?: number } | undefined
    >();
    expectTypeOf(tp.allowlist).toEqualTypeOf<MatchList | undefined>();
    expectTypeOf(tp.blocklist).toEqualTypeOf<MatchList | undefined>();
  });

  it('LlmConfig should have required provider', () => {
    expectTypeOf<LlmConfig>().toMatchTypeOf<{
      provider: 'openai' | 'anthropic' | 'sapperai';
    }>();
  });

  it('LlmConfig apiKey, endpoint, and model should be optional', () => {
    const llm: LlmConfig = { provider: 'openai' };
    expectTypeOf(llm.apiKey).toEqualTypeOf<string | undefined>();
    expectTypeOf(llm.endpoint).toEqualTypeOf<string | undefined>();
    expectTypeOf(llm.model).toEqualTypeOf<string | undefined>();
  });

  it('Policy should have required mode, defaultAction, and failOpen', () => {
    expectTypeOf<Policy>().toMatchTypeOf<{
      mode: 'monitor' | 'enforce';
      defaultAction: GuardAction;
      failOpen: boolean;
    }>();
  });

  it('Policy toolOverrides and llm should be optional', () => {
    const policy: Policy = {
      mode: 'monitor',
      defaultAction: 'allow',
      failOpen: true,
    };
    expectTypeOf(policy.toolOverrides).toEqualTypeOf<
      Record<string, ToolPolicy> | undefined
    >();
    expectTypeOf(policy.detectors).toEqualTypeOf<string[] | undefined>();
    expectTypeOf(policy.thresholds).toEqualTypeOf<
      { riskThreshold?: number; blockMinConfidence?: number } | undefined
    >();
    expectTypeOf(policy.allowlist).toEqualTypeOf<MatchList | undefined>();
    expectTypeOf(policy.blocklist).toEqualTypeOf<MatchList | undefined>();
    expectTypeOf(policy.threatFeed).toEqualTypeOf<ThreatFeedConfig | undefined>();
    expectTypeOf(policy.llm).toEqualTypeOf<LlmConfig | undefined>();
  });

  it('AuditLogEntry should have required fields', () => {
    expectTypeOf<AuditLogEntry>().toMatchTypeOf<{
      timestamp: string;
      context: AssessmentContext;
      decision: Decision;
      durationMs: number;
    }>();
  });

  it('SkillMetadata should require name and optional metadata fields', () => {
    expectTypeOf<SkillMetadata>().toMatchTypeOf<{
      name: string;
    }>();

    const metadata: SkillMetadata = {
      name: 'summarizer',
    };

    expectTypeOf(metadata.description).toEqualTypeOf<string | undefined>();
    expectTypeOf(metadata.homepage).toEqualTypeOf<string | undefined>();
    expectTypeOf(metadata.requires).toEqualTypeOf<string[] | undefined>();
    expectTypeOf(metadata.userInvocable).toEqualTypeOf<boolean | undefined>();
  });

  it('Honeytoken should enforce allowed secret classes', () => {
    expectTypeOf<Honeytoken>().toMatchTypeOf<{
      type: 'api_key' | 'ssh_key' | 'password' | 'token';
      envVar: string;
      value: string;
      searchPattern: string;
    }>();
  });

  it('HoneytokenFinding should include protocol and destination evidence', () => {
    expectTypeOf<HoneytokenFinding>().toMatchTypeOf<{
      honeytoken: Honeytoken;
      destination: string;
      protocol: 'https' | 'http' | 'dns';
    }>();

    const finding: HoneytokenFinding = {
      honeytoken: {
        type: 'token',
        envVar: 'GITHUB_TOKEN',
        value: 'ghp_abc',
        searchPattern: 'abc',
      },
      destination: 'evil.example',
      protocol: 'https',
    };

    expectTypeOf(finding.requestPath).toEqualTypeOf<string | undefined>();
  });

  it('SkillScanResult should combine static and dynamic phases', () => {
    expectTypeOf<SkillScanResult>().toMatchTypeOf<{
      skillName: string;
      skillPath: string;
      staticResult: { risk: number; confidence: number; reasons: string[] } | null;
      dynamicResult: { exfiltrationDetected: boolean; findings: HoneytokenFinding[] } | null;
      decision: 'safe' | 'suspicious' | 'quarantined';
    }>();
  });
});
