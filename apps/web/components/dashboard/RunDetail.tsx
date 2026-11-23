import { useTranslations } from 'next-intl'
import { artifactOrigin, type Run } from '@/lib/api'
import { formatDate } from '@/lib/format-date'
import { StatusBadge } from './StatusBadge'

export function RunDetail({ run }: { run: Run | null }) {
  const t = useTranslations('detail')
  const errors = useTranslations('errors')
  const common = useTranslations('common')
  const values = run
    ? ([
        ['id', run.id],
        ['project', run.project_id],
        ['environment', run.environment_id ?? common('notAvailable')],
        ['targetUrl', run.target_url],
        ['created', formatDate(run.created_at)],
        ['updated', formatDate(run.updated_at)],
        ['artifactDirectory', run.artifact_dir ?? t('pending')],
      ] as const)
    : []
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="mb-4 text-lg font-semibold">{t('title')}</h2>
      {run ? (
        <div className="grid gap-4">
          <dl className="grid gap-2">
            {values.map(([key, value]) => (
              <div key={key} className="break-all">
                <dt className="inline font-semibold">{t(key)}</dt>{' '}
                <dd className="inline">{value}</dd>
              </div>
            ))}
            <div>
              <dt className="inline font-semibold">{t('status')}</dt>{' '}
              <dd className="inline">
                <StatusBadge status={run.status} />
              </dd>
            </div>
          </dl>
          {(run.status === 'failed' || run.error_message) && (
            <p role="alert" className="text-danger">
              {errors('workerFailed')}
            </p>
          )}
          <div>
            <h3 className="mb-2 font-semibold">{t('screenshot')}</h3>
            {/* Worker artifacts are dynamic external images; preserve their original dimensions. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${artifactOrigin}/artifacts/${encodeURIComponent(run.id)}/page.png`}
              alt={t('screenshotAlt', { id: run.id })}
              className="w-full rounded-xl border border-line bg-surface-muted"
            />
          </div>
        </div>
      ) : (
        <p className="text-ink-muted">{t('empty')}</p>
      )}
    </section>
  )
}
