import { describe, expect, it } from 'vitest'

import { createColors } from '../utils/format'
import { createProgressBar, type ProgressStream } from '../utils/progress'

function sanitizeTerminalOutput(text: string): string {
  return text.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').replace(/\r/g, '')
}

function createMockStream(options: { isTTY: boolean; columns?: number }): { stream: ProgressStream; chunks: string[] } {
  const chunks: string[] = []
  const stream: ProgressStream = {
    isTTY: options.isTTY,
    columns: options.columns ?? 100,
    write(text: string): boolean {
      chunks.push(text)
      return true
    },
  }
  return { stream, chunks }
}

describe('progress', () => {
  it('renders and completes with newline in tty mode', () => {
    const { stream, chunks } = createMockStream({ isTTY: true, columns: 120 })
    const colors = createColors({ noColor: true, stdoutIsTTY: true })

    let now = 0
    const progress = createProgressBar({
      label: 'Scan',
      total: 4,
      colors,
      stream,
      now: () => now,
      minIntervalMs: 0,
    })

    progress.start('a.json')
    now += 1
    progress.tick('b.json')
    now += 1
    progress.tick('c.json')
    now += 1
    progress.tick('d.json')
    progress.done()

    const raw = chunks.join('')
    const output = sanitizeTerminalOutput(raw)
    expect(output).toContain('Scan')
    expect(output).toContain('4/4')
    expect(output).toContain('100%')
    expect(raw.endsWith('\n')).toBe(true)
  })

  it('does not render when stream is non-tty', () => {
    const { stream, chunks } = createMockStream({ isTTY: false })
    const colors = createColors({ noColor: true, stdoutIsTTY: true })
    const progress = createProgressBar({
      label: 'Scan',
      total: 2,
      colors,
      stream,
    })

    progress.start()
    progress.tick('x')
    progress.done()

    expect(chunks).toHaveLength(0)
  })

  it('treats zero total as complete', () => {
    const { stream, chunks } = createMockStream({ isTTY: true, columns: 100 })
    const colors = createColors({ noColor: true, stdoutIsTTY: true })
    const progress = createProgressBar({
      label: 'Scan',
      total: 0,
      colors,
      stream,
      minIntervalMs: 0,
    })

    progress.start()
    progress.done()

    const output = sanitizeTerminalOutput(chunks.join(''))
    expect(output).toContain('0/0')
    expect(output).toContain('100%')
  })

  it('throttles redraws by min interval', () => {
    const { stream, chunks } = createMockStream({ isTTY: true, columns: 100 })
    const colors = createColors({ noColor: true, stdoutIsTTY: true })

    let now = 0
    const progress = createProgressBar({
      label: 'Scan',
      total: 4,
      colors,
      stream,
      now: () => now,
      minIntervalMs: 100,
    })

    progress.start('a.json')
    const writesAfterStart = chunks.length

    now = 10
    progress.tick('b.json')
    expect(chunks.length).toBe(writesAfterStart)

    now = 150
    progress.tick('c.json')
    expect(chunks.length).toBeGreaterThan(writesAfterStart)

    progress.done()
  })
})
