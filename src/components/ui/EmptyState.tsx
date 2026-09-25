import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function EmptyState({
  icon,
  title,
  children,
  action,
  tone = 'neutral',
  className,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  tone?: 'neutral' | 'danger';
  className?: string;
}) {
  return (
    <div
      className={cn('mx-auto flex max-w-sm animate-fade-in flex-col items-center px-6 py-16 text-center', className)}
    >
      <div
        className={cn(
          'mb-4 flex h-12 w-12 items-center justify-center rounded-panel ring-1 ring-inset',
          tone === 'danger' ? 'bg-rose-50 text-rose-600 ring-rose-100' : 'bg-brand-50 text-brand-600 ring-brand-100',
        )}
      >
        {icon}
      </div>
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {children && <div className="mt-1.5 text-sm leading-relaxed text-ink-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
