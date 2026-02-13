const PRIVATE_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^\[::1\]/,
  /^localhost/i,
]

export function isPrivateUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString)
    return PRIVATE_RANGES.some((re) => re.test(url.hostname))
  } catch {
    return true
  }
}
