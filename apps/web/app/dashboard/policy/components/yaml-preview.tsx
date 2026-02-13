export function YamlPreview({ yaml }: { yaml: string }) {
  return (
    <div className="grid gap-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-steel">YAML Preview</p>
      <textarea
        readOnly
        value={yaml}
        className="min-h-[300px] w-full resize-none rounded-xl bg-[#0a0a0a] p-4 font-mono text-xs leading-relaxed text-gray-100 outline-none"
      />
    </div>
  )
}
