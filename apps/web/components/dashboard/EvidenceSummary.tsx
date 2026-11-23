import { useTranslations } from 'next-intl'
import type { Evidence } from '@/lib/api'
import { EvidenceList } from './EvidenceList'

export function EvidenceSummary({ evidence }: { evidence: Evidence | null }) {
  const t = useTranslations('evidence')
  const common = useTranslations('common')
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 lg:col-span-2">
      <h2 className="mb-4 text-lg font-semibold">{t('title')}</h2>
      {evidence ? (
        <div className="grid gap-3">
          <div>
            <strong>{t('pageTitle')}</strong> {evidence.title ?? common('notAvailable')}
          </div>
          <div className="break-all">
            <strong>{t('finalUrl')}</strong>{' '}
            {evidence.finalUrl ?? evidence.targetUrl ?? common('notAvailable')}
          </div>
          <EvidenceList title={t('actions')} items={evidence.actions ?? []} />
          <EvidenceList
            title={t('consoleMessages')}
            items={(evidence.consoleMessages ?? []).slice(0, 10)}
          />
          <EvidenceList
            title={t('failedRequests')}
            items={(evidence.failedRequests ?? []).slice(0, 10)}
          />
          <EvidenceList
            title={t('httpErrors')}
            items={(evidence.errorResponses ?? [])
              .slice(0, 10)
              .map(item => `${item.method} ${item.status} ${item.url}`)}
          />
          <div>
            <h3 className="font-semibold">{t('guidelines')}</h3>
            <p className="mt-2 text-ink-soft">
              {t('guidelineSummary', {
                unlabeled: evidence.guidelineChecks?.unlabeledFormControls?.length ?? 0,
                small: evidence.guidelineChecks?.smallTargets?.length ?? 0,
                overflow: evidence.guidelineChecks?.viewport?.hasHorizontalOverflow ? 'yes' : 'no',
                tabs: evidence.guidelineChecks?.keyboard?.sampledTabStops?.length ?? 0,
              })}
            </p>
          </div>
          <EvidenceList
            title={t('axeViolations')}
            items={(evidence.axeViolations ?? [])
              .slice(0, 10)
              .map(
                item =>
                  `${item.id}${item.impact ? ` (${item.impact})` : ''} — ${item.help ?? item.description ?? ''}`
              )}
          />
        </div>
      ) : (
        <p className="text-ink-muted">{t('empty')}</p>
      )}
    </section>
  )
}
