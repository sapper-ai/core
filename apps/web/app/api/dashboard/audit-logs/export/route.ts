import { NextResponse } from 'next/server'

import type { AuditLogEntry } from '@sapper-ai/types'

import { readAuditLog } from '../../utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }
  return '감사 로그 내보내기 중 오류가 발생했습니다.'
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

function filterEntries(entries: AuditLogEntry[], params: URLSearchParams): AuditLogEntry[] {
  const action = params.get('action')
  const minRisk = parseNumber(params.get('minRisk'), -1)
  const toolName = (params.get('toolName') ?? '').trim().toLowerCase()
  const fromMs = parseDateMs(params.get('from'))
  const toMs = parseDateMs(params.get('to'))

  return entries.filter((entry) => {
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
}

function escapeCsv(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function entryToCsvRow(entry: AuditLogEntry): string {
  const toolName = entry.context.toolCall?.toolName ?? 'unknown'
  const reasons = entry.decision.reasons.join('; ')

  return [
    escapeCsv(entry.timestamp),
    escapeCsv(toolName),
    entry.decision.action,
    String(entry.decision.risk),
    String(entry.decision.confidence),
    escapeCsv(reasons),
    String(entry.durationMs),
  ].join(',')
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url)
    const params = url.searchParams
    const format = (params.get('format') ?? 'csv').toLowerCase()

    const filtered = filterEntries(readAuditLog(), params)

    if (format === 'json') {
      const body = JSON.stringify(filtered)
      return new NextResponse(body, {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'content-disposition': 'attachment; filename="sapperai-audit.json"',
        },
      })
    }

    const header = 'timestamp,toolName,action,risk,confidence,reasons,durationMs\n'
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(header))
        for (const entry of filtered) {
          controller.enqueue(new TextEncoder().encode(`${entryToCsvRow(entry)}\n`))
        }
        controller.close()
      },
    })

    return new NextResponse(stream, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="sapperai-audit.csv"',
      },
    })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
