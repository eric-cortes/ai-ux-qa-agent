'use client'

import { Field } from '@base-ui/react/field'
import { cn } from '@/lib/cn'

export function FieldRoot({ className, ...props }: Field.Root.Props) {
  return (
    <Field.Root
      {...props}
      className={state =>
        cn('grid gap-2', typeof className === 'function' ? className(state) : className)
      }
    />
  )
}

export function FieldLabel({ className, ...props }: Field.Label.Props) {
  return (
    <Field.Label
      {...props}
      className={state =>
        cn('font-medium text-ink', typeof className === 'function' ? className(state) : className)
      }
    />
  )
}

export function FieldDescription({ className, ...props }: Field.Description.Props) {
  return (
    <Field.Description
      {...props}
      className={state =>
        cn('text-xs text-ink-muted', typeof className === 'function' ? className(state) : className)
      }
    />
  )
}

export function FieldError({ className, ...props }: Field.Error.Props) {
  return (
    <Field.Error
      {...props}
      className={state =>
        cn('text-xs text-danger', typeof className === 'function' ? className(state) : className)
      }
    />
  )
}
