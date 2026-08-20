// Supabase auth error codes/messages that mean "the session we had is no
// longer valid" - a stale, rotated, or revoked refresh token. None of
// these are the user's fault, and none of them are things retrying or
// showing a generic error can fix - the only correct response is to clear
// the stale local session and let the user sign in again.
//
// This is hit far more often on native iOS than on web: Capacitor's
// WebView persists localStorage (including the stored refresh token)
// across full app launches much more durably than a browser tab, so a
// token that was rotated/invalidated (e.g. the user signed in elsewhere,
// changed their password, or it simply expired while the app was closed
// for a long time) is still sitting in storage the next time the app
// boots. @supabase/auth-js tries to recover that session automatically
// the moment the client is created (see lib/supabase.ts), before React
// even mounts - see lib/authRecovery.ts's installInvalidSessionRecovery()
// for where the resulting rejection is actually caught.
const INVALID_SESSION_CODES = new Set([
  'refresh_token_not_found',
  'invalid_refresh_token',
  'session_not_found',
]);

const INVALID_SESSION_MESSAGE_PATTERN = /refresh_token_not_found|invalid_refresh_token|session_not_found|refresh token/i;

export function isInvalidSessionError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; code?: string; status?: number; message?: string };

  if (e.code && INVALID_SESSION_CODES.has(e.code)) return true;

  // Some SDK versions/paths don't populate `code`, only `name` (AuthApiError)
  // + `status` + `message` - fall back to matching the message text for the
  // same underlying causes rather than requiring an exact code match.
  if (e.status === 400 && typeof e.message === 'string' && INVALID_SESSION_MESSAGE_PATTERN.test(e.message)) {
    return true;
  }

  return false;
}
