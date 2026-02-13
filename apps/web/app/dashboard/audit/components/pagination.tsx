'use client'

export function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}) {
  const canPrev = page > 1
  const canNext = page < totalPages

  return (
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={!canPrev}
        className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-ink shadow-subtle transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
      >
        &lt; Prev
      </button>
      <p className="text-sm text-steel">
        Page <span className="font-semibold tabular-nums text-ink">{page}</span> of{' '}
        <span className="font-semibold tabular-nums text-ink">{totalPages}</span>
      </p>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={!canNext}
        className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-ink shadow-subtle transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
      >
        Next &gt;
      </button>
    </div>
  )
}
