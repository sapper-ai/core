'use client'

export function CampaignRunner({
  policyType,
  onPolicyTypeChange,
  onRun,
  loading,
}: {
  policyType: 'configured' | 'default'
  onPolicyTypeChange: (next: 'configured' | 'default') => void
  onRun: () => void
  loading: boolean
}) {
  return (
    <section className="grid gap-4 rounded-2xl border border-border bg-white p-6 shadow-subtle">
      <div>
        <p className="text-sm font-semibold text-ink">Run Campaign</p>
        <p className="mt-1 text-xs text-steel">Choose a policy and run the built-in attack cases.</p>
      </div>

      <div className="grid gap-3 rounded-xl border border-border bg-muted p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-steel">Policy</p>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="radio"
            name="policy-type"
            checked={policyType === 'configured'}
            onChange={() => onPolicyTypeChange('configured')}
          />
          현재 설정 파일 정책
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="radio"
            name="policy-type"
            checked={policyType === 'default'}
            onChange={() => onPolicyTypeChange('default')}
          />
          기본 정책
        </label>
      </div>

      <button
        type="button"
        onClick={onRun}
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading && <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
        원클릭 캠페인 실행
      </button>
    </section>
  )
}
