import { redirect } from 'next/navigation'

type SearchParams = Record<string, string | string[] | undefined>

function toSearchParams(searchParams: SearchParams): URLSearchParams {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      for (const entry of value) params.append(key, entry)
      continue
    }
    params.set(key, value)
  }

  return params
}

export default function DemoPage({ searchParams }: { searchParams: SearchParams }) {
  const demo = typeof searchParams.demo === 'string' ? searchParams.demo : null

  const wantsAgent = typeof searchParams.scenario === 'string' || typeof searchParams.executeBlocked === 'string'
  const wantsAdversary = typeof searchParams.useDefaultPolicy === 'string' || typeof searchParams.policy === 'string'

  const params = toSearchParams(searchParams)
  if (!demo && wantsAgent) params.set('demo', 'agent')
  if (!demo && !wantsAgent && wantsAdversary) params.set('demo', 'adversary')

  const qs = params.toString()
  redirect(qs ? `/playground?${qs}` : '/playground')
}
