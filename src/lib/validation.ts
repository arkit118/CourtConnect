// Same permissive shape check used server-side in
// supabase/functions/send-parent-consent-email/index.ts - good enough to
// catch obvious typos before a network round trip, not a full RFC 5322
// validator.
export function isValidEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

export const MIN_PASSWORD_LENGTH = 8;

// Shared by Reset Password and Settings > Change Password. Returns one
// field-specific message at a time, matching the rest of the auth forms.
export function validateNewPassword(
  password: string,
  confirm: string
): { passwordError: string | null; confirmError: string | null } {
  if (!password) return { passwordError: 'Please enter a new password.', confirmError: null };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { passwordError: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, confirmError: null };
  }
  if (!confirm) return { passwordError: null, confirmError: 'Please confirm your new password.' };
  if (confirm !== password) return { passwordError: null, confirmError: "Passwords don't match." };
  return { passwordError: null, confirmError: null };
}
