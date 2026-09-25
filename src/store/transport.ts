/**
 * Fake network. There is no backend: the store is the source of truth, but
 * async "fetches" and "saves" go through here so loading states, optimistic
 * updates and rollbacks behave like they would against a real API.
 */
import { fail, ok } from '@/domain/result';
import type { Result } from '@/domain/types';

export interface TransportSettings {
  latencyMs: number;
  /** When on, every save fails — demo switch for optimistic-update rollback. */
  simulateFailures: boolean;
}

export const sleep = (ms: number) => (ms > 0 ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve());

export async function simulateSave(settings: TransportSettings): Promise<Result<void>> {
  // Jitter so the optimistic "saving" state is actually visible.
  await sleep(settings.latencyMs > 0 ? settings.latencyMs + Math.round(Math.random() * 250) : 0);
  if (settings.simulateFailures) return fail('NETWORK', 'Network error — the server did not accept the change.');
  return ok(undefined);
}
