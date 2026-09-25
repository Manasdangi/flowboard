import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useToasts, type ToastTone } from '@/store/toasts';

const TONES: Record<ToastTone, { icon: typeof Info; accent: string }> = {
  error: { icon: AlertTriangle, accent: 'text-rose-600' },
  success: { icon: CheckCircle2, accent: 'text-emerald-600' },
  info: { icon: Info, accent: 'text-brand-600' },
};

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-2"
    >
      {toasts.map((t) => {
        const { icon: Icon, accent } = TONES[t.tone];
        return (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex animate-toast-in items-start gap-3 rounded-card bg-surface p-3.5 shadow-pop"
          >
            <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', accent)} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{t.title}</p>
              {t.message && <p className="mt-0.5 text-sm text-ink-muted">{t.message}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="-m-1 rounded p-1 text-ink-faint transition-colors hover:bg-surface-sunken hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
