import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

const tones = {
  info: 'border-blue-700 bg-blue-100 text-blue-950',
  progress: 'border-cyan-700 bg-cyan-100 text-cyan-950',
  warning: 'border-amber-700 bg-amber-100 text-amber-950',
  success: 'border-emerald-700 bg-emerald-100 text-emerald-950',
  danger: 'border-red-700 bg-red-100 text-red-950',
  neutral: 'border-slate-700 bg-slate-100 text-slate-950',
}

export type BadgeTone = keyof typeof tones
export type BadgeProps = Omit<ComponentProps<'span'>, 'className'> & {
  tone?: BadgeTone
  className?: string | ((state: { tone: BadgeTone }) => string | undefined)
}

// Base UI has no badge primitive; a span keeps status text inline and readable.
export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-1 text-xs',
        tones[tone],
        typeof className === 'function' ? className({ tone }) : className
      )}
    />
  )
}
