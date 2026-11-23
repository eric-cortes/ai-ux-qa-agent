'use client'

import { Input as BaseInput } from '@base-ui/react/input'
import { cn } from '@/lib/cn'

const variants = { default: 'border-line', error: 'border-danger' }
const sizes = { sm: 'px-3 py-2 text-xs', md: 'px-3 py-3 text-sm' }

export type InputProps = Omit<BaseInput.Props, 'size'> & {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
}

export function Input({ variant = 'default', size = 'md', className, ...props }: InputProps) {
  return (
    <BaseInput
      {...props}
      className={state =>
        cn(
          'w-full rounded-xl border bg-surface text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-75 motion-safe:transition-colors',
          variants[variant],
          sizes[size],
          typeof className === 'function' ? className(state) : className
        )
      }
    />
  )
}
