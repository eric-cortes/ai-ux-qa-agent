import { fireEvent, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { renderWithIntl, messages } from '@/test/render-with-intl'
import { run } from '@/test/fixtures'
import { RunList } from './RunList'

it('shows loading, empty, selection and refresh states with translated text', () => {
  const select = vi.fn()
  const refresh = vi.fn()
  const { rerender } = renderWithIntl(
    <RunList runs={[]} selectedId={null} loading onSelect={select} onRefresh={refresh} />
  )
  expect(screen.getByRole('status')).toHaveTextContent(messages.runs.loading)
  expect(screen.queryByText(messages.runs.empty)).not.toBeInTheDocument()
  rerender(
    <RunList runs={[]} selectedId={null} loading={false} onSelect={select} onRefresh={refresh} />
  )
  expect(screen.getByText(messages.runs.empty)).toBeInTheDocument()
  rerender(
    <RunList
      runs={[run]}
      selectedId={run.id}
      loading={false}
      onSelect={select}
      onRefresh={refresh}
    />
  )
  const item = screen.getByRole('button', { pressed: true })
  expect(item).toHaveClass('border-selected')
  fireEvent.click(item)
  expect(select).toHaveBeenCalledWith(run.id)
  fireEvent.click(screen.getByRole('button', { name: messages.runs.refresh }))
  expect(refresh).toHaveBeenCalledOnce()
})
