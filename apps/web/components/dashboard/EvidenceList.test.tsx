import { screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { renderWithIntl, messages } from '@/test/render-with-intl'
import { EvidenceList } from './EvidenceList'

it('renders supplied evidence as list items, including an empty list', () => {
  const { rerender } = renderWithIntl(
    <EvidenceList title={messages.evidence.actions} items={['Navigate', 'Click']} />
  )
  expect(screen.getByRole('heading')).toHaveTextContent(messages.evidence.actions)
  expect(screen.getAllByRole('listitem')).toHaveLength(2)
  rerender(<EvidenceList title={messages.evidence.actions} items={[]} />)
  expect(screen.queryAllByRole('listitem')).toHaveLength(0)
})
