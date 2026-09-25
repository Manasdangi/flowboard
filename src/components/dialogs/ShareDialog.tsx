import { Check, ShieldCheck, X } from 'lucide-react';
import { findGrant, resolveAccess, type AccessDecision } from '@/domain/permissions';
import type { DataState, GrantMode, ID, User } from '@/domain/types';
import { cn } from '@/lib/cn';
import { useActions, useData } from '@/store/hooks';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { FieldLabel } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { VisibilityPicker } from './VisibilityPicker';

type Choice = 'inherit' | GrantMode;

function explain(data: DataState, containerId: ID, d: AccessDecision): string {
  const here = d.decidedBy === containerId;
  const where = data.containers[d.decidedBy]?.name ?? 'parent';
  switch (d.reason) {
    case 'admin':
      return 'Workspace admin — sees everything';
    case 'workspace':
      return 'Public — visible to all members';
    case 'grant-allow':
      return here ? 'Allowed on this item' : `Allowed on “${where}”`;
    case 'grant-deny':
      return here ? 'Denied on this item' : `Denied on “${where}”`;
    case 'private':
      return here ? 'Private — needs an allow grant' : `“${where}” is private`;
  }
}

export function ShareDialog({ containerId, onClose }: { containerId: ID; onClose: () => void }) {
  const data = useData();
  const { setGrant, setVisibility } = useActions();
  const container = data.containers[containerId];
  if (!container) return null;
  const users = Object.values(data.users);

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={`Sharing · ${container.name}`}
      description="The nearest explicit rule wins. Private items stop inheritance; an allow on a child still works."
      footer={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="space-y-5">
        <div>
          <FieldLabel>Visibility</FieldLabel>
          <VisibilityPicker value={container.visibility} onChange={(v) => setVisibility(containerId, v)} />
        </div>
        <div>
          <FieldLabel>People</FieldLabel>
          <ul className="divide-y divide-line rounded-card ring-1 ring-line">
            {users.map((user) => {
              const decision = resolveAccess(data, user.id, containerId);
              return (
                <UserRow
                  key={user.id}
                  user={user}
                  decision={decision}
                  explanation={explain(data, containerId, decision)}
                  choice={findGrant(data, user.id, containerId)?.mode ?? 'inherit'}
                  onChange={(choice) =>
                    setGrant({ resourceId: containerId, userId: user.id, mode: choice === 'inherit' ? null : choice })
                  }
                />
              );
            })}
          </ul>
        </div>
      </div>
    </Modal>
  );
}

function UserRow({
  user,
  decision,
  explanation,
  choice,
  onChange,
}: {
  user: User;
  decision: AccessDecision;
  explanation: string;
  choice: Choice;
  onChange: (c: Choice) => void;
}) {
  const admin = user.role === 'admin';
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <Avatar user={user} size="md" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
          {user.name}
          {admin && <ShieldCheck className="h-3.5 w-3.5 text-brand-600" aria-label="Admin" />}
        </p>
        <p className={cn('flex items-center gap-1 text-xs', decision.visible ? 'text-emerald-700' : 'text-ink-subtle')}>
          {decision.visible ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          {decision.visible ? 'Can view' : 'No access'} · {explanation}
        </p>
      </div>
      {admin ? (
        <span className="text-xs text-ink-subtle">Always has access</span>
      ) : (
        <div
          role="radiogroup"
          aria-label={`Access for ${user.name}`}
          className="flex rounded-control bg-surface-sunken p-0.5"
        >
          {(['inherit', 'allow', 'deny'] as Choice[]).map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={choice === c}
              onClick={() => onChange(c)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                choice === c
                  ? c === 'deny'
                    ? 'bg-surface text-rose-700 shadow-card'
                    : c === 'allow'
                      ? 'bg-surface text-emerald-700 shadow-card'
                      : 'bg-surface text-ink shadow-card'
                  : 'text-ink-muted hover:text-ink',
              )}
            >
              {c === 'inherit' ? 'Default' : c}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}
