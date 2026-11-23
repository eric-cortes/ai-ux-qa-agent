import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, listRuns, getRunBundle, createRun, clearRuns } from './api'
import { run, finding, evidence } from '@/test/fixtures'
import { initialForm } from '@/components/dashboard/RunForm'

afterEach(() => vi.unstubAllGlobals())
describe('API', () => {
  it('passes abort signals and retrieves the complete bundle', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(run))
      .mockResolvedValueOnce(Response.json([finding]))
      .mockResolvedValueOnce(Response.json(evidence))
    vi.stubGlobal('fetch', fetcher)
    const signal = new AbortController().signal
    expect(await getRunBundle(run.id, signal)).toEqual({ run, findings: [finding], evidence })
    expect(fetcher).toHaveBeenCalledTimes(3)
    for (const call of fetcher.mock.calls) expect(call[1].signal).toBe(signal)
  })
  it('never exposes response body text on failure', async () => {
    const response = new Response('PRIVATE PASSWORD', { status: 500 })
    const text = vi.spyOn(response, 'text')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
    await expect(listRuns()).rejects.toBeInstanceOf(ApiError)
    await expect(listRuns()).rejects.toThrow('API request failed')
    expect(text).not.toHaveBeenCalled()
  })
  it('serializes optional login fields and supports an empty DELETE response', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(run))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetcher)
    await createRun({ ...initialForm, projectId: 'demo', targetUrl: run.target_url })
    const options = fetcher.mock.calls[0][1]
    expect(JSON.parse(options.body)).toEqual({ project_id: 'demo', target_url: run.target_url })
    await clearRuns()
    expect(fetcher.mock.calls[1][1].method).toBe('DELETE')
  })
})

it('sanitizes network and malformed JSON failures as ApiError', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('PRIVATE NETWORK DETAILS')))
  await expect(listRuns()).rejects.toThrow('API request failed')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('PRIVATE INVALID JSON')))
  await expect(listRuns()).rejects.toBeInstanceOf(ApiError)
})

it('falls back only when optional bundle requests return 404', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(Response.json(run))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
  )
  expect(await getRunBundle(run.id)).toEqual({ run, findings: [], evidence: null })
})

for (const endpoint of ['findings', 'evidence']) {
  it.each(['500', 'network', 'malformed JSON', 'abort'])(
    `rejects ${endpoint} %s failures`,
    async failure => {
      const abort = new DOMException('Aborted', 'AbortError')
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: string) => {
          if (input.endsWith(`/${endpoint}`)) {
            if (failure === 'network') throw new Error('PRIVATE NETWORK FAILURE')
            if (failure === 'abort') throw abort
            if (failure === '500') return new Response(null, { status: 500 })
            return new Response('PRIVATE INVALID JSON')
          }
          if (input.endsWith('/findings')) return Response.json([])
          if (input.endsWith('/evidence')) return Response.json(evidence)
          return Response.json(run)
        })
      )
      if (failure === 'abort') await expect(getRunBundle(run.id)).rejects.toBe(abort)
      else await expect(getRunBundle(run.id)).rejects.toBeInstanceOf(ApiError)
    }
  )
}

it('requires the run even when optional bundle requests succeed', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(Response.json(evidence))
  )
  await expect(getRunBundle(run.id)).rejects.toBeInstanceOf(ApiError)
})
