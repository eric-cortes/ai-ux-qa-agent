import type { ReactElement } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import metadata from '@/messages/en/metadata.json'
import header from '@/messages/en/header.json'
import form from '@/messages/en/form.json'
import pipeline from '@/messages/en/pipeline.json'
import runs from '@/messages/en/runs.json'
import detail from '@/messages/en/detail.json'
import evidence from '@/messages/en/evidence.json'
import findings from '@/messages/en/findings.json'
import errors from '@/messages/en/errors.json'
import labels from '@/messages/en/labels.json'
import common from '@/messages/en/common.json'
import a11y from '@/messages/en/a11y.json'

export const messages = {
  metadata,
  header,
  form,
  pipeline,
  runs,
  detail,
  evidence,
  findings,
  errors,
  labels,
  common,
  a11y,
}

export function renderWithIntl(ui: ReactElement, options?: RenderOptions) {
  return render(ui, {
    wrapper: ({ children }) => (
      <NextIntlClientProvider
        locale="en"
        timeZone="UTC"
        messages={messages}
        onError={error => {
          throw error
        }}
      >
        {children}
      </NextIntlClientProvider>
    ),
    ...options,
  })
}
