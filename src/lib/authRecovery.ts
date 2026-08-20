import { supabase } from './supabase';

// Root cause of "app hangs on every navigation after returning to the tab,
// fixed only by a hard refresh": @supabase/auth-js's own internal
// visibilitychange listener (not app code - grep the repo, there is none)
// tries to recover the session through its process-lock queue
// (PROCESS_LOCKS, a module-scope singleton inside @supabase/auth-js/src/
// lib/locks.ts) with no acquire timeout. If that recovery call never
// settles - the tab coming back from OS-level suspension is the most
// common real-world trigger - the lock is wedged for the rest of the
// tab's life: every future Supabase call (auth AND data, since every
// PostgREST query also goes through this same lock to attach its auth
// header) silently queues up behind the dead promise. withTimeout()
// (see withTimeout.ts) only races the caller's own view of a promise; it
// has no way to cancel the underlying request or clear the wedged lock,
// so it cannot fix this on its own - every subsequent call independently
// times out. A hard reload is the only thing that actually clears it,
// since PROCESS_LOCKS only exists once per JS module load.
//
// This does the same recovery the user was already doing by hand
// (refreshing the page) automatically: whenever the tab becomes visible
// again, probe the client with a cheap, already-bounded call; if it
// doesn't settle within PROBE_TIMEOUT_MS, assume the lock is wedged and
// reload. A healthy client resolves getSession() near-instantly from
// local storage, so this never fires under normal conditions.
const PROBE_TIMEOUT_MS = 5000;

export function installAuthRecovery(): () => void {
  let recovering = false;

  const handleVisibilityChange = () => {
    if (document.visibilityState !== 'visible' || recovering) return;

    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled || recovering) return;
      recovering = true;
      console.error(
        '[authRecovery] Supabase client did not respond after the tab became visible again - reloading to recover.'
      );
      window.location.reload();
    }, PROBE_TIMEOUT_MS);

    // .catch() here is not optional: getSession() rejects (rather than
    // resolving with an error) when the stored refresh token is stale -
    // see installInvalidSessionRecovery() below for the full explanation.
    // .finally() alone does not swallow a rejection, so without this catch
    // a stale token would turn every tab-refocus into an unhandled promise
    // rejection on top of whatever installInvalidSessionRecovery() already
    // does for it.
    supabase.auth.getSession().catch(() => {}).finally(() => {
      settled = true;
      window.clearTimeout(timer);
    });
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}

// installInvalidSessionRecovery() - the fix for the native-iOS
// "loads to the splash screen, then goes white/black and never recovers"
// crash - lives in lib/supabase.ts, not here, and is installed once at
// module load, immediately after the client is constructed. That failure
// comes from @supabase/auth-js's own automatic startup session-recovery
// attempt, which runs before React has mounted anything; a listener
// installed later, from a React effect (as this file's installAuthRecovery
// is), can miss it entirely if the rejection fires first. See
// lib/supabase.ts for the full explanation and lib/authErrors.ts for the
// error-matching logic shared by both that recovery path and
// AuthContext's own fetchProfile/fetchOrCreateProfile error handling.
