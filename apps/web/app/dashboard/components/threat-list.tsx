import { CATEGORY_LABELS, type ThreatCategory } from '@/app/api/shared/threat-categories'

export function ThreatList({
  threats,
}: {
  threats: { category: ThreatCategory; label: string; count: number }[]
}) {
  const visible = threats.filter((t) => t.count > 0).slice(0, 6)
  const max = Math.max(...visible.map((t) => t.count), 0)

  return (
    <div className="rounded-2xl border border-border bg-white p-5 shadow-subtle">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">Top Threats</p>
        <p className="text-xs text-steel">Blocked reasons</p>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-steel">No blocked requests found.</p>
      ) : (
        <div className="grid gap-3">
          {visible.map((item) => {
            const label = CATEGORY_LABELS[item.category] ?? item.label
            const ratio = max > 0 ? item.count / max : 0
            return (
              <div key={item.category} className="grid gap-1">
                <div className="flex items-center justify-between text-xs text-steel">
                  <span className="font-medium text-ink">{label}</span>
                  <span className="tabular-nums">{item.count}</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-2.5 rounded-full bg-signal" style={{ width: `${ratio * 100}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
