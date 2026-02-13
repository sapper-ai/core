import { NextResponse } from 'next/server'

import { readAuditLog } from '../utils'
import { categorizeThreat, CATEGORY_LABELS, type ThreatCategory } from '../../shared/threat-categories'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type MetricsResponse = {
  totalRequests: number
  blockedRequests: number
  allowedRequests: number
  blockRate: number
  avgLatencyMs: number
  topThreats: { category: ThreatCategory; label: string; count: number }[]
  timeline: { hour: string; total: number; blocked: number }[]
  recentActivity: {
    timestamp: string
    toolName: string
    action: 'allow' | 'block'
    risk: number
  }[]
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }
  return '대시보드 메트릭 처리 중 오류가 발생했습니다.'
}

function toHourKey(date: Date): string {
  return `${date.toISOString().slice(0, 13)}:00`
}

function buildTimelineBuckets(now: Date): Array<{ hour: string; start: number; end: number }>
{
  const currentHour = new Date(now)
  currentHour.setMinutes(0, 0, 0)

  const buckets: Array<{ hour: string; start: number; end: number }> = []
  for (let i = 23; i >= 0; i -= 1) {
    const start = new Date(currentHour)
    start.setHours(start.getHours() - i)
    const end = new Date(start)
    end.setHours(end.getHours() + 1)
    buckets.push({ hour: toHourKey(start), start: start.getTime(), end: end.getTime() })
  }
  return buckets
}

export async function GET(): Promise<NextResponse> {
  try {
    const entries = readAuditLog()

    const totalRequests = entries.length
    const blockedRequests = entries.filter((entry) => entry.decision.action === 'block').length
    const allowedRequests = totalRequests - blockedRequests
    const blockRate = totalRequests > 0 ? blockedRequests / totalRequests : 0

    const latencySum = entries.reduce((sum, entry) => sum + (typeof entry.durationMs === 'number' ? entry.durationMs : 0), 0)
    const avgLatencyMs = totalRequests > 0 ? latencySum / totalRequests : 0

    const categoryCounter = new Map<ThreatCategory, number>()
    for (const entry of entries) {
      if (entry.decision.action !== 'block') continue
      for (const reason of entry.decision.reasons) {
        const category = categorizeThreat(reason)
        categoryCounter.set(category, (categoryCounter.get(category) ?? 0) + 1)
      }
    }

    const topThreats = [...categoryCounter.entries()]
      .filter(([category, count]) => category !== 'other' && count > 0)
      .map(([category, count]) => ({
        category,
        label: CATEGORY_LABELS[category],
        count,
      }))
      .sort((a, b) => b.count - a.count)

    const now = new Date()
    const buckets = buildTimelineBuckets(now)
    const bucketCounts = new Map<string, { total: number; blocked: number }>()
    for (const bucket of buckets) {
      bucketCounts.set(bucket.hour, { total: 0, blocked: 0 })
    }

    for (const entry of entries) {
      const ts = new Date(entry.timestamp)
      const time = ts.getTime()
      if (Number.isNaN(time)) continue
      if (time < buckets[0]!.start || time >= buckets[buckets.length - 1]!.end) continue

      const hour = toHourKey(ts)
      const target = bucketCounts.get(hour)
      if (!target) continue
      target.total += 1
      if (entry.decision.action === 'block') {
        target.blocked += 1
      }
    }

    const timeline = buckets.map((bucket) => {
      const counts = bucketCounts.get(bucket.hour) ?? { total: 0, blocked: 0 }
      return { hour: bucket.hour, total: counts.total, blocked: counts.blocked }
    })

    const recentActivity = entries.slice(0, 10).map((entry) => ({
      timestamp: entry.timestamp,
      toolName: entry.context.toolCall?.toolName ?? 'unknown',
      action: entry.decision.action,
      risk: entry.decision.risk,
    }))

    const payload: MetricsResponse = {
      totalRequests,
      blockedRequests,
      allowedRequests,
      blockRate,
      avgLatencyMs,
      topThreats,
      timeline,
      recentActivity,
    }

    return NextResponse.json(payload)
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
