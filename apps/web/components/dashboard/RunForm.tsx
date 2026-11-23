'use client'

import { useTranslations } from 'next-intl'
import { Button, FieldRoot, FieldLabel, Input } from '@/components/UI'
import type { FormState } from '@/lib/api'

export const initialForm: FormState = {
  projectId: '',
  environmentId: '',
  targetUrl: '',
  loginEmail: '',
  loginPassword: '',
}
const fields = [
  { name: 'projectId', type: 'text', autoComplete: 'off' },
  { name: 'environmentId', type: 'text', autoComplete: 'off' },
  { name: 'targetUrl', type: 'text', autoComplete: 'url' },
  { name: 'loginEmail', type: 'email', autoComplete: 'username' },
  { name: 'loginPassword', type: 'password', autoComplete: 'current-password' },
] as const
export function RunForm({
  value,
  onChange,
  onSubmit,
  clearTrigger,
  submitting,
  clearing,
}: {
  value: FormState
  onChange: (value: FormState) => void
  onSubmit: () => void
  clearTrigger: React.ReactNode
  submitting: boolean
  clearing: boolean
}) {
  const t = useTranslations('form')
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="mb-4 text-lg font-semibold">{t('title')}</h2>
      <form
        className="grid gap-3"
        onSubmit={event => {
          event.preventDefault()
          onSubmit()
        }}
      >
        {fields.map(field => (
          <FieldRoot key={field.name} name={field.name} disabled={submitting || clearing}>
            <FieldLabel>{t(field.name)}</FieldLabel>
            <Input
              name={field.name}
              type={field.type}
              inputMode={field.name === 'targetUrl' ? 'url' : undefined}
              autoComplete={field.autoComplete}
              placeholder={t(`${field.name}Placeholder`)}
              value={value[field.name]}
              disabled={submitting || clearing}
              onChange={event => onChange({ ...value, [field.name]: event.target.value })}
            />
          </FieldRoot>
        ))}
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            type="submit"
            loading={submitting}
            loadingText={t('queueing')}
            disabled={clearing}
          >
            {t('queue')}
          </Button>
          {clearTrigger}
        </div>
      </form>
    </section>
  )
}
