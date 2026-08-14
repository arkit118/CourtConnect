// Basic objectionable-content filter for user-generated text: profile
// bios, chat messages, gear listings, schedule notes, and event
// descriptions/rules/FAQ. This is a client-side first line of defense for
// immediate feedback - see supabase/migrations/*_021_content_filter.sql
// for the server-side enforcement (a Postgres trigger using the same
// category of terms) that actually blocks the write if this is bypassed.
//
// Deliberately narrow and severity-focused (slurs, explicit sexual
// solicitation, hard profanity) rather than a broad topic blocklist -
// normal tennis/community language ("smash", "ball", "shaft", "match",
// "score", etc.) must never trip this. When in doubt, a term is left out
// rather than risk a false positive on legitimate content.
const BLOCKED_TERMS = [
  'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'dick', 'pussy', 'bastard',
  'nigger', 'nigga', 'faggot', 'retard', 'whore', 'slut',
  'kill yourself', 'kys',
];

// Matches a blocked term as a whole word (or short phrase), case
// insensitive, so it never fires on a substring inside an unrelated word
// (e.g. never on "classic", "assassinate", "scunthorpe"-style
// false-positive risk).
const BLOCKED_PATTERN = new RegExp(
  `\\b(${BLOCKED_TERMS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
  'i'
);

export const CONTENT_BLOCKED_MESSAGE =
  "This text contains content that isn't allowed on CourtConnect. Please revise and try again.";

// Checked before any user-generated text is submitted (bio, chat message,
// gear listing, schedule note, event description/rules/FAQ). Returns
// whether the text should be blocked - callers show CONTENT_BLOCKED_MESSAGE
// and stop the submission rather than silently stripping anything.
export function containsBlockedContent(text: string | null | undefined): boolean {
  if (!text) return false;
  return BLOCKED_PATTERN.test(text);
}
