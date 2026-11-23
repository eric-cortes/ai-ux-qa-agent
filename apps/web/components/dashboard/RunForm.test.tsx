import { fireEvent, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { renderWithIntl, messages } from '@/test/render-with-intl'
import { RunForm, initialForm } from './RunForm'

it('ties visible translated labels to named inputs with correct types and autocomplete', () => {
  const change = vi.fn()
  const submit = vi.fn()
  const { rerender } = renderWithIntl(
    <RunForm
      value={{ ...initialForm, projectId: 'retained' }}
      onChange={change}
      onSubmit={submit}
      submitting={false}
      clearing={false}
      clearTrigger={null}
    />
  )
  const fields = [
    ['projectId', 'text', 'off'],
    ['environmentId', 'text', 'off'],
    ['targetUrl', 'text', 'url'],
    ['loginEmail', 'email', 'username'],
    ['loginPassword', 'password', 'current-password'],
  ] as const
  for (const [name, type, autoComplete] of fields) {
    const input = screen.getByLabelText(messages.form[name])
    expect(input).toHaveAttribute('name', name)
    expect(input).toHaveAttribute('type', type)
    expect(input).toHaveAttribute('autocomplete', autoComplete)
  }
  expect(screen.getByLabelText(messages.form.targetUrl)).toHaveAttribute('inputmode', 'url')
  expect(screen.getByLabelText(messages.form.projectId)).toHaveValue('retained')
  fireEvent.change(screen.getByLabelText(messages.form.loginEmail), {
    target: { value: 'a@example.com' },
  })
  expect(change).toHaveBeenCalledWith({
    ...initialForm,
    projectId: 'retained',
    loginEmail: 'a@example.com',
  })
  fireEvent.click(screen.getByRole('button', { name: messages.form.queue }))
  expect(submit).toHaveBeenCalledOnce()
  rerender(
    <RunForm
      value={initialForm}
      onChange={change}
      onSubmit={submit}
      submitting
      clearing={false}
      clearTrigger={null}
    />
  )
  for (const [name] of fields) expect(screen.getByLabelText(messages.form[name])).toBeDisabled()
  expect(screen.getByRole('button')).toHaveTextContent(messages.form.queueing)
})
