import { fireEvent, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { renderWithIntl } from '@/test/render-with-intl'
import { Input } from './Input'

it('supports variants, sizes, function classes, disabled and native input props', () => {
  const change = vi.fn()
  const { rerender } = renderWithIntl(
    <Input
      aria-label="Email"
      variant="error"
      size="sm"
      className={() => 'custom'}
      onChange={change}
    />
  )
  const input = screen.getByRole('textbox')
  expect(input).toHaveClass('border-danger', 'text-xs', 'custom')
  fireEvent.change(input, { target: { value: 'a@example.com' } })
  expect(change).toHaveBeenCalled()
  rerender(
    <Input aria-label="Email" variant="default" size="md" disabled autoComplete="username" />
  )
  expect(input).toHaveClass('border-line', 'text-sm')
  expect(input).toBeDisabled()
  expect(input).toHaveAttribute('autocomplete', 'username')
})
