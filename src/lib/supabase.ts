import { createClient, processLock } from '@supabase/supabase-js';
import { isInvalidSessionError } from './authErrors';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // QA fix: by default, when navigator.locks is available (all modern
    // browsers), @supabase/auth-js serializes every auth/session
    // operation - including the implicit token check every single
    // .from()/.rpc() call makes before it can attach an Authorization
    // header - behind a Web Locks API mutex (navigatorLock), meant to
    // coordinate token refreshes across multiple tabs of the same origin.
    // Root-caused during QA: on a fresh full-page load with a persisted
    // session, this lock reliably never resolved, so *every* Supabase
    // request in that tab (not just auth calls - `courts`, `profiles`,
    // etc. too) stalled indefinitely behind it, capped only by the
    // withTimeout() wrappers added elsewhere in this app to turn that
    // hang into a visible error instead of an infinite spinner. Switching
    // to processLock keeps requests correctly serialized within a single
    // tab using a plain in-memory promise chain instead of the browser
    // Locks API, which does not exhibit this hang. The tradeoff is losing
    // cross-tab coordination of token refreshes (a user with two tabs
    // open could very rarely see one tab's refresh briefly race another's)
    // - a much smaller, rarer risk than every signed-in page load stalling.
    lock: processLock,
  },
});

// Native-iOS boot crash fix: "app loads to the CourtConnect splash
// screen, then goes white/black and never recovers," with an AuthApiError
// (status 400, code refresh_token_not_found / invalid_refresh_token /
// session_not_found) in the Xcode console. Root cause: the client above
// automatically attempts to recover any previously-persisted session the
// instant it's constructed - i.e. right now, synchronously, before this
// module has even finished being imported by main.tsx, let alone before
// React has mounted anything. Capacitor's WebView keeps localStorage
// (including a stored refresh token) across full app relaunches far more
// durably than a normal browser tab, so a token that's since been
// rotated, revoked, or has simply expired is still sitting there the next
// time the app boots - and that automatic recovery attempt then rejects.
// That rejection happens completely outside any React lifecycle, so a
// React error boundary (components/ErrorBoundary.tsx) can never catch it
// - only a global unhandledrejection listener can, and it has to be
// installed here, at module load, rather than from a React effect
// (compare lib/authRecovery.ts's installAuthRecovery, which handles a
// different, runtime-only failure mode and is safe to install later) -
// anything later risks missing a rejection that fires first.
//
// On a match, this clears the stale session locally (scope: 'local' - no
// network call, since the server has already rejected this exact token
// and there's nothing meaningful left to revoke) and marks the rejection
// handled. supabase.auth.signOut() synchronously notifies every
// onAuthStateChange subscriber with a SIGNED_OUT event, so AuthContext's
// listener (see contexts/AuthContext.tsx) picks this up through its
// normal path - clearing profile/profileError and resolving `loading` to
// false, landing the user cleanly on the sign-in page - without this file
// needing any direct access to AuthContext's state. AuthContext's own
// fetchProfile/fetchOrCreateProfile also check isInvalidSessionError
// directly, for the same error class surfacing from a call this listener
// can't see (an explicitly awaited getSession()/query elsewhere) rather
// than the client's own background refresh timer.
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (!isInvalidSessionError(event.reason)) return;

    console.error(
      '[supabase] Clearing a stale/invalid session after a refresh-token error (this is expected and handled):',
      event.reason
    );
    event.preventDefault();

    void supabase.auth.signOut({ scope: 'local' }).catch((err) => {
      console.error('[supabase] Local sign-out after invalid session failed:', err);
    });
  });
}

export type Profile = {
  id: string;
  name: string;
  bio: string | null;
  avatar_url: string | null;
  role: 'player' | 'admin';
  home_town: string | null;
  skill_level: 'beginner' | 'intermediate' | 'advanced' | 'varsity' | 'elite' | null;
  utr_rating: number | null;
  preferred_play_style: string | null;
  availability: string[];
  favorite_courts: string[];
  years_playing: number | null;
  date_of_birth: string | null;
  age_band: 'minor' | 'adult' | null;
  tos_accepted_at: string | null;
  tos_version: string | null;
  privacy_accepted_at: string | null;
  privacy_version: string | null;
  safety_acknowledged_at: string | null;
  is_banned: boolean;
  banned_at: string | null;
  ban_reason: string | null;
  social_features_enabled: boolean;
  matching_enabled: boolean;
  chat_safety_acknowledged_at: string | null;
  parent_consent_status: 'not_required' | 'pending' | 'approved' | 'declined' | 'revoked';
  parent_consent_requested_at: string | null;
  parent_consent_decided_at: string | null;
  parent_consent_decision: 'approved' | 'declined' | null;
  parent_consent_email_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Event = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  date: string;
  start_time: string;
  end_time: string;
  venue: string;
  address: string | null;
  town: string;
  capacity: number;
  entry_fee: number;
  organizer_id: string | null;
  registration_count: number;
  status: 'open' | 'full' | 'completed' | 'cancelled';
  rules: string | null;
  faq: string | null;
  created_at: string;
  updated_at: string;
  organizer?: Profile;
};

export type Registration = {
  id: string;
  event_id: string;
  user_id: string;
  status: 'registered' | 'attended' | 'cancelled';
  payment_status: 'free' | 'pending' | 'paid' | 'refunded';
  stripe_payment_intent_id: string | null;
  created_at: string;
  profile?: Profile;
  event?: Event;
};

export type PartnerRequest = {
  id: string;
  requester_id: string;
  recipient_id: string;
  proposed_date: string;
  proposed_time: string;
  proposed_location: string;
  message: string | null;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  updated_at: string;
  requester?: Profile;
  recipient?: Profile;
};

export type GearListing = {
  id: string;
  seller_id: string;
  title: string;
  description: string | null;
  photos: string[];
  category: 'racquets' | 'shoes' | 'bags' | 'strings' | 'apparel' | 'accessories' | 'other';
  condition: 'new' | 'like-new' | 'good' | 'fair';
  price: number;
  town: string | null;
  is_active: boolean;
  interested_count: number;
  created_at: string;
  updated_at: string;
  seller?: Profile;
};

export type Comment = {
  id: string;
  commentable_type: 'event' | 'listing';
  commentable_id: string;
  user_id: string;
  content: string;
  is_flagged: boolean;
  created_at: string;
  updated_at: string;
  profile?: Profile;
};

export type Court = {
  id: string;
  name: string;
  address: string;
  town: string;
  surface_type: 'hard' | 'clay' | 'grass' | 'synthetic' | 'carpet' | 'other' | null;
  num_courts: number;
  has_lights: boolean;
  booking_url: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type CourtBooking = {
  id: string;
  court_id: string;
  user_id: string;
  player_name: string;
  opponent_name: string;
  match_type: 'Singles' | 'Doubles' | 'Practice' | 'Hitting';
  court_number: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  status: 'Scheduled' | 'Cancelled';
  created_at: string;
  updated_at: string;
  court?: Court;
};

export type ImpactMetric = {
  id: string;
  metric_type: 'players' | 'events' | 'matches' | 'savings' | 'donations' | 'gear_exchanges';
  value: number;
  updated_at: string;
};

export type ReportType = 'user' | 'gear_listing' | 'court_booking' | 'event' | 'court' | 'general' | 'match' | 'message';

export type ReportStatus = 'open' | 'reviewed' | 'actioned' | 'dismissed';

export type Report = {
  id: string;
  reporter_id: string | null;
  reported_user_id: string | null;
  report_type: ReportType;
  target_id: string | null;
  reason: string;
  details: string | null;
  status: ReportStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type MatchStatus = 'pending' | 'active' | 'declined' | 'ended' | 'blocked';

export type Match = {
  id: string;
  user_a: string;
  user_b: string;
  requested_by: string | null;
  age_band: 'minor' | 'adult' | null;
  status: MatchStatus;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
  ended_at: string | null;
  blocked_at: string | null;
};

export type Message = {
  id: string;
  match_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  deleted_at: string | null;
  reported: boolean;
};

export type Block = {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
};

// Returned by the get_match_candidates() RPC - deliberately only the
// safe fields a candidate card needs, never date_of_birth, parent_email,
// ban_reason, or any other sensitive column.
export type MatchCandidate = {
  id: string;
  name: string;
  home_town: string | null;
  skill_level: Profile['skill_level'];
  utr_rating: number | null;
  preferred_play_style: string | null;
  availability: string[];
  bio: string | null;
  age_band: 'minor' | 'adult';
  avatar_url: string | null;
  created_at: string;
};
