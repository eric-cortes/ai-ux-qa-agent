import { useTranslations } from 'next-intl'
import { Badge, type BadgeTone } from '@/components/UI'
import type { RunStatus } from '@/lib/api'

const tones: Record<RunStatus, BadgeTone> = {
  queued: 'info',
  running: 'progress',
  analyzing: 'warning',
  completed: 'success',
  failed: 'danger',
  cancelled: 'neutral',
}
export function StatusBadge({ status }: { status: RunStatus }) {
  const t = useTranslations('labels.status')
  return <Badge tone={tones[status]}>{t(status)}</Badge>
}
