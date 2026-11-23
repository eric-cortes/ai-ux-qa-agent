'use client'

import { Dialog } from '@base-ui/react/dialog'
import { RxCross2 } from 'react-icons/rx'
import { cn } from '@/lib/cn'

const sizes = { sm: 'max-w-sm', md: 'max-w-xl', lg: 'max-w-4xl', full: 'max-w-7xl' }

export type ModalProps = Omit<Dialog.Popup.Props, 'title'> & {
  open: boolean
  onOpenChange: Dialog.Root.Props['onOpenChange']
  title: React.ReactNode
  closeLabel: string
  size?: keyof typeof sizes
  trigger?: React.ReactElement
}

export function Modal({
  open,
  onOpenChange,
  title,
  closeLabel,
  size = 'md',
  trigger,
  children,
  className,
  ...props
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger render={trigger} />}
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Popup
          {...props}
          className={state =>
            cn(
              'fixed top-1/2 left-1/2 z-50 max-h-11/12 w-11/12 -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-surface p-5 text-ink shadow-xl',
              sizes[size],
              typeof className === 'function' ? className(state) : className
            )
          }
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
            <Dialog.Close
              aria-label={closeLabel}
              className="rounded-lg p-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <RxCross2 aria-hidden />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
