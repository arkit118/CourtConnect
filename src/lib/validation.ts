// Same permissive shape check used server-side in
// supabase/functions/send-parent-consent-email/index.ts - good enough to
// catch obvious typos before a network round trip, not a full RFC 5322
// validator.
export function isValidEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}
