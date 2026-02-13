import { homedir } from 'node:os'
import { join } from 'node:path'

import { NextResponse } from 'next/server'

import { createIntelStore } from '../../shared/intel-store'
import { getIntelCachePath } from '../../shared/paths'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ThreatIntelStatusResponse = {
  totalEntries: number
  byType: Record<string, number>
  bySeverity: Record<string, number>
  bySource: { source: string; count: number }[]
  lastSyncedAt: string
  cachePath: string
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }
  return 'Threat intel 상태 조회 중 오류가 발생했습니다.'
}

function resolvedCachePath(): string {
  return getIntelCachePath() ?? join(homedir(), '.sapperai', 'intel', 'threat-intel.json')
}

export async function GET(): Promise<NextResponse> {
  try {
    const store = createIntelStore()
    const snapshot = await store.loadSnapshot()

    const byType: Record<string, number> = {}
    const bySeverity: Record<string, number> = {}
    const bySourceCounter = new Map<string, number>()

    for (const entry of snapshot.entries) {
      byType[entry.type] = (byType[entry.type] ?? 0) + 1
      bySeverity[entry.severity] = (bySeverity[entry.severity] ?? 0) + 1
      bySourceCounter.set(entry.source, (bySourceCounter.get(entry.source) ?? 0) + 1)
    }

    const bySource = [...bySourceCounter.entries()]
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)

    const payload: ThreatIntelStatusResponse = {
      totalEntries: snapshot.entries.length,
      byType,
      bySeverity,
      bySource,
      lastSyncedAt: snapshot.entries.length === 0 ? '' : snapshot.updatedAt,
      cachePath: resolvedCachePath(),
    }

    return NextResponse.json(payload)
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
