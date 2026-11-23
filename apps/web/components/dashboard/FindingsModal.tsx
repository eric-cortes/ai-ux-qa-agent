import { useTranslations } from 'next-intl'
import { Modal, type ModalProps } from '@/components/UI'
import type { Finding } from '@/lib/api'
import { SeverityBadge } from './SeverityBadge'

export function FindingsModal({
  findings,
  ...props
}: { findings: Finding[] } & Pick<ModalProps, 'open' | 'onOpenChange' | 'trigger'>) {
  const t = useTranslations('findings')
  const labels = useTranslations('labels')
  const a11y = useTranslations('a11y')
  return (
    <Modal
      {...props}
      size="full"
      title={t('title', { count: findings.length })}
      closeLabel={a11y('close')}
    >
      <div className="grid gap-3">
        {findings.map(finding => (
          <article
            key={finding.id}
            className="grid gap-3 rounded-xl border border-line bg-surface-muted p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">{finding.title}</h3>
              <SeverityBadge severity={finding.severity} />
            </div>
            <p className="text-ink-muted">
              {t('category', { category: labels(`category.${finding.category}`) })}
              {' · '}
              {t('confidence', { value: finding.confidence })}
              {' · '}
              {t('verification', { status: labels(`verification.${finding.verification_status}`) })}
            </p>
            {finding.guideline_id && (
              <div>
                <strong>{t('guideline')}</strong>{' '}
                {finding.guideline_source_url ? (
                  <a
                    href={finding.guideline_source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-ink underline underline-offset-2"
                  >
                    {finding.guideline_id}
                  </a>
                ) : (
                  finding.guideline_id
                )}
              </div>
            )}
            <p>{finding.description}</p>
            <p>
              <strong>{t('observed')}</strong> {finding.observed_behavior}
            </p>
            <div>
              <h4 className="font-semibold">{t('steps')}</h4>
              <ol className="mt-2 grid list-decimal gap-2 pl-5 text-ink-soft">
                {finding.reproduction_steps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </div>
          </article>
        ))}
        {findings.length === 0 && <p className="text-ink-muted">{t('empty')}</p>}
      </div>
    </Modal>
  )
}
