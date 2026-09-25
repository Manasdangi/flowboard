import type { ErrorCode, Result } from './types';

export const ok = <T>(data: T): Result<T> => ({ data });

export const fail = <T = never>(code: ErrorCode, message: string): Result<T> => ({
  error: { code, message },
});

export const forbidden = <T = never>(message = 'You do not have permission to do that.') =>
  fail<T>('FORBIDDEN', message);

export const notFound = <T = never>(what = 'Resource') => fail<T>('NOT_FOUND', `${what} not found.`);
