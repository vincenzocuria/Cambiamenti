import { describe, expect, it } from 'vitest'
import { resolveTheme } from '../lib/theme'

describe('resolveTheme', () => {
  it('Automatico segue il sistema', () => {
    expect(resolveTheme('auto', true)).toBe('dark')
    expect(resolveTheme('auto', false)).toBe('light')
  })
  it('una scelta esplicita vince sul sistema', () => {
    expect(resolveTheme('soft', true)).toBe('soft')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
})
