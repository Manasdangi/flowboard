import { Menu as HMenu, MenuButton, MenuItem, MenuItems, MenuSeparator } from '@headlessui/react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export { HMenu as Menu, MenuButton };

export function MenuPanel({
  children,
  anchor = 'bottom end',
  className,
}: {
  children: ReactNode;
  anchor?: 'bottom end' | 'bottom start';
  className?: string;
}) {
  return (
    <MenuItems
      anchor={{ to: anchor, gap: 6 }}
      className={cn('z-50 min-w-48 animate-pop-in rounded-card bg-surface p-1 shadow-pop outline-none', className)}
    >
      {children}
    </MenuItems>
  );
}

export function MenuAction({
  icon,
  children,
  onClick,
  disabled,
  danger,
  hint,
}: {
  icon?: ReactNode;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  hint?: ReactNode;
}) {
  return (
    <MenuItem disabled={disabled}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-control px-2.5 py-1.5 text-left text-sm transition-colors data-[disabled]:cursor-not-allowed data-[focus]:bg-surface-sunken data-[disabled]:opacity-45',
          danger ? 'text-rose-600 data-[focus]:bg-rose-50' : 'text-ink',
        )}
      >
        {icon && (
          <span
            className={cn('flex h-4 w-4 items-center justify-center', danger ? 'text-rose-500' : 'text-ink-subtle')}
          >
            {icon}
          </span>
        )}
        <span className="flex-1">{children}</span>
        {hint && <span className="text-2xs text-ink-subtle">{hint}</span>}
      </button>
    </MenuItem>
  );
}

export function MenuDivider() {
  return <MenuSeparator className="my-1 h-px bg-line" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2.5 pb-1 pt-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-subtle">{children}</div>
  );
}
