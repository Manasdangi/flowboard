import { Lock, Printer } from 'lucide-react';
import type { ReactNode } from 'react';
import { selectSprintReport, type SprintReportView } from '@/domain/selectors';
import type { ID } from '@/domain/types';
import { formatDay } from '@/lib/dates';
import { useAppStore, useDataWith } from '@/store/hooks';
import { Avatar, AvatarStack } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Modal } from '../ui/Modal';

/** A finished sprint's report: how it went, who finished what, and what spilled over. Printable. */
export function SprintReportDialog({ sprintId, onClose }: { sprintId: ID; onClose: () => void }) {
  const data = useDataWith('sprints');
  const userId = useAppStore((s) => s.currentUserId);
  const view = selectSprintReport(data, userId, sprintId);

  if (view.error) {
    return (
      <Modal open size="sm" onClose={onClose} title="Sprint report">
        <EmptyState tone="danger" icon={<Lock className="h-6 w-6" />} title="Can’t open this report">
          {view.error.message}
        </EmptyState>
      </Modal>
    );
  }
  const { sprint, report, listName, startedBy, endedBy, people, tasks } = view.data;
  const percent = report.total ? Math.round((report.done / report.total) * 100) : 0;

  return (
    <Modal
      open
      printable
      size="lg"
      onClose={onClose}
      title={`${sprint.name} · sprint report`}
      description={
        <>
          {listName} · {formatDay(sprint.startedAt)} – {formatDay(sprint.endedAt ?? sprint.startedAt)}
          <br />
          Started by {startedBy?.name ?? 'someone'}, ended by {endedBy?.name ?? 'someone'}
        </>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" aria-hidden /> Print report
          </Button>
        </>
      }
    >
      {report.total === 0 ? (
        <p className="text-sm text-ink-muted">No tasks were part of this sprint.</p>
      ) : (
        <div className="space-y-5">
          <dl className="grid grid-cols-4 gap-2">
            <Stat label="Tasks" value={report.total} />
            <Stat label="Done" value={report.done} tone="text-emerald-700" />
            <Stat label="Spilled over" value={report.spilled} tone={report.spilled ? 'text-amber-700' : undefined} />
            <Stat label="Completed" value={`${percent}%`} />
          </dl>

          <PeopleTable people={people} />

          <TaskGroup
            title="Done"
            tasks={tasks.filter((t) => t.outcome === 'done')}
            empty="Nothing was finished."
            trailing={(t) => <AvatarStack users={t.assignees} />}
          />
          <TaskGroup
            title="Spilled over"
            note="Still open; these stay in the list for the next sprint."
            tasks={tasks.filter((t) => t.outcome === 'spilled')}
            empty="Everything was finished."
            trailing={(t) => <span className="text-xs text-ink-subtle">{t.status}</span>}
          />
        </div>
      )}
    </Modal>
  );
}

function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="rounded-card bg-surface-muted px-3 py-2 ring-1 ring-inset ring-line">
      <dt className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">{label}</dt>
      <dd className={`mt-0.5 text-xl font-semibold tabular-nums ${tone ?? 'text-ink'}`}>{value}</dd>
    </div>
  );
}

function PeopleTable({ people }: { people: SprintReportView['people'] }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">By person</h3>
      <table aria-label="Tasks by person" className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
            <th scope="col" className="py-1.5 pr-2 font-semibold">
              Person
            </th>
            <th scope="col" className="w-20 py-1.5 text-right font-semibold">
              Done
            </th>
            <th scope="col" className="w-28 py-1.5 text-right font-semibold">
              Spilled over
            </th>
          </tr>
        </thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.user?.id ?? 'unassigned'} className="border-b border-line last:border-0">
              <th scope="row" className="py-2 pr-2 text-left font-medium text-ink">
                <span className="flex items-center gap-2">
                  {p.user ? (
                    <Avatar user={p.user} size="sm" />
                  ) : (
                    <span aria-hidden className="h-6 w-6 rounded-full bg-surface-sunken" />
                  )}
                  {p.user?.name ?? 'Unassigned'}
                </span>
              </th>
              <td className="py-2 text-right tabular-nums text-emerald-700">{p.done}</td>
              <td className="py-2 text-right tabular-nums text-amber-700">{p.spilled}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1.5 text-2xs text-ink-subtle">A task shared by several people counts once for each of them.</p>
    </section>
  );
}

function TaskGroup({
  title,
  note,
  tasks,
  empty,
  trailing,
}: {
  title: string;
  note?: string;
  tasks: SprintReportView['tasks'];
  empty: string;
  trailing: (task: SprintReportView['tasks'][number]) => ReactNode;
}) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
        {title} ({tasks.length})
      </h3>
      {note && <p className="mt-0.5 text-2xs text-ink-subtle">{note}</p>}
      {tasks.length === 0 ? (
        <p className="mt-2 text-xs text-ink-subtle">{empty}</p>
      ) : (
        <ul aria-label={title} className="mt-2 divide-y divide-line rounded-card ring-1 ring-line">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{t.title}</span>
              {trailing(t)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
