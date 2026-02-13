export function TimelineChart({
  data,
}: {
  data: { hour: string; total: number; blocked: number }[]
}) {
  if (!data || data.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-border bg-white p-6 text-sm text-steel shadow-subtle">
        No data for the last 24 hours
      </div>
    )
  }

  const maxTotal = Math.max(...data.map((d) => d.total), 0)
  if (maxTotal <= 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-border bg-white p-6 text-sm text-steel shadow-subtle">
        No data for the last 24 hours
      </div>
    )
  }

  const width = 1000
  const height = 200
  const paddingTop = 16
  const paddingBottom = 28
  const chartHeight = height - paddingTop - paddingBottom
  const groupWidth = width / data.length
  const barWidth = Math.max(6, groupWidth * 0.6)

  const formatHour = (hourKey: string): string => {
    const hh = hourKey.slice(11, 13)
    return `${hh}:00`
  }

  return (
    <div className="rounded-2xl border border-border bg-white p-5 shadow-subtle">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">Timeline (24h)</p>
        <p className="text-xs text-steel">Total vs Blocked</p>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={200}
        preserveAspectRatio="none"
        className="block"
      >
        {data.map((d, index) => {
          const totalH = (d.total / maxTotal) * chartHeight
          const blockedH = (d.blocked / maxTotal) * chartHeight
          const x = index * groupWidth + (groupWidth - barWidth) / 2
          const totalY = paddingTop + (chartHeight - totalH)
          const blockedY = paddingTop + (chartHeight - blockedH)

          const showLabel = index % 3 === 0
          const labelX = index * groupWidth + groupWidth / 2
          const labelY = height - 10

          return (
            <g key={d.hour}>
              <rect
                x={x}
                y={totalY}
                width={barWidth}
                height={totalH}
                fill="var(--muted)"
                rx={4}
              >
                <title>{`${formatHour(d.hour)} total ${d.total}, blocked ${d.blocked}`}</title>
              </rect>
              <rect
                x={x}
                y={blockedY}
                width={barWidth}
                height={blockedH}
                fill="var(--ember)"
                rx={4}
              >
                <title>{`${formatHour(d.hour)} total ${d.total}, blocked ${d.blocked}`}</title>
              </rect>
              {showLabel && (
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor="middle"
                  fontSize="10"
                  fill="var(--steel)"
                >
                  {formatHour(d.hour)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
