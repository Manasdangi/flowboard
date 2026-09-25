/**
 * Seed fixtures. Ids are stable (tests rely on them); dates are relative to
 * `now` so due dates always look fresh in a demo.
 *
 * Flowboard HQ (workspace)
 * ├── Engineering (public space)
 * │   └── Q2 Launch (folder)
 * │       ├── Backlog          public
 * │       ├── Sprint 14        public      — Carol: DENY
 * │       ├── Security Audit   private     — Bob: ALLOW
 * │       └── Q1 Retro         (archived)
 * └── Marketing (private space)            — Carol: ALLOW
 *     └── Brand Refresh (folder)
 *         ├── Campaigns        public (inherits Marketing's privacy)
 *         └── Launch Content   public      — Bob: ALLOW (shows restricted path)
 */
import type {
  Container,
  DataState,
  Grant,
  ID,
  Priority,
  Status,
  StatusCategory,
  StatusColor,
  Task,
  User,
} from '@/domain/types';

export const SEED_IDS = {
  workspace: 'ws_flowboard',
  users: { alice: 'u_alice', bob: 'u_bob', carol: 'u_carol' },
  spaces: { engineering: 'sp_eng', marketing: 'sp_mkt' },
  folders: { q2: 'fd_q2', brand: 'fd_brand' },
  lists: {
    backlog: 'ls_backlog',
    sprint: 'ls_sprint',
    security: 'ls_security',
    retro: 'ls_retro',
    campaigns: 'ls_campaigns',
    launch: 'ls_launch',
  },
} as const;

const { users: U, lists: L } = SEED_IDS;

const users: User[] = [
  {
    id: U.alice,
    name: 'Alice Chen',
    email: 'alice@flowboard.dev',
    role: 'admin',
    title: 'Head of Product',
    avatarColor: 'violet',
  },
  {
    id: U.bob,
    name: 'Bob Martinez',
    email: 'bob@flowboard.dev',
    role: 'member',
    title: 'Frontend Engineer',
    avatarColor: 'sky',
  },
  {
    id: U.carol,
    name: 'Carol Singh',
    email: 'carol@flowboard.dev',
    role: 'member',
    title: 'Marketing Lead',
    avatarColor: 'amber',
  },
];

type StatusDef = [key: string, name: string, category: StatusCategory, color: StatusColor];

const STATUS_SETS: Record<string, StatusDef[]> = {
  [L.backlog]: [
    ['todo', 'To do', 'todo', 'slate'],
    ['doing', 'In progress', 'in_progress', 'blue'],
    ['done', 'Done', 'done', 'emerald'],
  ],
  [L.sprint]: [
    ['todo', 'To do', 'todo', 'slate'],
    ['doing', 'In progress', 'in_progress', 'blue'],
    ['review', 'In review', 'in_progress', 'violet'],
    ['done', 'Done', 'done', 'emerald'],
  ],
  [L.security]: [
    ['open', 'Open', 'todo', 'rose'],
    ['investigating', 'Investigating', 'in_progress', 'amber'],
    ['resolved', 'Resolved', 'done', 'emerald'],
  ],
  [L.retro]: [
    ['todo', 'To do', 'todo', 'slate'],
    ['done', 'Done', 'done', 'emerald'],
  ],
  [L.campaigns]: [
    ['ideas', 'Ideas', 'todo', 'slate'],
    ['drafting', 'Drafting', 'in_progress', 'amber'],
    ['scheduled', 'Scheduled', 'in_progress', 'violet'],
    ['published', 'Published', 'done', 'emerald'],
  ],
  [L.launch]: [
    ['todo', 'To do', 'todo', 'slate'],
    ['doing', 'Writing', 'in_progress', 'blue'],
    ['done', 'Shipped', 'done', 'emerald'],
  ],
};

/** Stable status id, e.g. statusId('ls_sprint', 'review') → 'st_ls_sprint_review'. */
export const statusId = (listId: ID, key: string) => `st_${listId}_${key}`;

interface TaskDef {
  id: string;
  list: ID;
  status: string;
  title: string;
  description?: string;
  priority?: Priority;
  assignees?: ID[];
  /** Days from now; negative = overdue. */
  due?: number;
  parent?: string;
}

const TASKS: TaskDef[] = [
  // Backlog (12 top-level → exercises list-view pagination)
  {
    id: 't_bl_1',
    list: L.backlog,
    status: 'todo',
    title: 'Design empty states for boards and lists',
    priority: 'normal',
    assignees: [U.bob],
    due: 6,
    description: 'Cover: empty list, empty column, no search results, no access.',
  },
  {
    id: 't_bl_2',
    list: L.backlog,
    status: 'todo',
    title: 'Keyboard navigation for the sidebar tree',
    priority: 'low',
    assignees: [U.bob],
    due: 14,
  },
  {
    id: 't_bl_3',
    list: L.backlog,
    status: 'todo',
    title: 'Audit color contrast on status pills',
    priority: 'normal',
    assignees: [U.alice],
    description: 'Target WCAG AA for text on tinted backgrounds.',
  },
  { id: 't_bl_4', list: L.backlog, status: 'todo', title: 'Spike: realtime sync with CRDTs', priority: 'none' },
  { id: 't_bl_5', list: L.backlog, status: 'todo', title: 'Add CSV export to list view', priority: 'low', due: 21 },
  {
    id: 't_bl_6',
    list: L.backlog,
    status: 'doing',
    title: 'Onboarding checklist for new workspaces',
    priority: 'high',
    assignees: [U.alice, U.bob],
    due: 3,
    description: 'Three steps: create a space, invite teammates, create first task.',
  },
  {
    id: 't_bl_7',
    list: L.backlog,
    status: 'doing',
    title: 'Write migration guide from spreadsheets',
    priority: 'normal',
    assignees: [U.carol],
    due: 9,
  },
  {
    id: 't_bl_8',
    list: L.backlog,
    status: 'doing',
    title: 'Reduce bundle size below 200 kB',
    priority: 'high',
    assignees: [U.bob],
    due: -1,
  },
  {
    id: 't_bl_9',
    list: L.backlog,
    status: 'done',
    title: 'Set up Vite + Tailwind scaffold',
    priority: 'normal',
    assignees: [U.bob],
    due: -8,
  },
  {
    id: 't_bl_10',
    list: L.backlog,
    status: 'done',
    title: 'Define design tokens',
    priority: 'normal',
    assignees: [U.alice],
    due: -6,
  },
  {
    id: 't_bl_11',
    list: L.backlog,
    status: 'done',
    title: 'Seed fixtures for demo workspace',
    priority: 'low',
    assignees: [U.bob],
    due: -5,
  },
  {
    id: 't_bl_12',
    list: L.backlog,
    status: 'todo',
    title: 'Dark mode exploration',
    priority: 'none',
    description: 'Out of scope for v1 — parking here.',
  },
  {
    id: 't_bl_6a',
    list: L.backlog,
    status: 'done',
    title: 'Draft checklist copy',
    parent: 't_bl_6',
    assignees: [U.alice],
  },
  {
    id: 't_bl_6b',
    list: L.backlog,
    status: 'todo',
    title: 'Build checklist component',
    parent: 't_bl_6',
    assignees: [U.bob],
  },
  { id: 't_bl_6c', list: L.backlog, status: 'todo', title: 'Track completion analytics', parent: 't_bl_6' },

  // Sprint 14
  {
    id: 't_sp_1',
    list: L.sprint,
    status: 'todo',
    title: 'Task detail drawer with focus trap',
    priority: 'high',
    assignees: [U.bob],
    due: 2,
  },
  {
    id: 't_sp_2',
    list: L.sprint,
    status: 'todo',
    title: 'Permission-aware sidebar tree',
    priority: 'urgent',
    assignees: [U.alice, U.bob],
    due: 1,
    description: 'Tree must only include nodes the current user can see.',
  },
  {
    id: 't_sp_3',
    list: L.sprint,
    status: 'doing',
    title: 'Kanban drag-and-drop between columns',
    priority: 'urgent',
    assignees: [U.bob],
    due: 0,
    description: 'Use dnd-kit. Visible drag preview + drop target highlight.',
  },
  {
    id: 't_sp_4',
    list: L.sprint,
    status: 'doing',
    title: 'Toast notifications for failed mutations',
    priority: 'normal',
    assignees: [U.alice],
    due: 4,
  },
  {
    id: 't_sp_5',
    list: L.sprint,
    status: 'review',
    title: 'List view sorting by due date and priority',
    priority: 'high',
    assignees: [U.bob],
    due: -2,
  },
  {
    id: 't_sp_6',
    list: L.sprint,
    status: 'done',
    title: 'User switcher in the top bar',
    priority: 'normal',
    assignees: [U.alice],
    due: -3,
  },
  {
    id: 't_sp_7',
    list: L.sprint,
    status: 'done',
    title: 'Skeleton loaders for tree and board',
    priority: 'low',
    assignees: [U.bob],
    due: -4,
  },
  { id: 't_sp_3a', list: L.sprint, status: 'done', title: 'Drag overlay card', parent: 't_sp_3', assignees: [U.bob] },
  {
    id: 't_sp_3b',
    list: L.sprint,
    status: 'doing',
    title: 'Persist position after drop',
    parent: 't_sp_3',
    assignees: [U.bob],
  },

  // Security Audit (private — Bob allowed)
  {
    id: 't_sec_1',
    list: L.security,
    status: 'open',
    title: 'Rotate staging API keys',
    priority: 'urgent',
    assignees: [U.alice],
    due: 1,
    description: 'Keys were shared in a screenshot on the team channel.',
  },
  {
    id: 't_sec_2',
    list: L.security,
    status: 'investigating',
    title: 'XSS in markdown description renderer',
    priority: 'high',
    assignees: [U.bob],
    due: 2,
  },
  {
    id: 't_sec_3',
    list: L.security,
    status: 'open',
    title: 'Enable CSP headers on preview deploys',
    priority: 'normal',
    assignees: [U.bob],
    due: 7,
  },
  {
    id: 't_sec_4',
    list: L.security,
    status: 'resolved',
    title: 'Remove unused OAuth scopes',
    priority: 'low',
    assignees: [U.alice],
    due: -10,
  },

  // Q1 Retro (archived)
  {
    id: 't_retro_1',
    list: L.retro,
    status: 'done',
    title: 'Collect retro notes',
    priority: 'low',
    assignees: [U.alice],
  },

  // Campaigns (Marketing — Carol allowed)
  {
    id: 't_cmp_1',
    list: L.campaigns,
    status: 'ideas',
    title: 'Customer story: Acme migrates from spreadsheets',
    priority: 'normal',
    assignees: [U.carol],
  },
  {
    id: 't_cmp_2',
    list: L.campaigns,
    status: 'ideas',
    title: 'Webinar: planning a quarter in Flowboard',
    priority: 'low',
    due: 20,
  },
  {
    id: 't_cmp_3',
    list: L.campaigns,
    status: 'drafting',
    title: 'Launch email sequence (3 emails)',
    priority: 'high',
    assignees: [U.carol, U.alice],
    due: 5,
  },
  {
    id: 't_cmp_4',
    list: L.campaigns,
    status: 'scheduled',
    title: 'Product Hunt launch post',
    priority: 'urgent',
    assignees: [U.carol],
    due: 3,
    description: 'Confidential until launch day.',
  },
  {
    id: 't_cmp_5',
    list: L.campaigns,
    status: 'published',
    title: 'Teaser video on socials',
    priority: 'normal',
    assignees: [U.carol],
    due: -2,
  },

  // Launch Content (Marketing — Bob allowed)
  {
    id: 't_lc_1',
    list: L.launch,
    status: 'doing',
    title: 'Engineering blog: how we built the kanban',
    priority: 'normal',
    assignees: [U.bob, U.carol],
    due: 8,
  },
  {
    id: 't_lc_2',
    list: L.launch,
    status: 'todo',
    title: 'Changelog entry for v1.0',
    priority: 'low',
    assignees: [U.bob],
    due: 10,
  },
];

export function createSeed(now: Date = new Date()): DataState {
  const at = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000).toISOString();
  const dueIn = (days: number) => {
    const d = new Date(now);
    d.setHours(17, 0, 0, 0);
    d.setDate(d.getDate() + days);
    return d.toISOString();
  };
  const created = at(30);

  const c = (
    id: ID,
    name: string,
    type: Container['type'],
    parentId: ID | null,
    position: number,
    extra: Partial<Container> = {},
  ): Container => ({
    id,
    name,
    type,
    parentId,
    position,
    visibility: 'public',
    archivedAt: null,
    createdAt: created,
    updatedAt: created,
    ...extra,
  });

  const containers: Container[] = [
    c(SEED_IDS.workspace, 'Flowboard HQ', 'workspace', null, 0),
    c(SEED_IDS.spaces.engineering, 'Engineering', 'space', SEED_IDS.workspace, 1000),
    c(SEED_IDS.spaces.marketing, 'Marketing', 'space', SEED_IDS.workspace, 2000, { visibility: 'private' }),
    c(SEED_IDS.folders.q2, 'Q2 Launch', 'folder', SEED_IDS.spaces.engineering, 1000),
    c(SEED_IDS.folders.brand, 'Brand Refresh', 'folder', SEED_IDS.spaces.marketing, 1000),
    c(L.backlog, 'Backlog', 'list', SEED_IDS.folders.q2, 1000),
    c(L.sprint, 'Sprint 14', 'list', SEED_IDS.folders.q2, 2000),
    c(L.security, 'Security Audit', 'list', SEED_IDS.folders.q2, 3000, { visibility: 'private' }),
    c(L.retro, 'Q1 Retro', 'list', SEED_IDS.folders.q2, 4000, { archivedAt: at(12) }),
    c(L.campaigns, 'Campaigns', 'list', SEED_IDS.folders.brand, 1000),
    c(L.launch, 'Launch Content', 'list', SEED_IDS.folders.brand, 2000),
  ];

  const statuses: Status[] = Object.entries(STATUS_SETS).flatMap(([listId, defs]) =>
    defs.map(([key, name, category, color], i) => ({
      id: statusId(listId, key),
      listId,
      name,
      category,
      color,
      position: (i + 1) * 1000,
    })),
  );

  const counters = new Map<string, number>();
  const tasks: Task[] = TASKS.map((def, i) => {
    const bucket = def.parent ?? `${def.list}:${def.status}`;
    const position = ((counters.get(bucket) ?? 0) + 1) * 1000;
    counters.set(bucket, position / 1000);
    const createdAt = at(20 - (i % 15));
    return {
      id: def.id,
      title: def.title,
      description: def.description ?? '',
      primaryListId: def.list,
      statusId: statusId(def.list, def.status),
      priority: def.priority ?? 'none',
      assigneeIds: def.assignees ?? [],
      dueDate: def.due === undefined ? null : dueIn(def.due),
      position,
      parentTaskId: def.parent ?? null,
      createdBy: U.alice,
      createdAt,
      updatedAt: at(Math.max(0, 10 - (i % 11))),
    };
  });

  const grants: Grant[] = [
    { id: 'g_bob_security', resourceId: L.security, userId: U.bob, mode: 'allow' },
    { id: 'g_bob_launch', resourceId: L.launch, userId: U.bob, mode: 'allow' },
    { id: 'g_carol_marketing', resourceId: SEED_IDS.spaces.marketing, userId: U.carol, mode: 'allow' },
    { id: 'g_carol_sprint', resourceId: L.sprint, userId: U.carol, mode: 'deny' },
  ];

  const byId = <T extends { id: ID }>(items: T[]) => Object.fromEntries(items.map((x) => [x.id, x]));
  return {
    workspaceId: SEED_IDS.workspace,
    users: byId(users),
    containers: byId(containers),
    statuses: byId(statuses),
    tasks: byId(tasks),
    grants: byId(grants),
  };
}
