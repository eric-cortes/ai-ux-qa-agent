import { useTranslations } from 'next-intl'
import { Badge, type BadgeTone } from '@/components/UI'
import type { FindingSeverity } from '@/lib/api'

const tones: Record<FindingSeverity, BadgeTone> = {
  low: 'info',
  medium: 'warning',
  high: 'danger',
  critical: 'danger',
}
export function SeverityBadge({ severity }: { severity: FindingSeverity }) {
  const t = useTranslations('labels.severity')
  return <Badge tone={tones[severity]}>{t(severity)}</Badge>
}
