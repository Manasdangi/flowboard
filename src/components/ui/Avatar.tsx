import type { User } from '@/domain/types';
import { cn } from '@/lib/cn';
import { AVATAR_STYLES } from '@/ui/tokens';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

const SIZES = {
  xs: 'h-5 w-5 text-[9px]',
  sm: 'h-6 w-6 text-2xs',
  md: 'h-7 w-7 text-xs',
  lg: 'h-9 w-9 text-sm',
};

export function Avatar({
  user,
  size = 'sm',
  className,
}: {
  user: User;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      title={user.name}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold',
        AVATAR_STYLES[user.avatarColor],
        SIZES[size],
        className,
      )}
    >
      {initials(user.name)}
    </span>
  );
}

export function AvatarStack({
  users,
  max = 3,
  size = 'xs',
}: {
  users: User[];
  max?: number;
  size?: keyof typeof SIZES;
}) {
  if (users.length === 0) return null;
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <span className="flex items-center -space-x-1" aria-label={`Assigned to ${users.map((u) => u.name).join(', ')}`}>
      {shown.map((u) => (
        <Avatar key={u.id} user={u} size={size} className="ring-2 ring-surface" />
      ))}
      {extra > 0 && (
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-full bg-surface-sunken font-semibold text-ink-muted ring-2 ring-surface',
            SIZES[size],
          )}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}
