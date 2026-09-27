import type { ErrorCode, Result } from './types';

/** Success result: `{ data }`. */
export const ok = <T>(data: T): Result<T> => ({ data });

/** Failure result: `{ error: { code, message } }`. */
export const fail = <T = never>(code: ErrorCode, message: string): Result<T> => ({
  error: { code, message },
});

/** 403-style failure (code FORBIDDEN). */
export const forbidden = <T = never>(message = 'You do not have permission to do that.') =>
  fail<T>('FORBIDDEN', message);

/** 404-style failure (code NOT_FOUND), e.g. notFound('Task') → "Task not found." */
export const notFound = <T = never>(what = 'Resource') => fail<T>('NOT_FOUND', `${what} not found.`);
