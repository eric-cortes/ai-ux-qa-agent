import { screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { renderWithIntl } from '@/test/render-with-intl'
import { SeverityBadge } from './SeverityBadge'

it.each([
  ['low', 'Low'],
  ['medium', 'Medium'],
  ['high', 'High'],
  ['critical', 'Critical'],
] as const)('translates %s', (value, label) => {
  renderWithIntl(<SeverityBadge severity={value} />)
  expect(screen.getByText(label)).toHaveClass('text-xs')
})
