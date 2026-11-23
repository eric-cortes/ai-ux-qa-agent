import { screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { renderWithIntl, messages } from '@/test/render-with-intl'
import { PipelinePanel } from './PipelinePanel'

it('renders every translated pipeline step and the findings action', () => {
  renderWithIntl(<PipelinePanel findingsTrigger={<button>Open findings (2 findings)</button>} />)
  for (const step of messages.pipeline.steps) expect(screen.getByText(step)).toBeInTheDocument()
  expect(screen.getAllByRole('listitem')).toHaveLength(messages.pipeline.steps.length)
  expect(screen.getByRole('button')).toHaveAccessibleName('Open findings (2 findings)')
})
