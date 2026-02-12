import { NextResponse } from 'next/server'

import { AuditLogger, DecisionEngine, Guard, PolicyManager, RulesDetector } from '@sapper-ai/core'
import type { Policy, ToolCall, ToolResult } from '@sapper-ai/types'

export const runtime = 'nodejs'

const rawPolicy: Policy = {
  mode: 'enforce',
  defaultAction: 'allow',
  failOpen: true,
  detectors: ['rules'],
  thresholds: {
    riskThreshold: 0.7,
    blockMinConfidence: 0.65,
  },
}

const policy = new PolicyManager().loadFromObject(rawPolicy)
const engine = new DecisionEngine([new RulesDetector()])
const guard = new Guard(engine, new AuditLogger(), policy)

type DetectRequest = {
  toolName?: string
  arguments?: unknown
  meta?: Record<string, unknown>
  toolResult?: ToolResult
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const payload = (await request.json()) as DetectRequest
    const toolName = payload.toolName?.trim()

    if (!toolName) {
      return NextResponse.json({ error: 'toolName은 필수입니다.' }, { status: 400 })
    }

    const toolCall: ToolCall = {
      toolName,
      arguments: payload.arguments,
      meta: payload.meta,
    }

    const decision = payload.toolResult
      ? await guard.postTool(toolCall, payload.toolResult)
      : await guard.preTool(toolCall)

    return NextResponse.json(decision)
  } catch (error) {
    const message = error instanceof Error ? error.message : '탐지 처리 중 오류가 발생했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
