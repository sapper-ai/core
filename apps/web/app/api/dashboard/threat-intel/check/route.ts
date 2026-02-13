import { NextResponse } from 'next/server'

import type { ThreatIntelEntry } from '@sapper-ai/core'

import { getCachedEntries } from '../../../shared/intel-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type CheckResponse = {
  indicator: string
  matches: ThreatIntelEntry[]
  matched: boolean
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }
  return 'Threat intel 검사 중 오류가 발생했습니다.'
}

function hasMatch(entry: ThreatIntelEntry, indicator: string): boolean {
  const left = indicator.toLowerCase()
  const right = entry.value.toLowerCase()

  if (entry.type === 'toolName') {
    return left === right
  }

  if (entry.type === 'packageName' || entry.type === 'sha256') {
    return left.includes(right) || right.includes(left)
  }

  if (entry.type === 'urlPattern' || entry.type === 'contentPattern') {
    try {
      return new RegExp(entry.value, 'i').test(indicator)
    } catch {
      return false
    }
  }

  return false
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const payload = (await request.json()) as { indicator?: unknown }
    const indicator = typeof payload.indicator === 'string' ? payload.indicator.trim() : ''
    if (!indicator) {
      return NextResponse.json({ error: 'indicator가 필요합니다.' }, { status: 400 })
    }

    const entries = await getCachedEntries()
    const matches = entries.filter((entry) => hasMatch(entry, indicator))

    const response: CheckResponse = {
      indicator,
      matches,
      matched: matches.length > 0,
    }

    return NextResponse.json(response)
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
