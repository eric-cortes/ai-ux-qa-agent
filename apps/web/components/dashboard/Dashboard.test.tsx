import { act, fireEvent, screen, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { renderWithIntl, messages } from '@/test/render-with-intl'
import { run, secondRun, evidence } from '@/test/fixtures'
import { Dashboard } from './Dashboard'

const signals: AbortSignal[] = []
let requests: string[] = []
async function flush() {
  await act(async () => {
    for (let index = 0; index < 20; index++) await Promise.resolve()
  })
}
beforeEach(() => {
  vi.useFakeTimers()
  signals.length = 0
  requests = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      requests.push(url)
      if (init?.signal) signals.push(init.signal)
      if (url.endsWith('/runs')) return Response.json([run, secondRun])
      if (url.endsWith('/findings')) return Response.json([])
      if (url.endsWith('/evidence')) return Response.json(evidence)
      return Response.json(url.endsWith(secondRun.id) ? secondRun : run)
    })
  )
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('loads, auto-selects, polls every 4000ms and aborts/clears polling on unmount', async () => {
  const { unmount } = renderWithIntl(<Dashboard />)
  await flush()
  expect(screen.getByRole('button', { pressed: true })).toHaveTextContent(run.id)
  const initial = requests.length
  await act(async () => {
    vi.advanceTimersByTime(3999)
  })
  expect(requests).toHaveLength(initial)
  await act(async () => {
    vi.advanceTimersByTime(1)
  })
  await flush()
  expect(requests).toHaveLength(initial + 4)
  unmount()
  expect(signals.every(signal => signal.aborted)).toBe(true)
  const count = requests.length
  await act(async () => {
    vi.advanceTimersByTime(8000)
  })
  expect(requests).toHaveLength(count)
})
it('ignores a late old-run response even when the server ignores abort', async () => {
  let release: ((response: Response) => void) | undefined
  const fetcher = vi.mocked(fetch)
  fetcher.mockImplementation(async (input, init) => {
    const url = String(input)
    if (init?.signal) signals.push(init.signal)
    if (url.endsWith('/runs')) return Response.json([run, secondRun])
    if (url.endsWith('/findings')) return Response.json([])
    if (url.endsWith('/evidence')) return Response.json(evidence)
    if (url.endsWith(run.id))
      return new Promise<Response>(resolve => {
        release = resolve
      })
    return Response.json(secondRun)
  })
  renderWithIntl(<Dashboard />)
  await flush()
  fireEvent.click(screen.getByRole('button', { name: new RegExp(secondRun.id) }))
  await flush()
  expect(screen.getByRole('img')).toHaveAccessibleName(`Screenshot for run ${secondRun.id}`)
  await act(async () => {
    release?.(Response.json({ ...run, error_message: 'OLD PRIVATE ERROR' }))
  })
  await flush()
  expect(screen.getByRole('img')).toHaveAccessibleName(`Screenshot for run ${secondRun.id}`)
  expect(screen.queryByText(messages.errors.workerFailed)).not.toBeInTheDocument()
})
it('shows translated API failures without raw response text and retains form values', async () => {
  renderWithIntl(<Dashboard />)
  await flush()
  fireEvent.change(screen.getByLabelText(messages.form.projectId), { target: { value: 'keep-me' } })
  vi.mocked(fetch).mockResolvedValue(new Response('PRIVATE TOKEN', { status: 500 }))
  fireEvent.click(screen.getByRole('button', { name: messages.form.queue }))
  await flush()
  expect(screen.getByRole('alert')).toHaveTextContent(messages.errors.queueRun)
  expect(screen.queryByText('PRIVATE TOKEN')).not.toBeInTheDocument()
  expect(screen.getByLabelText(messages.form.projectId)).toHaveValue('keep-me')
})

it('translates list failures without exposing the response body', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response('PRIVATE LIST FAILURE', { status: 500 }))
  renderWithIntl(<Dashboard />)
  await flush()
  expect(screen.getByRole('alert')).toHaveTextContent(messages.errors.loadRuns)
  expect(screen.queryByText('PRIVATE LIST FAILURE')).not.toBeInTheDocument()
})

it('translates detail failures without exposing the response body', async () => {
  vi.mocked(fetch).mockImplementation(async input => {
    if (String(input).endsWith('/runs')) return Response.json([run])
    return new Response('PRIVATE DETAIL FAILURE', { status: 500 })
  })
  renderWithIntl(<Dashboard />)
  await flush()
  expect(screen.getByRole('alert')).toHaveTextContent(messages.errors.loadDetail)
  expect(screen.queryByText('PRIVATE DETAIL FAILURE')).not.toBeInTheDocument()
})

it('translates clear failures and preserves runs', async () => {
  renderWithIntl(<Dashboard />)
  await flush()
  const previous = vi.mocked(fetch).getMockImplementation()!
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    if (init?.method === 'DELETE') return new Response('PRIVATE CLEAR FAILURE', { status: 500 })
    return previous(input, init)
  })
  fireEvent.click(screen.getByRole('button', { name: messages.form.clear }))
  await flush()
  fireEvent.click(screen.getByRole('button', { name: messages.common.confirm }))
  await flush()
  expect(screen.getByRole('alert')).toHaveTextContent(messages.errors.clearRuns)
  expect(screen.getByRole('button', { pressed: true })).toHaveTextContent(run.id)
  expect(screen.queryByText('PRIVATE CLEAR FAILURE')).not.toBeInTheDocument()
})

it('shows detail and empty optional data when findings and evidence return 404', async () => {
  vi.mocked(fetch).mockImplementation(async input => {
    const url = String(input)
    if (url.endsWith('/runs')) return Response.json([run])
    if (url.endsWith('/findings') || url.endsWith('/evidence'))
      return new Response('Not found', { status: 404 })
    return Response.json(run)
  })
  renderWithIntl(<Dashboard />)
  await flush()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByRole('img')).toHaveAccessibleName(`Screenshot for run ${run.id}`)
  expect(screen.getByText(messages.evidence.empty)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Open findings/ }))
  await flush()
  expect(screen.getByText(messages.findings.empty)).toBeInTheDocument()
})

for (const endpoint of ['findings', 'evidence']) {
  it.each(['500', 'network', 'malformed JSON'])(
    `translates ${endpoint} %s failures and clears the alert after polling recovers`,
    async failure => {
      const previous = vi.mocked(fetch).getMockImplementation()!
      let failing = true
      vi.mocked(fetch).mockImplementation(async (input, init) => {
        if (failing && String(input).endsWith(`/${endpoint}`)) {
          if (failure === 'network') throw new Error('PRIVATE OPTIONAL FAILURE')
          if (failure === 'malformed JSON') return new Response('PRIVATE OPTIONAL FAILURE')
          return new Response('PRIVATE OPTIONAL FAILURE', { status: 500 })
        }
        return previous(input, init)
      })
      renderWithIntl(<Dashboard />)
      await flush()
      expect(screen.getByRole('alert')).toHaveTextContent(messages.errors.loadDetail)
      expect(screen.queryByText('PRIVATE OPTIONAL FAILURE')).not.toBeInTheDocument()
      failing = false
      await act(async () => {
        vi.advanceTimersByTime(4000)
      })
      await flush()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.getByRole('img')).toHaveAccessibleName(`Screenshot for run ${run.id}`)
    }
  )
}

it('clears a runs error after a successful polling refresh', async () => {
  const previous = vi.mocked(fetch).getMockImplementation()!
  let failing = true
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    if (failing && String(input).endsWith('/runs')) return new Response(null, { status: 500 })
    return previous(input, init)
  })
  renderWithIntl(<Dashboard />)
  await flush()
  expect(screen.getByRole('alert')).toHaveTextContent(messages.errors.loadRuns)
  failing = false
  await act(async () => {
    vi.advanceTimersByTime(4000)
  })
  await flush()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { pressed: true })).toHaveTextContent(run.id)
})

it.each(['queueRun', 'clearRuns'] as const)(
  'preserves a %s error when list and detail polling succeed',
  async errorKey => {
    renderWithIntl(<Dashboard />)
    await flush()
    const previous = vi.mocked(fetch).getMockImplementation()!
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (init?.method === 'POST' || init?.method === 'DELETE')
        return new Response(null, { status: 500 })
      return previous(input, init)
    })
    if (errorKey === 'queueRun') {
      fireEvent.click(screen.getByRole('button', { name: messages.form.queue }))
    } else {
      fireEvent.click(screen.getByRole('button', { name: messages.form.clear }))
      await flush()
      fireEvent.click(screen.getByRole('button', { name: messages.common.confirm }))
    }
    await flush()
    expect(screen.getByRole('alert')).toHaveTextContent(messages.errors[errorKey])
    await act(async () => {
      vi.advanceTimersByTime(4000)
    })
    await flush()
    expect(screen.getByRole('alert')).toHaveTextContent(messages.errors[errorKey])
  }
)
