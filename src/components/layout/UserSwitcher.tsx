import { Check, ChevronDown, FlaskConical, RotateCcw, ShieldCheck } from 'lucide-react';
import { selectVisibleLists } from '@/domain/tree';
import { cn } from '@/lib/cn';
import { notify } from '@/store/toasts';
import { useActions, useAppStore, useCurrentUser, useData } from '@/store/hooks';
import { FOCUS_RING } from '@/ui/tokens';
import { Avatar } from '../ui/Avatar';
import { Menu, MenuAction, MenuButton, MenuDivider, MenuLabel, MenuPanel } from '../ui/Menu';
import { MenuItem } from '@headlessui/react';

function RoleBadge({ role }: { role: 'admin' | 'member' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded px-1.5 py-px text-2xs font-semibold uppercase tracking-wide',
        role === 'admin' ? 'bg-brand-100 text-brand-800' : 'bg-slate-100 text-slate-600',
      )}
    >
      {role === 'admin' && <ShieldCheck className="h-2.5 w-2.5" />}
      {role}
    </span>
  );
}

export function UserSwitcher() {
  const data = useData();
  const current = useCurrentUser();
  const settings = useAppStore((s) => s.settings);
  const { switchUser, setSettings, resetDemo } = useActions();
  const users = Object.values(data.users);

  return (
    <Menu>
      <MenuButton
        data-testid="user-switcher"
        className={cn(
          'flex h-9 items-center gap-2 rounded-full bg-surface py-1 pl-1 pr-2.5 shadow-card transition-shadow hover:shadow-card-hover data-[open]:shadow-card-hover',
          FOCUS_RING,
        )}
      >
        <Avatar user={current} size="md" />
        <span className="hidden flex-col items-start leading-none sm:flex">
          <span className="text-2xs font-medium text-ink-subtle">Viewing as</span>
          <span className="mt-0.5 text-sm font-semibold text-ink">{current.name.split(' ')[0]}</span>
        </span>
        <RoleBadge role={current.role} />
        <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" />
      </MenuButton>
      <MenuPanel className="w-72">
        <MenuLabel>Switch user</MenuLabel>
        {users.map((u) => {
          const lists = selectVisibleLists(data, u.id).length;
          return (
            <MenuItem key={u.id}>
              <button
                type="button"
                onClick={() => {
                  switchUser(u.id);
                  if (u.id !== current.id)
                    notify.info(
                      `Now viewing as ${u.name}`,
                      u.role === 'admin'
                        ? 'Admin — full access.'
                        : `Member — ${lists} list${lists === 1 ? '' : 's'} visible.`,
                    );
                }}
                className="flex w-full items-center gap-3 rounded-control px-2.5 py-2 text-left data-[focus]:bg-surface-sunken"
              >
                <Avatar user={u} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                    {u.name} <RoleBadge role={u.role} />
                  </span>
                  <span className="block truncate text-xs text-ink-subtle">
                    {u.title} · {u.role === 'admin' ? 'all lists' : `${lists} lists`}
                  </span>
                </span>
                {u.id === current.id && <Check className="h-4 w-4 text-brand-600" aria-label="Current user" />}
              </button>
            </MenuItem>
          );
        })}
        <MenuDivider />
        <MenuLabel>Demo controls</MenuLabel>
        <MenuAction
          icon={<FlaskConical className="h-3.5 w-3.5" />}
          hint={
            <span
              className={cn(
                'rounded px-1.5 py-px font-semibold',
                settings.simulateFailures ? 'bg-rose-100 text-rose-700' : 'bg-surface-sunken',
              )}
            >
              {settings.simulateFailures ? 'ON' : 'OFF'}
            </span>
          }
          onClick={() => setSettings({ simulateFailures: !settings.simulateFailures })}
        >
          Simulate save failures
        </MenuAction>
        <MenuAction
          icon={<RotateCcw className="h-3.5 w-3.5" />}
          onClick={() => {
            resetDemo();
            notify.success('Demo data reset', 'Seed fixtures restored.');
          }}
        >
          Reset demo data
        </MenuAction>
      </MenuPanel>
    </Menu>
  );
}
