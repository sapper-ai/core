import { existsSync } from 'node:fs'

import { NextResponse } from 'next/server'

import { PolicyManager } from '@sapper-ai/core'
import type { Policy } from '@sapper-ai/types'

import { createIntelStore } from '../../../shared/intel-store'
import { getConfigPath } from '../../../shared/paths'
import { isPrivateUrl } from '../../../shared/url-validator'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SyncResponse = {
  sourceCount: number
  acceptedEntries: number
  skippedEntries: number
  updatedAt: string
  errors: { source: string; message: string }[]
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }
  return 'Threat intel 동기화 중 오류가 발생했습니다.'
}

async function readPolicySources(): Promise<string[]> {
  const path = getConfigPath()
  if (!existsSync(path)) return []

  const manager = new PolicyManager()
  let policy: Policy
  try {
    policy = manager.loadFromFile(path)
  } catch {
    return []
  }

  const sources = policy.threatFeed?.sources
  if (!Array.isArray(sources)) return []
  return sources.filter((s) => typeof s === 'string' && s.trim().length > 0).map((s) => s.trim())
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    let payload: unknown = null
    try {
      payload = await request.json()
    } catch {
      payload = null
    }

    const provided =
      payload && typeof payload === 'object' && Array.isArray((payload as { sources?: unknown }).sources)
        ? ((payload as { sources: unknown[] }).sources
            .filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim())
            .filter((item) => item.length > 0))
        : null

    const sources = provided ?? (await readPolicySources())
    const errors: { source: string; message: string }[] = []

    const allowedSources: string[] = []
    for (const source of sources) {
      if (isPrivateUrl(source)) {
        errors.push({ source, message: 'Private or invalid URL is not allowed' })
        continue
      }
      allowedSources.push(source)
    }

    const store = createIntelStore()
    let skippedEntries = 0
    let acceptedEntries = 0
    let updatedAt = ''

    for (const source of allowedSources) {
      try {
        const result = await store.syncFromSources([source])
        skippedEntries += result.skippedEntries
        acceptedEntries = result.acceptedEntries
        updatedAt = result.updatedAt
      } catch (error) {
        errors.push({ source, message: getErrorMessage(error) })
      }
    }

    if (allowedSources.length === 0) {
      const snapshot = await store.loadSnapshot()
      acceptedEntries = snapshot.entries.length
      updatedAt = snapshot.entries.length === 0 ? '' : snapshot.updatedAt
    }

    const response: SyncResponse = {
      sourceCount: allowedSources.length,
      acceptedEntries,
      skippedEntries,
      updatedAt,
      errors,
    }

    return NextResponse.json(response)
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
