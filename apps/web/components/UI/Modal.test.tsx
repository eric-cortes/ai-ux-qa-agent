import { useState } from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { expect, it } from 'vitest'
import { renderWithIntl } from '@/test/render-with-intl'
import { Modal } from './Modal'
import { Button } from './Button'

function Example() {
  const [open, setOpen] = useState(false)
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Findings"
      closeLabel="Close"
      size="lg"
      className={() => 'custom'}
      trigger={<Button>Open</Button>}
    >
      Content
    </Modal>
  )
}
it('closes on Escape and restores trigger focus', async () => {
  renderWithIntl(<Example />)
  const trigger = screen.getByRole('button', { name: 'Open' })
  trigger.focus()
  fireEvent.click(trigger)
  const dialog = await screen.findByRole('dialog')
  expect(dialog).toHaveClass('max-w-4xl', 'custom')
  expect(dialog).toHaveAccessibleName('Findings')
  fireEvent.keyDown(screen.getByRole('button', { name: 'Close' }), { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  await waitFor(() => expect(trigger).toHaveFocus())
})
it.each([
  ['sm', 'max-w-sm'],
  ['md', 'max-w-xl'],
  ['lg', 'max-w-4xl'],
  ['full', 'max-w-7xl'],
] as const)('supports %s size', (size, expected) => {
  renderWithIntl(
    <Modal open onOpenChange={() => {}} title="Title" closeLabel="Close" size={size}>
      Body
    </Modal>
  )
  expect(screen.getByRole('dialog')).toHaveClass(expected)
})
