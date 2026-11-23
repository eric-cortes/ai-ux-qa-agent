'use client'

import { Button as BaseButton } from '@base-ui/react/button'
import { RxReload } from 'react-icons/rx'
import { cn } from '@/lib/cn'

const variants = {
  primary: 'bg-action text-action-fg hover:bg-action-hover',
  secondary: 'bg-surface-muted text-ink hover:bg-canvas',
  outline: 'border border-line bg-surface text-ink hover:bg-surface-muted',
  ghost: 'bg-transparent text-ink hover:bg-surface-muted',
  danger: 'bg-danger text-danger-fg',
}
const sizes = { sm: 'px-3 py-2 text-xs', md: 'px-4 py-3 text-sm' }

export type ButtonProps = BaseButton.Props & {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  loading?: boolean
  loadingText?: React.ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingText,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <BaseButton
      {...props}
      disabled={disabled || loading}
      aria-busy={loading}
      className={state =>
        cn(
          'inline-flex items-center justify-center gap-2 rounded-xl font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-safe:transition-colors disabled:cursor-not-allowed disabled:opacity-75',
          variants[variant],
          sizes[size],
          typeof className === 'function' ? className(state) : className
        )
      }
    >
      <span className="inline-grid">
        <span
          className={cn('col-start-1 row-start-1', loading && 'invisible')}
          aria-hidden={loading}
        >
          {children}
        </span>
        <span
          className={cn(
            'col-start-1 row-start-1 inline-flex items-center justify-center gap-2',
            !loading && 'invisible'
          )}
          aria-hidden={!loading}
        >
          <RxReload aria-hidden className="motion-safe:animate-spin" />
          {loadingText ?? children}
        </span>
      </span>
    </BaseButton>
  )
}
