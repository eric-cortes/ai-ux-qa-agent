import { useState } from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { renderWithIntl, messages } from '@/test/render-with-intl'
import { ConfirmDialog } from './ConfirmDialog'
import { Button } from './Button'

it('cancels without confirming and confirms only the explicit destructive action', async () => {
  const confirm = vi.fn()
  function Example() {
    const [open, setOpen] = useState(false)
    return (
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={messages.common.confirmTitle}
        description={messages.common.confirmDescription}
        confirmLabel={messages.common.confirm}
        cancelLabel={messages.common.cancel}
        onConfirm={confirm}
        className={() => 'custom'}
        trigger={<Button>Clear</Button>}
      />
    )
  }
  renderWithIntl(<Example />)
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
  expect(await screen.findByRole('alertdialog')).toHaveClass('custom')
  fireEvent.click(screen.getByRole('button', { name: messages.common.cancel }))
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect(confirm).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
  fireEvent.click(await screen.findByRole('button', { name: messages.common.confirm }))
  expect(confirm).toHaveBeenCalledTimes(1)
})
