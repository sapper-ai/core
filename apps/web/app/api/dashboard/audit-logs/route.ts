import { NextResponse } from 'next/server'

import type { AuditLogEntry } from '@sapper-ai/types'

import { readAuditLog } from '../utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type AuditLogsResponse = {
  entries: AuditLogEntry[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }
  return '감사 로그 처리 중 오류가 발생했습니다.'
}

function parseNumber(value: string | null, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseDateMs(value: string | null): number | null {
  if (!value) return null
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? null : parsed
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url)
    const params = url.searchParams

    const page = Math.max(1, Math.floor(parseNumber(params.get('page'), 1)))
    const limit = Math.max(1, Math.min(200, Math.floor(parseNumber(params.get('limit'), 50))))

    const action = params.get('action')
    const minRisk = parseNumber(params.get('minRisk'), -1)
    const toolName = (params.get('toolName') ?? '').trim().toLowerCase()

    const fromMs = parseDateMs(params.get('from'))
    const toMs = parseDateMs(params.get('to'))

    const all = readAuditLog()
    const filtered = all.filter((entry) => {
      if (action === 'allow' || action === 'block') {
        if (entry.decision.action !== action) return false
      }

      if (minRisk >= 0) {
        if (entry.decision.risk < minRisk) return false
      }

      if (toolName.length > 0) {
        const name = (entry.context.toolCall?.toolName ?? '').toLowerCase()
        if (!name.includes(toolName)) return false
      }

      if (fromMs !== null || toMs !== null) {
        const ts = new Date(entry.timestamp).getTime()
        if (Number.isNaN(ts)) return false
        if (fromMs !== null && ts < fromMs) return false
        if (toMs !== null && ts > toMs) return false
      }

      return true
    })

    const total = filtered.length
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const safePage = Math.min(page, totalPages)
    const start = (safePage - 1) * limit
    const entries = filtered.slice(start, start + limit)

    const payload: AuditLogsResponse = {
      entries,
      pagination: {
        page: safePage,
        limit,
        total,
        totalPages,
      },
    }

    return NextResponse.json(payload)
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
