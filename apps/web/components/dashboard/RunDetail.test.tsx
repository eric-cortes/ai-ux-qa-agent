import { screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { renderWithIntl, messages } from '@/test/render-with-intl'
import { run } from '@/test/fixtures'
import { RunDetail } from './RunDetail'

it('renders an empty state then detail without revealing worker error text', () => {
  const { rerender } = renderWithIntl(<RunDetail run={null} />)
  expect(screen.getByText(messages.detail.empty)).toBeInTheDocument()
  rerender(<RunDetail run={{ ...run, status: 'failed', error_message: 'PRIVATE ERROR' }} />)
  expect(screen.getByRole('alert')).toHaveTextContent(messages.errors.workerFailed)
  expect(screen.queryByText('PRIVATE ERROR')).not.toBeInTheDocument()
  expect(screen.getByRole('img')).toHaveAccessibleName(`Screenshot for run ${run.id}`)
  expect(screen.getByText(messages.detail.project)).toBeInTheDocument()
})
