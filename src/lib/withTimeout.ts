// Guarantees any promise-like value (including the Supabase client's
// thenables) always settles within `ms`, even if the underlying network
// request or the supabase-js internal auth/session lock hangs. Without
// this, a stuck getSession()/query can leave loading state stuck forever
// with zero visible network activity, since the hang happens before the
// browser ever dispatches a fetch.
export function withTimeout<T>(promise: PromiseLike<T>, ms: number, timeoutMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutMessage)), ms);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

// Postgres/PostgREST error codes that mean "a column this code expects
// doesn't exist in the database" - i.e. a migration hasn't been applied
// yet. Used to show a clear migration-error message instead of a silent
// failure or a blank screen.
const MISSING_COLUMN_CODES = new Set(['42703', 'PGRST204']);

export function isMissingColumnError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: string }).code;
  const message = (err as { message?: string }).message || '';
  return (code != null && MISSING_COLUMN_CODES.has(code)) || /column .* does not exist/i.test(message);
}

export const devLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
};
