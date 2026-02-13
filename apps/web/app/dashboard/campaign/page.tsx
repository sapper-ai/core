'use client'

import { useEffect, useState } from 'react'

import type { AdversaryCampaignResponse } from '@/app/components/types'

import { CampaignHistory, type CampaignHistoryEntry } from './components/campaign-history'
import { CampaignResults } from './components/campaign-results'
import { CampaignRunner } from './components/campaign-runner'

const HISTORY_KEY = 'sapperai-campaign-history'

function loadHistory(): CampaignHistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item): item is CampaignHistoryEntry => !!item && typeof item === 'object')
      .slice(0, 5)
  } catch {
    return []
  }
}

function saveHistory(history: CampaignHistoryEntry[]) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 5)))
  } catch {
    return
  }
}

export default function CampaignPage() {
  const [policyType, setPolicyType] = useState<'configured' | 'default'>('configured')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AdversaryCampaignResponse | null>(null)
  const [history, setHistory] = useState<CampaignHistoryEntry[]>([])

  useEffect(() => {
    setHistory(loadHistory())
  }, [])

  const runCampaign = async (): Promise<void> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/adversary-campaign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ useDefaultPolicy: policyType === 'default' }),
      })
      const payload = (await response.json()) as AdversaryCampaignResponse | { error?: string }
      if (!response.ok) {
        const message = 'error' in payload && payload.error ? payload.error : '캠페인 실행에 실패했습니다.'
        throw new Error(message)
      }

      const campaign = payload as AdversaryCampaignResponse
      setResult(campaign)

      const entry: CampaignHistoryEntry = {
        runId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        detectionRate: campaign.detectionRate,
        totalCases: campaign.totalCases,
        blockedCases: campaign.blockedCases,
        policyType,
      }

      const next = [entry, ...history]
      const trimmed = next.slice(0, 5)
      setHistory(trimmed)
      saveHistory(trimmed)
    } catch (e) {
      const message = e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.'
      setError(message)
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-6">
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 shadow-subtle">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <CampaignRunner
          policyType={policyType}
          onPolicyTypeChange={setPolicyType}
          onRun={() => void runCampaign()}
          loading={loading}
        />
        <CampaignHistory history={history} />
      </div>

      {result ? (
        <CampaignResults result={result} />
      ) : (
        <div className="rounded-2xl border border-border bg-white p-8 text-center text-sm text-steel shadow-subtle">
          Run the campaign to see results.
        </div>
      )}
    </div>
  )
}
