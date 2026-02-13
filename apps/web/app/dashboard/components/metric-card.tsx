export function MetricCard({
  label,
  value,
  subtext,
  variant = 'default',
}: {
  label: string
  value: string | number
  subtext?: string
  variant?: 'default' | 'danger' | 'success'
}) {
  const valueTone =
    variant === 'danger' ? 'text-ember' : variant === 'success' ? 'text-mint' : 'text-ink'

  return (
    <div className="rounded-2xl border border-border bg-white p-5 shadow-subtle">
      <p className="text-xs font-semibold uppercase tracking-wider text-steel">{label}</p>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${valueTone}`}>{value}</p>
      {subtext && <p className="mt-1 text-xs text-steel">{subtext}</p>}
    </div>
  )
}
