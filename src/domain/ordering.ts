import type { ID } from './types';

const POSITION_STEP = 1000;

export const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

export const nextPosition = (items: { position: number }[]) =>
  items.length === 0 ? POSITION_STEP : Math.max(...items.map((i) => i.position)) + POSITION_STEP;

/** Return a copy of `ids` with `id` removed and re-inserted at `index` (clamped). */
export function moveId(ids: ID[], id: ID, index: number): ID[] {
  const without = ids.filter((x) => x !== id);
  const clamped = Math.max(0, Math.min(index, without.length));
  without.splice(clamped, 0, id);
  return without;
}

/** Evenly re-space positions for an ordered list of ids. */
export function reindex(ids: ID[]): Map<ID, number> {
  return new Map(ids.map((id, i) => [id, (i + 1) * POSITION_STEP]));
}
