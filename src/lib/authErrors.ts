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

// Maps any Supabase auth failure (AuthApiError, AuthSessionMissingError,
// withTimeout's timeout Error, a network TypeError) to a small set of
// kinds each screen turns into its own friendly, field-placed copy - so a
// raw API message never reaches the user. Matches on `code` first (stable
// across auth-js versions), falling back to message text for older
// responses that don't carry one.
export type AuthFailureKind =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'account_exists'
  | 'weak_password'
  | 'same_password'
  | 'reauthentication_needed'
  | 'invalid_reauthentication_code'
  | 'session_missing'
  | 'rate_limited'
  | 'network'
  | 'unknown';

export function classifyAuthError(err: unknown): AuthFailureKind {
  if (!err || typeof err !== 'object') return 'unknown';
  const e = err as { name?: string; code?: string; status?: number; message?: string };
  const code = e.code ?? '';
  const msg = (e.message ?? '').toLowerCase();

  if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) return 'invalid_credentials';
  if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) return 'email_not_confirmed';
  if (code === 'user_already_exists' || code === 'email_exists' || msg.includes('already registered')) return 'account_exists';
  if (code === 'weak_password' || msg.includes('password should')) return 'weak_password';
  if (code === 'same_password' || msg.includes('different from the old password')) return 'same_password';
  if (code === 'reauthentication_needed') return 'reauthentication_needed';
  if (code === 'reauthentication_not_valid') return 'invalid_reauthentication_code';
  if (code === 'session_not_found' || e.name === 'AuthSessionMissingError' || msg.includes('session missing')) {
    return 'session_missing';
  }
  if (e.status === 429 || code.startsWith('over_')) return 'rate_limited';
  if (e.status === 0 || msg.includes('failed to fetch') || msg.includes('timed out') || msg.includes('network')) {
    return 'network';
  }
  return 'unknown';
}

export const NETWORK_ERROR_MESSAGE = "We couldn't reach CourtConnect. Check your connection and try again.";
export const RATE_LIMITED_MESSAGE = 'Too many attempts. Please wait a minute and try again.';

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
