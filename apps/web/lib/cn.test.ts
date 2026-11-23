import { describe, expect, it } from 'vitest'
import { cn } from './cn'

describe('cn', () => {
  it('merges conflicting utilities and conditional classes', () => {
    expect(cn('p-2 text-ink', false && 'hidden', { 'p-4': true })).toBe('text-ink p-4')
  })
})
