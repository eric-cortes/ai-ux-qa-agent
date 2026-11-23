'use client'

import { useTranslations } from 'next-intl'

export function PipelinePanel({ findingsTrigger }: { findingsTrigger: React.ReactNode }) {
  const t = useTranslations('pipeline')
  const steps = t.raw('steps') as string[]
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-lg font-semibold">{t('title')}</h2>
      <ul className="grid list-disc gap-2 pl-5 text-ink-soft">
        {steps.map(step => (
          <li key={step}>{step}</li>
        ))}
      </ul>
      <div className="mt-auto">{findingsTrigger}</div>
    </section>
  )
}
