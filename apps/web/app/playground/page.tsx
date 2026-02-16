import { redirect } from 'next/navigation'

type SearchParams = Record<string, string | string[] | undefined>

function toQueryString(searchParams: SearchParams, omitKeys: Set<string>): string {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(searchParams)) {
    if (omitKeys.has(key) || value === undefined) continue
    if (Array.isArray(value)) {
      for (const entry of value) params.append(key, entry)
      continue
    }
    params.set(key, value)
  }

  const serialized = params.toString()
  return serialized.length > 0 ? `?${serialized}` : ''
}

export default function PlaygroundIndexPage({ searchParams }: { searchParams: SearchParams }) {
  const demo = typeof searchParams.demo === 'string' ? searchParams.demo : null

  const target =
    demo === 'skill-scan' || demo === 'upload'
      ? '/playground/skill-scan'
      : demo === 'config'
          ? '/playground/config'
        : demo === 'adversary' || demo === 'campaign'
          ? '/playground/adversary'
          : demo === 'runtime' || demo === 'detect'
            ? '/playground/runtime'
            : '/playground/runtime'

  const qs = toQueryString(searchParams, new Set(['demo']))
  redirect(`${target}${qs}`)
}
