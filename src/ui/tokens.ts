/**
 * Single source of truth for status / priority / avatar styling, so a status
 * or priority looks identical on kanban cards, list rows, the drawer and search.
 * (Full class strings on purpose — Tailwind's JIT needs to see them literally.)
 */
import type { AvatarColor, Priority, StatusColor } from '@/domain/types';

export const STATUS_STYLES: Record<StatusColor, { dot: string; pill: string; text: string }> = {
  slate: { dot: 'bg-slate-400', pill: 'bg-slate-100 text-slate-700 ring-slate-200', text: 'text-slate-600' },
  blue: { dot: 'bg-blue-500', pill: 'bg-blue-50 text-blue-700 ring-blue-200', text: 'text-blue-600' },
  violet: { dot: 'bg-violet-500', pill: 'bg-violet-50 text-violet-700 ring-violet-200', text: 'text-violet-600' },
  amber: { dot: 'bg-amber-500', pill: 'bg-amber-50 text-amber-800 ring-amber-200', text: 'text-amber-700' },
  emerald: { dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200', text: 'text-emerald-600' },
  rose: { dot: 'bg-rose-500', pill: 'bg-rose-50 text-rose-700 ring-rose-200', text: 'text-rose-600' },
};

export const STATUS_COLORS = Object.keys(STATUS_STYLES) as StatusColor[];

export const PRIORITY_STYLES: Record<Priority, { label: string; badge: string; icon: string }> = {
  urgent: { label: 'Urgent', badge: 'bg-rose-50 text-rose-700 ring-rose-200', icon: 'text-rose-600' },
  high: { label: 'High', badge: 'bg-orange-50 text-orange-700 ring-orange-200', icon: 'text-orange-500' },
  normal: { label: 'Normal', badge: 'bg-sky-50 text-sky-700 ring-sky-200', icon: 'text-sky-500' },
  low: { label: 'Low', badge: 'bg-slate-100 text-slate-600 ring-slate-200', icon: 'text-slate-400' },
  none: { label: 'No priority', badge: 'bg-transparent text-ink-subtle ring-line', icon: 'text-ink-faint' },
};

export const AVATAR_STYLES: Record<AvatarColor, string> = {
  violet: 'bg-violet-100 text-violet-700',
  sky: 'bg-sky-100 text-sky-700',
  amber: 'bg-amber-100 text-amber-800',
  emerald: 'bg-emerald-100 text-emerald-700',
  rose: 'bg-rose-100 text-rose-700',
};

/** Shared focus ring for every interactive element. */
export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-1';
