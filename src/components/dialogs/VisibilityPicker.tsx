import { Globe, Lock } from 'lucide-react';
import type { Visibility } from '@/domain/types';
import { cn } from '@/lib/cn';

const OPTIONS: { value: Visibility; label: string; body: string; icon: typeof Globe }[] = [
  { value: 'public', label: 'Public', body: 'Everyone who can see the parent, unless denied.', icon: Globe },
  { value: 'private', label: 'Private', body: 'Only admins and people explicitly allowed.', icon: Lock },
];

export function VisibilityPicker({ value, onChange }: { value: Visibility; onChange: (v: Visibility) => void }) {
  return (
    <div role="radiogroup" aria-label="Visibility" className="grid grid-cols-2 gap-2">
      {OPTIONS.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex flex-col items-start gap-1 rounded-card p-3 text-left ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
              active ? 'bg-brand-50 ring-brand-300' : 'ring-line-strong hover:bg-surface-muted',
            )}
          >
            <span
              className={cn('flex items-center gap-1.5 text-sm font-semibold', active ? 'text-brand-800' : 'text-ink')}
            >
              <o.icon className="h-3.5 w-3.5" /> {o.label}
            </span>
            <span className="text-xs leading-snug text-ink-muted">{o.body}</span>
          </button>
        );
      })}
    </div>
  );
}
