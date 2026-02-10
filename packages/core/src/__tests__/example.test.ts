import { describe, it, expect } from 'vitest'
import { coreVersion } from '../index'

describe('@sapperai/core', () => {
  it('should export coreVersion from types', () => {
    expect(coreVersion).toBe('0.1.0')
  })
})
