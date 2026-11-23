'use client'

import { AlertDialog } from '@base-ui/react/alert-dialog'
import { Button } from './Button'
import { cn } from '@/lib/cn'

export type ConfirmDialogProps = Omit<AlertDialog.Popup.Props, 'title' | 'children'> & {
  open: boolean
  onOpenChange: AlertDialog.Root.Props['onOpenChange']
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  trigger?: React.ReactElement
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  trigger,
  className,
  ...props
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <AlertDialog.Trigger render={trigger} />}
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-40 bg-black/60" />
        <AlertDialog.Popup
          {...props}
          className={state =>
            cn(
              'fixed top-1/2 left-1/2 z-50 w-11/12 max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-surface p-5 text-ink',
              typeof className === 'function' ? className(state) : className
            )
          }
        >
          <AlertDialog.Title className="text-lg font-semibold">{title}</AlertDialog.Title>
          <AlertDialog.Description className="my-4 text-ink-muted">
            {description}
          </AlertDialog.Description>
          <div className="flex justify-end gap-3">
            <AlertDialog.Close render={<Button variant="outline" />}>
              {cancelLabel}
            </AlertDialog.Close>
            <AlertDialog.Close render={<Button variant="danger" />} onClick={onConfirm}>
              {confirmLabel}
            </AlertDialog.Close>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
