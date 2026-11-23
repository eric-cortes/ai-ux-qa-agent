'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button, ConfirmDialog } from '@/components/UI'
import { createRun, clearRuns, getRunBundle, listRuns, type Run, type FormState } from '@/lib/api'
import { RunForm, initialForm } from './RunForm'
import { PipelinePanel } from './PipelinePanel'
import { RunList } from './RunList'
import { RunDetail } from './RunDetail'
import { EvidenceSummary } from './EvidenceSummary'
import { FindingsModal } from './FindingsModal'

type ErrorKey = 'loadRuns' | 'loadDetail' | 'queueRun' | 'clearRuns'
type Bundle = Awaited<ReturnType<typeof getRunBundle>>
export function Dashboard() {
  const header = useTranslations('header')
  const errors = useTranslations('errors')
  const formText = useTranslations('form')
  const common = useTranslations('common')
  const pipeline = useTranslations('pipeline')
  const [form, setForm] = useState<FormState>(initialForm)
  const [runs, setRuns] = useState<Run[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [bundle, setBundle] = useState<Bundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [findingsOpen, setFindingsOpen] = useState(false)
  const [error, setError] = useState<ErrorKey | null>(null)
  const selected = useRef<string | null>(null)
  const listRequest = useRef<AbortController | null>(null)
  const detailRequest = useRef<AbortController | null>(null)
  const mutation = useRef<AbortController | null>(null)

  function selectRun(id: string | null) {
    selected.current = id
    detailRequest.current?.abort()
    setBundle(null)
    setSelectedId(id)
    if (id) void refreshDetail(id)
  }
  async function refreshRuns() {
    listRequest.current?.abort()
    const controller = new AbortController()
    listRequest.current = controller
    try {
      const data = await listRuns(controller.signal)
      if (controller.signal.aborted) return
      setRuns(data)
      setError(current => (current === 'loadRuns' ? null : current))
      if (!selected.current && data.length) selectRun(data[0].id)
      else if (selected.current && !data.some(run => run.id === selected.current)) selectRun(null)
    } catch {
      if (!controller.signal.aborted) setError('loadRuns')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }
  async function refreshDetail(id: string) {
    detailRequest.current?.abort()
    const controller = new AbortController()
    detailRequest.current = controller
    try {
      const result = await getRunBundle(id, controller.signal)
      if (!controller.signal.aborted && selected.current === id) {
        setBundle(result)
        setError(current => (current === 'loadDetail' ? null : current))
      }
    } catch {
      if (!controller.signal.aborted && selected.current === id) setError('loadDetail')
    }
  }
  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) void refreshRuns()
    })
    const interval = setInterval(() => {
      void refreshRuns()
      if (selected.current) void refreshDetail(selected.current)
    }, 4000)
    return () => {
      active = false
      clearInterval(interval)
      listRequest.current?.abort()
      detailRequest.current?.abort()
      mutation.current?.abort()
    }
    // Requests read current selection through a ref, so polling has one lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function queueRun() {
    const controller = new AbortController()
    mutation.current = controller
    setSubmitting(true)
    setError(null)
    // A list response started before the POST must not undo the new selection.
    listRequest.current?.abort()
    try {
      const run = await createRun(form, controller.signal)
      if (controller.signal.aborted) return
      selectRun(run.id)
      setRuns(current => [run, ...current.filter(item => item.id !== run.id)])
      setForm(current => ({ ...current, loginPassword: '' }))
      void refreshRuns()
    } catch {
      if (!controller.signal.aborted) setError('queueRun')
    } finally {
      if (!controller.signal.aborted) setSubmitting(false)
    }
  }
  async function deleteRuns() {
    const controller = new AbortController()
    mutation.current = controller
    setClearing(true)
    setError(null)
    listRequest.current?.abort()
    detailRequest.current?.abort()
    try {
      await clearRuns(controller.signal)
      if (controller.signal.aborted) return
      // Cancel polling requests that may have started while DELETE was pending.
      listRequest.current?.abort()
      detailRequest.current?.abort()
      selectRun(null)
      setRuns([])
      setForm(initialForm)
      setLoading(false)
    } catch {
      if (!controller.signal.aborted) setError('clearRuns')
    } finally {
      if (!controller.signal.aborted) setClearing(false)
    }
  }
  const currentBundle = bundle?.run.id === selectedId ? bundle : null
  const currentRun = currentBundle?.run ?? runs.find(run => run.id === selectedId) ?? null
  return (
    <main className="mx-auto grid min-h-screen max-w-7xl gap-4 p-5 sm:p-8">
      <header>
        <p className="mb-2 text-ink-muted">{header('eyebrow')}</p>
        <h1 className="text-2xl font-bold tracking-tight">{header('title')}</h1>
        <p className="mt-2 max-w-3xl text-ink-soft">{header('description')}</p>
      </header>
      {error && (
        <p role="alert" className="rounded-xl border border-danger p-4 text-danger">
          {errors(error)}
        </p>
      )}
      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        <RunForm
          value={form}
          onChange={setForm}
          onSubmit={() => void queueRun()}
          submitting={submitting}
          clearing={clearing}
          clearTrigger={
            <ConfirmDialog
              open={confirmOpen}
              onOpenChange={setConfirmOpen}
              title={common('confirmTitle')}
              description={common('confirmDescription')}
              confirmLabel={common('confirm')}
              cancelLabel={common('cancel')}
              onConfirm={() => void deleteRuns()}
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  disabled={submitting || clearing}
                  loading={clearing}
                  loadingText={formText('clearing')}
                >
                  {formText('clear')}
                </Button>
              }
            />
          }
        />
        <PipelinePanel
          findingsTrigger={
            <FindingsModal
              open={findingsOpen}
              onOpenChange={setFindingsOpen}
              findings={currentBundle?.findings ?? []}
              trigger={
                <Button disabled={!selectedId}>
                  {pipeline('openFindings', { count: currentBundle?.findings.length ?? 0 })}
                </Button>
              }
            />
          }
        />
        <RunList
          runs={runs}
          selectedId={selectedId}
          loading={loading}
          onSelect={selectRun}
          onRefresh={() => {
            void refreshRuns()
          }}
        />
        <RunDetail run={currentRun} />
        <EvidenceSummary evidence={currentBundle?.evidence ?? null} />
      </div>
    </main>
  )
}
