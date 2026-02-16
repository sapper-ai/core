import type { Colors } from './format'
import { truncateToWidth } from './format'

export interface ProgressStream {
  isTTY?: boolean
  columns?: number
  write(text: string): boolean
}

export interface ProgressBarOptions {
  label: string
  total: number
  colors: Colors
  stream?: ProgressStream
  now?: () => number
  minIntervalMs?: number
  minBarWidth?: number
  maxBarWidth?: number
}

const DEFAULT_MIN_INTERVAL_MS = 100
const DEFAULT_MIN_BAR_WIDTH = 10
const DEFAULT_MAX_BAR_WIDTH = 40

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export class ProgressBar {
  private readonly stream: ProgressStream
  private readonly now: () => number
  private readonly minIntervalMs: number
  private readonly minBarWidth: number
  private readonly maxBarWidth: number
  private readonly enabled: boolean
  private current = 0
  private detail: string | undefined
  private lastRenderAt = 0
  private rendered = false
  private finished = false

  constructor(private readonly options: ProgressBarOptions) {
    this.stream = options.stream ?? process.stdout
    this.now = options.now ?? Date.now
    this.minIntervalMs = options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS
    this.minBarWidth = options.minBarWidth ?? DEFAULT_MIN_BAR_WIDTH
    this.maxBarWidth = options.maxBarWidth ?? DEFAULT_MAX_BAR_WIDTH
    this.enabled = this.stream.isTTY === true
  }

  start(detail?: string): void {
    if (!this.enabled) return
    this.detail = detail
    this.render(true)
  }

  tick(detail?: string): void {
    if (!this.enabled || this.finished) return
    this.current += 1
    if (this.options.total > 0 && this.current > this.options.total) {
      this.current = this.options.total
    }
    this.detail = detail
    this.render(false)
  }

  done(detail?: string): void {
    if (!this.enabled || this.finished) return
    if (this.options.total > 0) {
      this.current = this.options.total
    }
    this.detail = detail
    this.render(true)
    this.stream.write('\n')
    this.finished = true
  }

  private render(force: boolean): void {
    const now = this.now()
    if (!force && this.rendered && now - this.lastRenderAt < this.minIntervalMs && !this.isComplete()) {
      return
    }

    const line = this.renderLine()
    this.stream.write(`\r\x1b[2K${line}`)
    this.lastRenderAt = now
    this.rendered = true
  }

  private isComplete(): boolean {
    if (this.options.total <= 0) {
      return true
    }
    return this.current >= this.options.total
  }

  private renderLine(): string {
    const total = this.options.total
    const safeCurrent = total > 0 ? clamp(this.current, 0, total) : 0
    const ratio = total > 0 ? safeCurrent / total : 1
    const percent = Math.round(ratio * 100)

    const countText = `${safeCurrent}/${total}`
    const percentText = `${String(percent).padStart(3, ' ')}%`
    const suffix = `${countText} ${percentText}`

    const columns = this.stream.columns ?? 80
    const label = this.options.label
    const baseReserved = 2 + label.length + 1 + 2 + 2 + 1 + suffix.length
    const maxFitWidth = Math.max(1, columns - baseReserved)
    const availableForBar =
      maxFitWidth >= this.minBarWidth ? Math.min(this.maxBarWidth, maxFitWidth) : maxFitWidth
    const bar = this.renderBar(availableForBar, ratio)

    const detailPrefix = '  '
    const detailMaxWidth = Math.max(0, columns - (2 + label.length + 1 + 2 + availableForBar + 2 + suffix.length + detailPrefix.length))
    const rawDetail = this.detail ? truncateToWidth(this.detail, detailMaxWidth) : ''
    const detail = rawDetail
      ? `${detailPrefix}${this.options.colors.dim}${rawDetail}${this.options.colors.reset}`
      : ''

    return `  ${label} [${bar}] ${suffix}${detail}`
  }

  private renderBar(width: number, ratio: number): string {
    if (width <= 0) return ''

    const safeRatio = clamp(ratio, 0, 1)
    const filled = Math.floor(safeRatio * width)

    if (filled >= width) {
      const body = '='.repeat(width)
      return this.options.colors.olive ? `${this.options.colors.olive}${body}${this.options.colors.reset}` : body
    }

    const visibleFilled = Math.max(1, filled)
    const leadCount = Math.max(0, visibleFilled - 1)
    const lead = '='.repeat(leadCount)
    const head = '>'
    const tail = '-'.repeat(Math.max(0, width - visibleFilled))
    const filledPart = this.options.colors.olive ? `${this.options.colors.olive}${lead}${head}${this.options.colors.reset}` : `${lead}${head}`
    const emptyPart = this.options.colors.dim ? `${this.options.colors.dim}${tail}${this.options.colors.reset}` : tail
    return `${filledPart}${emptyPart}`
  }
}

export function createProgressBar(options: ProgressBarOptions): ProgressBar {
  return new ProgressBar(options)
}
