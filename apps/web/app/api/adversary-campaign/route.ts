import { NextResponse } from 'next/server'

import { AuditLogger, createDetectors, DecisionEngine, Guard, PolicyManager } from '@sapper-ai/core'
import type { Policy, ToolCall } from '@sapper-ai/types'

import { attackCases } from '../shared/attack-cases'

import { getCachedEntries } from '../shared/intel-store'
import { getGuard } from '../shared/guard-factory'
import { getAuditLogPath } from '../shared/paths'

export const runtime = 'nodejs'

type Severity = 'low' | 'medium' | 'high' | 'critical'

type CaseResult = {
  id: string
  label: string
  type: (typeof attackCases)[number]['type']
  severity: Severity
  decision: {
    action: 'allow' | 'block'
    risk: number
    confidence: number
    reasons: string[]
  }
}

type DistributionItem = {
  key: string
  total: number
  blocked: number
}

const openAiApiKey = process.env.OPENAI_API_KEY?.trim()
const openAiOrgId = process.env.OPENAI_ORG_ID?.trim()
const openAiProjectId = process.env.OPENAI_PROJECT_ID?.trim()

const rawPolicy: Policy = {
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
          provider: 'openai' as const,
          apiKey: openAiApiKey,
          model: 'gpt-4.1-mini',
          ...(openAiOrgId ? { orgId: openAiOrgId } : {}),
          ...(openAiProjectId ? { projectId: openAiProjectId } : {}),
        },
      }
    : {}),
}

const policy = new PolicyManager().loadFromObject(rawPolicy)
const auditLogPath = getAuditLogPath()

async function createDefaultGuard(): Promise<Guard> {
  const threatIntelEntries = await getCachedEntries()
  const detectors = createDetectors({ policy, threatIntelEntries })
  return new Guard(new DecisionEngine(detectors), new AuditLogger({ filePath: auditLogPath }), policy)
}

function summarizeReasons(results: CaseResult[]): string[] {
  const counter = new Map<string, number>()

  for (const result of results) {
    for (const reason of result.decision.reasons) {
      counter.set(reason, (counter.get(reason) ?? 0) + 1)
    }
  }

  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([reason, count]) => `${reason} (${count})`)
}

type CampaignRequest = {
  useDefaultPolicy?: boolean
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    let payload: unknown = null
    try {
      payload = await request.json()
    } catch {
      payload = null
    }

    const useDefaultPolicy =
      !!payload && typeof payload === 'object' && (payload as CampaignRequest).useDefaultPolicy === true

    const guard = useDefaultPolicy ? await createDefaultGuard() : (await getGuard()).guard

    const runId = `campaign-${Date.now().toString(36)}`
    const results: CaseResult[] = []

    for (const attackCase of attackCases) {
      const toolCall: ToolCall = {
        toolName: attackCase.toolName,
        arguments: attackCase.arguments,
        meta: {
          attackCaseId: attackCase.id,
          attackType: attackCase.type,
          severity: attackCase.severity,
        },
      }

      const decision = await guard.preTool(toolCall)
      results.push({
        id: attackCase.id,
        label: attackCase.label,
        type: attackCase.type,
        severity: attackCase.severity,
        decision: {
          action: decision.action,
          risk: decision.risk,
          confidence: decision.confidence,
          reasons: decision.reasons,
        },
      })
    }

    const blockedCases = results.filter((entry) => entry.decision.action === 'block').length
    const detectionRate = results.length > 0 ? blockedCases / results.length : 0

    const typeDistribution: DistributionItem[] = [
      'prompt_injection',
      'command_injection',
      'path_traversal',
      'data_exfiltration',
      'code_injection',
    ].map((key) => ({
      key,
      total: attackCases.filter((item) => item.type === key).length,
      blocked: results.filter((result) => result.type === key && result.decision.action === 'block').length,
    }))

    const severityDistribution: DistributionItem[] = ['low', 'medium', 'high', 'critical'].map((key) => ({
      key,
      total: attackCases.filter((item) => item.severity === key).length,
      blocked: results.filter((result) => result.severity === key && result.decision.action === 'block').length,
    }))

    return NextResponse.json({
      runId,
      model: openAiApiKey ? 'rules + gpt-4.1-mini' : 'rules-only',
      totalCases: results.length,
      blockedCases,
      detectionRate,
      typeDistribution,
      severityDistribution,
      topReasons: summarizeReasons(results),
      cases: results,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '캠페인 실행 중 오류가 발생했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
