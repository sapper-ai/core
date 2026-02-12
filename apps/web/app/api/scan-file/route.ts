import { NextResponse } from 'next/server'

import { AuditLogger, PolicyManager, Scanner, createDetectors } from '@sapper-ai/core'
import type { Policy } from '@sapper-ai/types'

export const runtime = 'nodejs'

const MAX_FILE_SIZE_BYTES = 1024 * 1024
const ALLOWED_MIME_TYPES = new Set(['text/markdown', 'text/plain'])
const ALLOWED_EXTENSIONS = ['.md', '.markdown']

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
const detectors = createDetectors({ policy })
const scanner = new Scanner()
const auditLogger = new AuditLogger()

function hasValidExtension(fileName: string): boolean {
  const normalized = fileName.trim().toLowerCase()
  return ALLOWED_EXTENSIONS.some((extension) => normalized.endsWith(extension))
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return '파일 분석 중 알 수 없는 오류가 발생했습니다.'
}

export async function POST(request: Request): Promise<NextResponse> {
  const startTime = Date.now()

  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: '업로드할 markdown 파일을 선택해 주세요.' }, { status: 400 })
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: '빈 파일은 분석할 수 없습니다.' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `파일 크기는 최대 ${Math.floor(MAX_FILE_SIZE_BYTES / 1024 / 1024)}MB까지 허용됩니다.` },
        { status: 413 }
      )
    }

    if (!hasValidExtension(file.name)) {
      return NextResponse.json({ error: '.md 또는 .markdown 파일만 업로드할 수 있습니다.' }, { status: 400 })
    }

    if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: `지원하지 않는 파일 형식입니다: ${file.type}` }, { status: 400 })
    }

    let content: string
    try {
      const buffer = await file.arrayBuffer()
      content = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
    } catch {
      return NextResponse.json({ error: 'UTF-8 인코딩 markdown 파일만 분석할 수 있습니다.' }, { status: 400 })
    }

    if (content.trim().length === 0) {
      return NextResponse.json({ error: '내용이 없는 markdown 파일은 분석할 수 없습니다.' }, { status: 400 })
    }

    const decision = await scanner.scanTool('skill-markdown-upload', content, policy, detectors)

    auditLogger.log({
      timestamp: new Date().toISOString(),
      context: {
        kind: 'install_scan',
        policy,
        meta: {
          toolName: 'skill-markdown-upload',
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
          scanText: content,
        },
      },
      decision,
      durationMs: Date.now() - startTime,
    })

    return NextResponse.json({
      ...decision,
      source: {
        fileName: file.name,
        fileSize: file.size,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
