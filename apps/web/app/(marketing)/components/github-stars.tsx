const GITHUB_REPO_API = 'https://api.github.com/repos/sapper-ai/sapperai'
const DEFAULT_STARS = 1600
const CACHE_SECONDS = 3600

function formatStarCount(stars: number): string {
  const formatted = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(stars)

  return formatted.replace('K', 'k')
}

async function fetchStarCount(): Promise<number> {
  const headers: HeadersInit = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'sapper-ai-web',
  }

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  }

  try {
    const response = await fetch(GITHUB_REPO_API, {
      headers,
      next: { revalidate: CACHE_SECONDS },
    })

    if (!response.ok) return DEFAULT_STARS

    const payload = (await response.json()) as { stargazers_count?: unknown }
    if (typeof payload.stargazers_count === 'number' && Number.isFinite(payload.stargazers_count)) {
      return payload.stargazers_count
    }

    return DEFAULT_STARS
  } catch {
    return DEFAULT_STARS
  }
}

export async function GitHubStars() {
  const stars = await fetchStarCount()
  return <>{formatStarCount(stars)}</>
}

