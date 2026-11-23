import { useTranslations } from 'next-intl'
import { Button } from '@/components/UI'
import { cn } from '@/lib/cn'
import type { Run } from '@/lib/api'
import { StatusBadge } from './StatusBadge'

export function RunList({
  runs,
  selectedId,
  loading,
  onSelect,
  onRefresh,
}: {
  runs: Run[]
  selectedId: string | null
  loading: boolean
  onSelect: (id: string) => void
  onRefresh: () => void
}) {
  const t = useTranslations('runs')
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t('title')}</h2>
        <Button variant="secondary" size="sm" onClick={onRefresh}>
          {t('refresh')}
        </Button>
      </div>
      {loading && (
        <p role="status" className="text-ink-muted">
          {t('loading')}
        </p>
      )}
      <div className="grid gap-3">
        {runs.map(run => (
          <Button
            key={run.id}
            variant="ghost"
            aria-pressed={selectedId === run.id}
            onClick={() => onSelect(run.id)}
            className={cn(
              'block w-full border bg-surface-muted p-4 text-left',
              selectedId === run.id ? 'border-selected' : 'border-line'
            )}
          >
            <span className="flex justify-between gap-3">
              <strong>{run.id}</strong>
              <StatusBadge status={run.status} />
            </span>
            <span className="mt-2 block break-all text-ink-muted">{run.target_url}</span>
            <span className="mt-2 block text-xs text-ink-soft">
              {t('project', { project: run.project_id })}
            </span>
          </Button>
        ))}
      </div>
      {!loading && runs.length === 0 && <p className="text-ink-muted">{t('empty')}</p>}
    </section>
  )
}
