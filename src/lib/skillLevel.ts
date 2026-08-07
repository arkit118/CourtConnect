// Single source of truth for the skill_level enum - must stay in sync
// with the CHECK constraint on profiles.skill_level (001_full_schema.sql)
// and with SkillLevel in src/types/index.ts. Previously duplicated
// (labels + colors) separately in ProfilePage.tsx and PlayersPage.tsx;
// hoisted here so signup, profile display/edit, and the player directory
// can never drift out of sync with each other or with the DB constraint.
export const SKILL_LEVELS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'varsity', label: 'Varsity' },
  { value: 'elite', label: 'Elite' },
] as const;

export const skillLevelLabels: Record<string, string> = Object.fromEntries(
  SKILL_LEVELS.map((s) => [s.value, s.label])
);

export const skillLevelOrder: string[] = SKILL_LEVELS.map((s) => s.value);

export const skillLevelColors: Record<string, string> = {
  beginner: 'bg-navy-50 text-navy-700 border-navy-200',
  intermediate: 'bg-primary-50 text-primary-700 border-primary-200',
  advanced: 'bg-clay-400/10 text-clay-600 border-clay-400/30',
  varsity: 'bg-accent-50 text-accent-700 border-accent-200',
  elite: 'bg-secondary-100 text-secondary-800 border-secondary-300',
};

// UTR's real-world scale - matches the range already enforced in
// ProfilePage's edit form and (now) the upsert_signup_profile RPC
// (019_signup_skill_utr_location.sql).
export const UTR_MIN = 1;
export const UTR_MAX = 16.5;

export function isValidUtr(value: number): boolean {
  return value >= UTR_MIN && value <= UTR_MAX;
}
