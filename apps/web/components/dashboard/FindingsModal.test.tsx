import { screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { renderWithIntl, messages } from '@/test/render-with-intl'
import { finding } from '@/test/fixtures'
import { FindingsModal } from './FindingsModal'

it('shows translated empty text and finding category, confidence, verification and outside link', () => {
  const { rerender } = renderWithIntl(<FindingsModal open onOpenChange={() => {}} findings={[]} />)
  expect(screen.getByText(messages.findings.empty)).toBeInTheDocument()
  rerender(<FindingsModal open onOpenChange={() => {}} findings={[finding]} />)
  expect(screen.getByRole('article')).toHaveTextContent('Category: Accessibility')
  expect(screen.getByRole('article')).toHaveTextContent('Confidence: 90%')
  expect(screen.getByRole('article')).toHaveTextContent('Verification: Needs human review')
  expect(screen.getByRole('link')).toHaveAttribute('target', '_blank')
  expect(screen.getByRole('link')).toHaveAttribute('rel', 'noreferrer')
  expect(screen.getAllByRole('listitem')).toHaveLength(2)
})
