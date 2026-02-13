import { NextResponse } from 'next/server'

import type { ThreatIntelEntry } from '@sapper-ai/core'

import { getCachedEntries } from '../../../shared/intel-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ThreatIntelEntriesResponse = {
  entries: ThreatIntelEntry[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }
  return 'Threat intel 항목 조회 중 오류가 발생했습니다.'
}

function parseNumber(value: string | null, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url)
    const params = url.searchParams

    const page = Math.max(1, Math.floor(parseNumber(params.get('page'), 1)))
    const limit = Math.max(1, Math.min(200, Math.floor(parseNumber(params.get('limit'), 50))))
    const type = (params.get('type') ?? '').trim()
    const severity = (params.get('severity') ?? '').trim()
    const search = (params.get('search') ?? '').trim().toLowerCase()

    const all = await getCachedEntries()
    const filtered = all.filter((entry) => {
      if (type.length > 0 && entry.type !== type) return false
      if (severity.length > 0 && entry.severity !== severity) return false
      if (search.length > 0) {
        const hay = `${entry.value}\n${entry.reason}\n${entry.source}`.toLowerCase()
        if (!hay.includes(search)) return false
      }
      return true
    })

    const total = filtered.length
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const safePage = Math.min(page, totalPages)
    const start = (safePage - 1) * limit

    const payload: ThreatIntelEntriesResponse = {
      entries: filtered.slice(start, start + limit),
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
