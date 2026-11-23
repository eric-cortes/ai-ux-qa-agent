import { screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { renderWithIntl } from '@/test/render-with-intl'
import { StatusBadge } from './StatusBadge'

it.each([
  ['queued', 'Queued'],
  ['running', 'Running'],
  ['analyzing', 'Analyzing'],
  ['completed', 'Completed'],
  ['failed', 'Failed'],
  ['cancelled', 'Cancelled'],
] as const)('translates %s', (value, label) => {
  renderWithIntl(<StatusBadge status={value} />)
  expect(screen.getByText(label)).toHaveClass('text-xs')
})
