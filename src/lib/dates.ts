const DAY = 86_400_000;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export type DueTone = 'overdue' | 'today' | 'soon' | 'later' | 'done';

/** Human label + urgency tone for a due date, relative to `now`. */
export function describeDue(
  iso: string,
  opts: { now?: Date; done?: boolean } = {},
): { label: string; tone: DueTone; full: string } {
  const now = opts.now ?? new Date();
  const due = new Date(iso);
  const days = Math.round((startOfDay(due) - startOfDay(now)) / DAY);
  const full = due.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const short = due.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(due.getFullYear() !== now.getFullYear() && { year: 'numeric' }),
  });

  let label = short;
  if (days === 0) label = 'Today';
  else if (days === 1) label = 'Tomorrow';
  else if (days === -1) label = 'Yesterday';

  let tone: DueTone = 'later';
  if (opts.done) tone = 'done';
  else if (days < 0) tone = 'overdue';
  else if (days === 0) tone = 'today';
  else if (days <= 3) tone = 'soon';
  return { label, tone, full };
}

/** ISO → value for <input type="date"> in local time. */
export function toDateInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** <input type="date"> value → ISO datetime at 5pm local ("end of working day"). */
export function fromDateInput(value: string): string | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 17, 0, 0, 0).toISOString();
}

export function formatRelative(iso: string, now = new Date()): string {
  const diff = now.getTime() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
