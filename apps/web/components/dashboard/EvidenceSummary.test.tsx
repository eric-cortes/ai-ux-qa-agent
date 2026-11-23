import { screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { renderWithIntl, messages } from '@/test/render-with-intl'
import { evidence } from '@/test/fixtures'
import { EvidenceSummary } from './EvidenceSummary'

it('shows translated empty text, ICU counts and limits browser evidence to ten items', () => {
  const { rerender } = renderWithIntl(<EvidenceSummary evidence={null} />)
  expect(screen.getByText(messages.evidence.empty)).toBeInTheDocument()
  rerender(
    <EvidenceSummary
      evidence={{ ...evidence, consoleMessages: Array.from({ length: 12 }, (_, i) => `log-${i}`) }}
    />
  )
  expect(screen.getByText(/Unlabeled controls: 1/)).toHaveTextContent('Sampled tab stops: 1')
  const list = screen.getByText(messages.evidence.consoleMessages).parentElement!
  expect(within(list).getAllByRole('listitem')).toHaveLength(10)
  expect(screen.queryByText('log-10')).not.toBeInTheDocument()
})
