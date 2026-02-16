'use client'

import { useState } from 'react'

import type { DetectionResponse } from '@/app/components/types'
import { StatusBadge } from '@/app/components/status-badge'
import { MAX_UPLOAD_FILE_SIZE } from '@/app/components/utils'

import { DetectionVisualization } from './detection-visualization'
import { SectionHeader } from './section-header'

export function UploadSection() {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadResult, setUploadResult] = useState<DetectionResponse | null>(null)
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)

  const handleSkillFileUpload = async (file: File): Promise<void> => {
    const normalizedName = file.name.toLowerCase()

    if (!normalizedName.endsWith('.md') && !normalizedName.endsWith('.markdown')) {
      setUploadError('.md 또는 .markdown 파일만 업로드할 수 있습니다.')
      setUploadResult(null)
      return
    }

    if (file.size > MAX_UPLOAD_FILE_SIZE) {
      setUploadError('파일 크기는 최대 1MB까지 허용됩니다.')
      setUploadResult(null)
      return
    }

    setUploading(true)
    setUploadError(null)
    setUploadResult(null)
    setSelectedFileName(file.name)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/scan-file', { method: 'POST', body: formData })
      const payload = (await response.json()) as DetectionResponse | { error?: string }

      if (!response.ok) {
        const message = 'error' in payload && payload.error ? payload.error : '파일 분석에 실패했습니다.'
        throw new Error(message)
      }

      setUploadResult(payload as DetectionResponse)
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : '알 수 없는 오류가 발생했습니다.'
      setUploadError(message)
      setUploadResult(null)
    } finally {
      setUploading(false)
    }
  }

  return (
    <section className="grid gap-6 rounded-2xl border border-border bg-surface p-7 md:p-10">
      <SectionHeader
        title="skill.md 업로드 위험 분석"
        description="Skill 문서를 업로드하면 SapperAI가 install-scan 컨텍스트로 위험도를 분석합니다. (최대 1MB, UTF-8 markdown)"
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <div className="grid gap-4">
          <label className="grid cursor-pointer place-items-center gap-3 rounded-xl border-2 border-dashed border-gray-300 bg-muted p-8 text-center transition hover:border-signal hover:bg-blue-50/30">
            <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <div>
              <p className="text-sm font-medium text-ink">파일을 끌어오거나 클릭하세요</p>
              <p className="mt-1 text-xs text-steel">.md, .markdown / 최대 1MB / UTF-8</p>
            </div>
            <input
              type="file"
              accept=".md,.markdown,text/markdown,text/plain"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void handleSkillFileUpload(file)
              }}
            />
          </label>
          {selectedFileName && (
            <p className="text-sm text-steel">
              선택 파일: <span className="font-medium text-ink">{selectedFileName}</span>
            </p>
          )}
          {uploading && (
            <div className="flex items-center gap-2 text-sm text-signal">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-signal border-t-transparent" />
              파일 분석 중...
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-muted p-5">
          {!uploadResult && !uploadError && (
            <div className="grid gap-2 text-sm text-steel">
              <p className="font-medium text-ink">업로드 결과 대기 중</p>
              <p>skill.md 파일을 업로드하면 차단/허용 결과와 탐지 근거를 바로 확인할 수 있습니다.</p>
            </div>
          )}

          {uploadError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
              <p className="font-semibold">업로드 분석 오류</p>
              <p className="mt-1 whitespace-pre-wrap">{uploadError}</p>
            </div>
          )}

          {uploadResult && (
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  variant={uploadResult.action === 'block' ? 'block' : 'allow'}
                  label={uploadResult.action === 'block' ? 'BLOCK' : 'ALLOW'}
                />
                <span className="rounded-full border border-border bg-surface px-3 py-0.5 text-xs font-medium tabular-nums text-steel">
                  Risk {(uploadResult.risk * 100).toFixed(1)}%
                </span>
                <span className="rounded-full border border-border bg-surface px-3 py-0.5 text-xs font-medium tabular-nums text-steel">
                  Confidence {(uploadResult.confidence * 100).toFixed(1)}%
                </span>
              </div>

              {uploadResult.source && (
                <p className="text-xs text-steel">
                  분석 파일: {uploadResult.source.fileName} ({(uploadResult.source.fileSize / 1024).toFixed(1)} KB)
                </p>
              )}

              <div className="grid gap-2">
                <p className="text-sm font-semibold text-ink">판단 이유</p>
                <ul className="grid gap-1.5">
                  {uploadResult.reasons.map((reason) => (
                    <li key={reason} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-steel">
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>

              <DetectionVisualization data={uploadResult} />

              <div className="grid gap-2">
                <p className="text-sm font-semibold text-ink">탐지기 근거</p>
                <div className="grid gap-1.5">
                  {uploadResult.evidence.map((entry) => (
                    <div key={`${entry.detectorId}-${entry.risk}`} className="rounded-lg border border-border bg-surface p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-steel">{entry.detectorId}</p>
                      <p className="mt-1 text-xs tabular-nums text-steel">
                        Risk {(entry.risk * 100).toFixed(1)}% / Confidence {(entry.confidence * 100).toFixed(1)}%
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
