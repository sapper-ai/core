export interface Colors {
  olive: string
  dim: string
  bold: string
  red: string
  yellow: string
  reset: string
}

function supportsTruecolor(env: NodeJS.ProcessEnv): boolean {
  const value = env.COLORTERM?.toLowerCase()
  if (!value) return false
  return value.includes('truecolor') || value.includes('24bit')
}

export function createColors(
  options: { noColor?: boolean; env?: NodeJS.ProcessEnv; stdoutIsTTY?: boolean } = {}
): Colors {
  const env = options.env ?? process.env
  const stdoutIsTTY = options.stdoutIsTTY ?? process.stdout.isTTY

  const disabled = env.NO_COLOR !== undefined || options.noColor === true || stdoutIsTTY !== true
  if (disabled) {
    return { olive: '', dim: '', bold: '', red: '', yellow: '', reset: '' }
  }

  const olive = supportsTruecolor(env) ? '\x1b[38;2;107;142;35m' : '\x1b[32m'
  return {
    olive,
    dim: '\x1b[2m',
    bold: '\x1b[1m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    reset: '\x1b[0m',
  }
}

// Header: "  sapper-ai <command>"
export function header(command: string, colors: Colors): string {
  const name = colors.olive ? `${colors.olive}sapper-ai${colors.reset}` : 'sapper-ai'
  return `  ${name} ${command}`
}

// Risk color by value (>= 0.8 red+bold, 0.5~0.8 yellow, < 0.5 dim)
export function riskColor(risk: number, colors: Colors): string {
  if (risk >= 0.8) return `${colors.bold}${colors.red}`
  if (risk >= 0.5) return colors.yellow
  return colors.dim
}

export function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, '')
}

export function truncateToWidth(text: string, maxWidth: number): string {
  if (maxWidth <= 0) return ''
  if (text.length <= maxWidth) return text

  if (maxWidth <= 3) {
    return '.'.repeat(maxWidth)
  }

  return `...${text.slice(text.length - (maxWidth - 3))}`
}

export function padRight(text: string, width: number): string {
  if (text.length >= width) return text
  return text + ' '.repeat(width - text.length)
}

export function padRightVisual(text: string, width: number): string {
  const visLen = stripAnsi(text).length
  if (visLen >= width) return text
  return text + ' '.repeat(width - visLen)
}

export function padLeft(text: string, width: number): string {
  if (text.length >= width) return text
  return ' '.repeat(width - text.length) + text
}

// Aligned table (Vercel style, no box borders).
// ANSI-aware: stripAnsi based visible width.
export function table(headers: string[], rows: string[][], colors: Colors): string {
  const columnCount = headers.length
  const normalizedRows = rows.map((row) => {
    const out = row.slice(0, columnCount)
    while (out.length < columnCount) out.push('')
    return out
  })

  const headerRow = headers.map((h) => (colors.dim ? `${colors.dim}${h}${colors.reset}` : h))
  const all = [headerRow, ...normalizedRows]

  const widths = headers.map((_, col) => Math.max(0, ...all.map((r) => stripAnsi(r[col] ?? '').length)))

  const sep = '  '
  const lines: string[] = []

  lines.push(`  ${headerRow.map((cell, i) => padRightVisual(cell, widths[i]!)).join(sep)}`.trimEnd())
  for (const row of normalizedRows) {
    lines.push(`  ${row.map((cell, i) => padRightVisual(cell, widths[i]!)).join(sep)}`.trimEnd())
  }

  return lines.join('\n')
}

