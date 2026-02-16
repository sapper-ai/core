import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'

import { NextResponse } from 'next/server'

import { PolicyManager } from '@sapper-ai/core'
import type { Policy } from '@sapper-ai/types'
import { stringify } from 'yaml'
import { ZodError } from 'zod'

import { getConfigPath } from '../shared/paths'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type PolicyReadResponse = {
  policy: Policy
  rawYaml: string
  filePath: string
  lastModified: string
}

type PolicyUpdateRequest = { policy: Policy }
type PolicyUpdateResponse = { success: boolean; policy: Policy; rawYaml: string }

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }
  return '정책 처리 중 오류가 발생했습니다.'
}

function getDefaultPolicy(): Policy {
  return {
    mode: 'enforce',
    defaultAction: 'allow',
    failOpen: true,
    detectors: ['rules'],
    thresholds: { riskThreshold: 0.7, blockMinConfidence: 0.5 },
  }
}

export async function GET(): Promise<NextResponse> {
  try {
    const filePath = getConfigPath()
    const manager = new PolicyManager()

    if (!existsSync(filePath)) {
      const policy = manager.loadFromObject(getDefaultPolicy())
      const rawYaml = stringify(policy)
      const payload: PolicyReadResponse = {
        policy,
        rawYaml,
        filePath,
        lastModified: new Date(0).toISOString(),
      }
      return NextResponse.json(payload)
    }

    const rawYaml = readFileSync(filePath, 'utf8')
    const policy = manager.loadFromFile(filePath)
    const stat = statSync(filePath)

    const payload: PolicyReadResponse = {
      policy,
      rawYaml,
      filePath,
      lastModified: stat.mtime.toISOString(),
    }

    return NextResponse.json(payload)
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const filePath = getConfigPath()
    const manager = new PolicyManager()

    const payload = (await request.json()) as PolicyUpdateRequest
    if (!payload || typeof payload !== 'object' || !('policy' in payload)) {
      return NextResponse.json({ error: 'policy가 필요합니다.' }, { status: 400 })
    }

    const policy = manager.loadFromObject(payload.policy)
    const rawYaml = stringify(policy)
    writeFileSync(filePath, rawYaml, 'utf8')

    const response: PolicyUpdateResponse = {
      success: true,
      policy,
      rawYaml,
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
