declare module '*.css'

import type metadata from './messages/en/metadata.json'
import type header from './messages/en/header.json'
import type form from './messages/en/form.json'
import type pipeline from './messages/en/pipeline.json'
import type runs from './messages/en/runs.json'
import type detail from './messages/en/detail.json'
import type evidence from './messages/en/evidence.json'
import type findings from './messages/en/findings.json'
import type errors from './messages/en/errors.json'
import type labels from './messages/en/labels.json'
import type common from './messages/en/common.json'
import type a11y from './messages/en/a11y.json'

declare module 'next-intl' {
  interface AppConfig {
    Locale: 'en'
    Messages: {
      metadata: typeof metadata
      header: typeof header
      form: typeof form
      pipeline: typeof pipeline
      runs: typeof runs
      detail: typeof detail
      evidence: typeof evidence
      findings: typeof findings
      errors: typeof errors
      labels: typeof labels
      common: typeof common
      a11y: typeof a11y
    }
  }
}
