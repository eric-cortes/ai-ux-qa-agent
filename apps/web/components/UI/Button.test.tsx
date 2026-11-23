import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithIntl } from '@/test/render-with-intl'
import { Button } from './Button'

describe('Button', () => {
  it.each(['primary', 'secondary', 'outline', 'ghost', 'danger'] as const)(
    'renders %s with both sizes and function classes',
    variant => {
      const { rerender } = renderWithIntl(
        <Button variant={variant} size="sm" className={() => 'custom'}>
          Action
        </Button>
      )
      expect(screen.getByRole('button')).toHaveClass('text-xs', 'custom')
      rerender(
        <Button variant={variant} size="md">
          Action
        </Button>
      )
      expect(screen.getByRole('button')).toHaveClass('text-sm')
    }
  )
  it('keeps both labels mounted and disables activation while loading', () => {
    const click = vi.fn()
    renderWithIntl(
      <Button loading loadingText="Working" onClick={click}>
        Action
      </Button>
    )
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toBeDisabled()
    expect(screen.getByText('Action')).toHaveClass('invisible')
    expect(screen.getByText('Working')).not.toHaveClass('invisible')
    fireEvent.click(button)
    expect(click).not.toHaveBeenCalled()
  })
  it('uses a native keyboard-operable button and respects disabled', () => {
    const click = vi.fn()
    const { rerender } = renderWithIntl(<Button onClick={click}>Action</Button>)
    const button = screen.getByRole('button')
    expect(button.tagName).toBe('BUTTON')
    fireEvent.keyDown(button, { key: 'Enter' })
    fireEvent.keyUp(button, { key: 'Enter' })
    fireEvent.click(button)
    fireEvent.keyDown(button, { key: ' ' })
    fireEvent.keyUp(button, { key: ' ' })
    fireEvent.click(button)
    expect(click).toHaveBeenCalledTimes(2)
    rerender(
      <Button disabled onClick={click}>
        Action
      </Button>
    )
    fireEvent.click(button)
    expect(click).toHaveBeenCalledTimes(2)
  })
})
