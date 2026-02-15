export function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid gap-1.5">
      <h2 className="text-2xl font-semibold tracking-tight text-ink">{title}</h2>
      <p className="text-sm leading-relaxed text-steel">{description}</p>
    </div>
  )
}

