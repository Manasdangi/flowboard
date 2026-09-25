import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { IconButton } from './Button';

/** Centered dialog: Escape + overlay click close, focus is trapped and restored. */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 animate-fade-in bg-ink/30 backdrop-blur-[2px]" />
      <div className="fixed inset-0 flex items-start justify-center overflow-y-auto p-4 pt-[12vh]">
        <DialogPanel
          className={cn(
            'w-full animate-pop-in rounded-panel bg-surface shadow-pop',
            size === 'sm' && 'max-w-sm',
            size === 'md' && 'max-w-md',
            size === 'lg' && 'max-w-xl',
          )}
        >
          <div className="flex items-start gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-sm font-semibold text-ink">{title}</DialogTitle>
              {description && <div className="mt-1 text-xs text-ink-muted">{description}</div>}
            </div>
            <IconButton label="Close" onClick={onClose} className="-mr-1.5 -mt-1">
              <X className="h-4 w-4" />
            </IconButton>
          </div>
          <div className="px-5 py-4">{children}</div>
          {footer && (
            <div className="flex justify-end gap-2 rounded-b-panel border-t border-line bg-surface-muted px-5 py-3">
              {footer}
            </div>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
