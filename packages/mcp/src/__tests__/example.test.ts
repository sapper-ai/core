import { describe, it, expect } from 'vitest'
import { mcpVersion } from '../index'

describe('@sapperai/mcp', () => {
  it('should export mcpVersion from core', () => {
    expect(mcpVersion).toBe('0.1.0')
  })
})
