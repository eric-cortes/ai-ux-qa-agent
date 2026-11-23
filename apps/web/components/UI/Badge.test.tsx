import { screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { renderWithIntl } from '@/test/render-with-intl'
import { Badge } from './Badge'

it.each(['info', 'progress', 'warning', 'success', 'danger', 'neutral'] as const)(
  'renders %s with passthrough props and function classes',
  tone => {
    renderWithIntl(
      <Badge
        tone={tone}
        data-testid="badge"
        className={state => (state.tone === tone ? 'custom' : '')}
      >
        Status
      </Badge>
    )
    expect(screen.getByTestId('badge')).toHaveClass('custom', 'text-xs')
    expect(screen.getByTestId('badge')).toHaveTextContent('Status')
  }
)
