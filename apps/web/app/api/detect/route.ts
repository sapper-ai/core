import { NextResponse } from 'next/server'

import type { ToolCall, ToolResult } from '@sapper-ai/types'

import { getGuard } from '../shared/guard-factory'

export const runtime = 'nodejs'

type DetectRequest = {
  toolName?: string
  arguments?: unknown
  meta?: Record<string, unknown>
  toolResult?: ToolResult
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { guard } = await getGuard()
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
