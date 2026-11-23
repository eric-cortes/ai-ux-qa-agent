import { expect, it } from 'vitest'
import { formatDate } from './format-date'

it('formats dates consistently in English and UTC', () => {
  expect(formatDate('2026-01-01T14:00:00+02:00')).toBe(formatDate('2026-01-01T12:00:00Z'))
  expect(formatDate('2026-01-01T12:00:00Z')).toContain('Jan 1, 2026')
  expect(formatDate('2026-01-01T12:00:00Z')).toContain('UTC')
})
