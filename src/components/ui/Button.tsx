import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { FOCUS_RING } from '@/ui/tokens';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300',
  secondary:
    'bg-surface text-ink ring-1 ring-inset ring-line-strong shadow-sm hover:bg-surface-muted active:bg-surface-sunken disabled:text-ink-faint',
  ghost: 'text-ink-muted hover:bg-surface-sunken hover:text-ink active:bg-line disabled:text-ink-faint',
  danger: 'bg-rose-600 text-white shadow-sm hover:bg-rose-700 active:bg-rose-800 disabled:bg-rose-300',
};

const SIZES: Record<Size, string> = {
  sm: 'h-7 gap-1.5 px-2.5 text-xs',
  md: 'h-8 gap-2 px-3 text-sm',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-control font-medium transition-colors disabled:cursor-not-allowed',
        FOCUS_RING,
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
});

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string }>(
  function IconButton({ label, className, type = 'button', ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        title={label}
        className={cn(
          'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink active:bg-line disabled:cursor-not-allowed disabled:opacity-40',
          FOCUS_RING,
          className,
        )}
        {...props}
      />
    );
  },
);
