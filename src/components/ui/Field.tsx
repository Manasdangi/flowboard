import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

const CONTROL =
  'w-full rounded-control bg-surface text-sm text-ink ring-1 ring-inset ring-line-strong placeholder:text-ink-faint transition-shadow hover:ring-ink-faint focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-subtle';

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(CONTROL, 'h-8 px-2.5', className)} {...props} />;
});

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea(
  { className, ...props },
  ref,
) {
  return <textarea ref={ref} className={cn(CONTROL, 'px-2.5 py-2 leading-relaxed', className)} {...props} />;
});

/**
 * Native <select> with our own chevron. The browser's arrow is hidden
 * (appearance-none) because it ignores padding and sits flush against the border.
 * `leading` renders an optional icon inside the field, on the left.
 */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { leading?: ReactNode }>(
  function Select({ className, leading, ...props }, ref) {
    return (
      <div className="relative">
        {leading && (
          <span className="pointer-events-none absolute left-2.5 top-1/2 z-10 flex -translate-y-1/2" aria-hidden>
            {leading}
          </span>
        )}
        <select
          ref={ref}
          className={cn(CONTROL, 'h-8 cursor-pointer appearance-none pl-2.5 pr-8', leading && 'pl-8', className)}
          {...props}
        />
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-subtle"
        />
      </div>
    );
  },
);

export function FieldLabel({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between text-xs font-medium text-ink-muted">
      <span>{children}</span>
      {hint && <span className="font-normal text-ink-subtle">{hint}</span>}
    </label>
  );
}
