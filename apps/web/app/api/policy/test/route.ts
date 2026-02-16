import { NextResponse } from 'next/server'

import { AuditLogger, createDetectors, DecisionEngine, Guard, PolicyManager } from '@sapper-ai/core'
import type { Policy, ToolCall } from '@sapper-ai/types'
import { ZodError } from 'zod'

import { attackCases } from '../../shared/attack-cases'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type CaseResult = {
  id: string
  label: string
  type: (typeof attackCases)[number]['type']
  severity: (typeof attackCases)[number]['severity']
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

type PolicyTestResponse = {
  runId: string
  model: string
  totalCases: number
  blockedCases: number
  detectionRate: number
  typeDistribution: DistributionItem[]
  severityDistribution: DistributionItem[]
  topReasons: string[]
  cases: CaseResult[]
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }
  return '정책 테스트 중 오류가 발생했습니다.'
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

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const payload = (await request.json()) as { policy?: Policy }
    if (!payload?.policy) {
      return NextResponse.json({ error: 'policy가 필요합니다.' }, { status: 400 })
    }

    const manager = new PolicyManager()
    const policy = manager.loadFromObject(payload.policy)
    const detectors = createDetectors({ policy })
    const guard = new Guard(new DecisionEngine(detectors), new AuditLogger(), policy)

    const runId = `policy-test-${Date.now().toString(36)}`
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

    const typeKeys = [
      'prompt_injection',
      'command_injection',
      'path_traversal',
      'data_exfiltration',
      'code_injection',
    ] as const

    const typeDistribution: DistributionItem[] = typeKeys.map((key) => ({
      key,
      total: attackCases.filter((item) => item.type === key).length,
      blocked: results.filter((result) => result.type === key && result.decision.action === 'block').length,
    }))

    const severityKeys = ['low', 'medium', 'high', 'critical'] as const
    const severityDistribution: DistributionItem[] = severityKeys.map((key) => ({
      key,
      total: attackCases.filter((item) => item.severity === key).length,
      blocked: results.filter((result) => result.severity === key && result.decision.action === 'block').length,
    }))

    const response: PolicyTestResponse = {
      runId,
      model: policy.detectors?.includes('llm') ? 'rules + llm' : 'rules-only',
      totalCases: results.length,
      blockedCases,
      detectionRate,
      typeDistribution,
      severityDistribution,
      topReasons: summarizeReasons(results),
      cases: results,
    }

    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid policy',
          issues: error.issues,
        },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
