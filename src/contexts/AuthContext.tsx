import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, Profile, initialAuthRedirect } from '../lib/supabase';
import { withTimeout, isMissingColumnError, devLog } from '../lib/withTimeout';
import { isInvalidSessionError } from '../lib/authErrors';
import { installAuthRecovery } from '../lib/authRecovery';
import { authRedirectOrigin } from '../lib/openExternal';

const AUTH_TIMEOUT_MS = 8000;

// Renamed from SignUpLegalInfo - originally just date_of_birth/age_band,
// now also carries the skill_level/utr_rating/home_town the signup form
// collects, since all of it needs to reach upsert_signup_profile() in the
// same RPC call (see signUp() below and
// 20260807000001_019_signup_skill_utr_location.sql).
interface SignUpProfileInfo {
  date_of_birth: string;
  age_band: 'minor' | 'adult';
  skill_level: string;
  utr_rating: number | null;
  home_town: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  profileError: string | null;
  isAuthenticated: boolean;
  // Returns { confirmationRequired: true } when Supabase's "Confirm email"
  // setting is on and signUp() did not come back with an active session -
  // the caller (SignupPage) uses this to show a "check your email"
  // screen instead of treating signup as immediately complete. See the
  // long comment inside signUp() below for why the profile-creation RPC
  // is deliberately deferred in that case rather than called here.
  signUp: (email: string, password: string, name: string, info: SignUpProfileInfo) => Promise<{ confirmationRequired: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<Profile>;
  // silent: true skips setting the global profileError (the app-wide
  // orange banner) on failure - for opportunistic refreshes after an
  // action whose success is already confirmed by its own RPC result, not
  // for the primary profile-load path. See fetchProfile's comment.
  refreshProfile: (opts?: { silent?: boolean }) => Promise<void>;
  // Local cache merge only, never touches the database. Only ever use this
  // with fields already confirmed server-side by a SECURITY DEFINER RPC's
  // own success result.
  setProfileFields: (updates: Partial<Profile>) => void;
  // supabase.auth.resend() for a signup confirmation email - used by the
  // signup "check your email" screen, the sign-in "email not confirmed"
  // prompt, and the needs_email_verification onboarding step.
  resendVerificationEmail: (email: string) => Promise<void>;
  // Permanently deletes the signed-in user's own account via the
  // delete-account Edge Function (the only place the service_role key is
  // ever used - never in this frontend). Does NOT sign out on its own;
  // SettingsPage calls signOut() itself right after this resolves, so the
  // two steps stay visibly sequential (delete, then sign out, then
  // navigate away) rather than hidden inside one context method.
  deleteAccount: () => Promise<void>;
  // True while the current session came from a password-reset email link
  // (set from the URL at startup, or by the PASSWORD_RECOVERY event) and
  // the user hasn't set a new password yet. App.tsx routes to
  // /auth/reset-password whenever this is true.
  passwordRecovery: boolean;
  clearPasswordRecovery: () => void;
  // supabase.auth.updateUser({ password }). Throws the raw auth error for
  // the caller to classify (see classifyAuthError) - never logs the
  // password. `nonce` is the emailed reauthentication code, only needed
  // when the project's "Secure password change" setting requires it.
  updatePassword: (newPassword: string, nonce?: string) => Promise<void>;
  // Emails a one-time reauthentication code to the signed-in user.
  requestReauthentication: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MIGRATION_MISSING_MESSAGE =
  'A required database update has not been applied yet, so some profile fields are unavailable. Please contact support.';
const PROFILE_LOAD_ERROR_MESSAGE = "We're having trouble loading your profile. We'll keep trying automatically.";
// Backoff for automatic background recovery when the profile couldn't be
// loaded at all. Also retried immediately on reconnect / app foreground.
const PROFILE_RETRY_DELAYS_MS = [3000, 10000, 30000, 60000];
export const EMAIL_NOT_CONFIRMED_MESSAGE =
  'Please verify your email to sign in. Check your inbox (and spam folder) for the verification link, or resend it below.';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(initialAuthRedirect.isPasswordRecovery);

  // Lets in-flight async work know the provider is still mounted before
  // touching state, so a slow/hung request can never call setState after
  // unmount (e.g. after a fast navigation away during initial load).
  const mountedRef = useRef(true);
  // Mirrors `profile` for async code that needs the latest value without a
  // stale closure - used to tell "a background re-fetch failed but the app
  // already has a usable profile" (not worth telling the user about) apart
  // from "we have no profile at all" (worth a notice + auto-recovery).
  const profileRef = useRef<Profile | null>(null);
  const recoveryInFlightRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    // QA fix: this used to also call supabase.auth.getSession() directly
    // here before setting up onAuthStateChange. Reproduced during preview
    // QA: every fresh, signed-in page load consistently stalled for the
    // full 8s timeout on that getSession() call, and - critically -
    // unrelated public queries (e.g. SchedulingPage's `courts` fetch)
    // didn't even dispatch their HTTP request until *after* that timeout
    // fired, meaning the shared Supabase client was serializing all
    // requests in this tab behind the session check. onAuthStateChange
    // always fires an INITIAL_SESSION event exactly once on subscribe,
    // with the same session data getSession() would have returned - so
    // calling both was redundant and appears to have been the source of
    // the internal contention. Relying solely on the listener removes the
    // double session-resolution without losing anything: every branch
    // below (SIGNED_IN/INITIAL_SESSION/TOKEN_REFRESHED/SIGNED_OUT) is
    // still handled, `loading` still always resolves, and the timer below
    // is kept purely as a last-resort safety net in case the client never
    // fires any event at all (should not happen in practice).
    let resolvedInitial = false;

    // See lib/authRecovery.ts - recovers automatically from the
    // wedged-Supabase-client-lock failure mode (the actual cause of
    // "works after a hard refresh, hangs on every navigation until then")
    // instead of requiring the user to refresh by hand.
    const uninstallAuthRecovery = installAuthRecovery();

    const safetyTimer = setTimeout(() => {
      if (!resolvedInitial && mountedRef.current) {
        console.error('[AuthContext] No auth state received within timeout - proceeding as signed out');
        resolvedInitial = true;
        setLoading(false);
      }
    }, AUTH_TIMEOUT_MS);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, changedSession) => {
      if (!mountedRef.current) return;
      devLog('[AuthContext] auth state change:', event);

      try {
        setSession(changedSession);
        setUser(changedSession?.user ?? null);
        setError(null);

        if (changedSession?.user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
          await fetchOrCreateProfile(changedSession.user);
        } else if (changedSession?.user && event === 'TOKEN_REFRESHED') {
          // Supabase silently rotates the access token in the background
          // on a timer (roughly every ~50 minutes of active use), with no
          // action from the user - they could be mid-navigation, or doing
          // nothing at all. Treating this the same as a fresh sign-in
          // (the old behavior) meant an ordinary transient blip on this
          // one background refetch showed the scary "could not load your
          // profile" banner for what the user experienced as "I was just
          // clicking around and it randomly appeared." A profile that's
          // already loaded doesn't need a loud refetch just because the
          // token rotated - silent picks up any real change (e.g. an
          // admin action from another session) without ever surfacing an
          // error for a background operation the user can't even see.
          await fetchProfile(changedSession.user.id, 0, true);
        } else if (event === 'PASSWORD_RECOVERY') {
          // The session itself was already delivered via INITIAL_SESSION /
          // SIGNED_IN above; this only marks it as a reset-link session.
          setPasswordRecovery(true);
        } else if (event === 'SIGNED_OUT') {
          setProfile(null);
          setProfileError(null);
          setPasswordRecovery(false);
        }
      } catch (err) {
        // fetchOrCreateProfile already catches everything itself and never
        // throws - this is defense in depth for anything unexpected in
        // this callback. A stale/invalid session specifically should never
        // leave the app stuck: clear it locally (this re-enters this same
        // listener with a SIGNED_OUT event, which the branch above
        // handles) rather than surfacing the scary profile-load banner.
        if (isInvalidSessionError(err)) {
          console.error('[AuthContext] Invalid session during auth state change - signing out locally:', err);
          void supabase.auth.signOut({ scope: 'local' });
        } else {
          console.error('[AuthContext] Unexpected error handling auth state change:', err);
        }
      }

      if (!resolvedInitial && mountedRef.current) {
        resolvedInitial = true;
        clearTimeout(safetyTimer);
        setLoading(false);
        devLog('[AuthContext] initial load finished');
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
      uninstallAuthRecovery();
    };
  }, []);

  // silent=true is for opportunistic background refreshes that follow a
  // successful, already-confirmed action (e.g. parent consent submit) -
  // the profile row is known-good server-side at that point, so a failure
  // to re-fetch it here is just a missed cache sync, not a real "your
  // profile is broken" event. Never surface PROFILE_LOAD_ERROR_MESSAGE (the
  // app-wide orange banner - see App.tsx's ProfileErrorBanner) for that
  // case; only log it. Non-silent callers (initial auth load, the banner's
  // own Retry button) keep the original behavior unchanged.
  //
  // attempt counts retries (0 = first try). Up to 2 retries (3 attempts
  // total) before giving up and showing the banner - bumped from a single
  // retry after reports of the banner appearing for what turned out to be
  // ordinary network/cold-start latency, not a real failure. This only
  // costs extra time in the failure case (each individual attempt still
  // has to actually time out first); a normal successful fetch is
  // unaffected.
  // Final-failure handler shared by fetchProfile/fetchOrCreateProfile once
  // their own retries are exhausted. Only surfaces the app-wide notice when
  // the app genuinely has no profile to work with - if one is already
  // loaded, the app keeps running off it and a failed re-fetch is just a
  // missed cache sync, so it's logged, never shown. A missing-column error
  // is the one non-transient case and is always surfaced.
  const reportProfileLoadFailure = (err: unknown) => {
    if (!mountedRef.current) return;
    if (isMissingColumnError(err)) {
      setProfileError(MIGRATION_MISSING_MESSAGE);
      return;
    }
    if (profileRef.current) {
      console.error('[AuthContext] Profile re-fetch failed; keeping the already-loaded profile:', err);
      return;
    }
    setProfileError(PROFILE_LOAD_ERROR_MESSAGE);
  };

  const fetchProfile = async (userId: string, attempt = 0, silent = false) => {
    try {
      const { data, error: fetchError } = await withTimeout(
        supabase.from('profiles').select('*').eq('id', userId).single(),
        AUTH_TIMEOUT_MS,
        'Profile fetch timed out'
      );

      if (fetchError) throw fetchError;
      if (mountedRef.current && data) {
        setProfile(data);
        // Any successful load clears a previous failure, including a
        // silent background one - otherwise an error from an earlier
        // attempt would linger even though the profile is now fine.
        setProfileError(null);
      }
    } catch (err) {
      // A stale/invalid session (see lib/authErrors.ts) is not a profile
      // problem and retrying won't fix it - the session itself needs to go.
      // Sign out locally rather than retrying or showing the scary
      // "could not load your profile" banner; the resulting SIGNED_OUT
      // event clears profile/profileError through the normal listener path.
      if (isInvalidSessionError(err)) {
        console.error('[AuthContext] Invalid session while fetching profile - signing out locally:', err);
        void supabase.auth.signOut({ scope: 'local' });
        return;
      }
      // Most real-world failures here are transient (a slow/cold
      // connection, a dropped request) rather than a genuine problem the
      // user needs to act on. A couple of silent retries absorb that
      // without ever showing the "could not load your profile" message for
      // what was really just a blip - only a failure on every attempt
      // surfaces it.
      if (attempt < 2) {
        devLog(`[AuthContext] Profile fetch failed (attempt ${attempt + 1}/3), retrying:`, err);
        return fetchProfile(userId, attempt + 1, silent);
      }
      if (silent) {
        console.error('[AuthContext] Silent profile refresh failed (not shown to user):', err);
        return;
      }
      console.error('[AuthContext] Error fetching profile:', err);
      reportProfileLoadFailure(err);
    }
  };

  // attempt counts retries (0 = first try) - see fetchProfile's comment
  // above for why this allows 2 retries (3 attempts total) rather than 1.
  const fetchOrCreateProfile = async (sessionUser: User, attempt = 0) => {
    try {
      // Try to fetch existing profile
      const { data: existingProfile, error: fetchError } = await withTimeout(
        supabase.from('profiles').select('*').eq('id', sessionUser.id).single(),
        AUTH_TIMEOUT_MS,
        'Profile fetch timed out'
      );

      if (existingProfile) {
        if (mountedRef.current) {
          setProfile(existingProfile);
          setProfileError(null);
        }
        return;
      }

      // Profile doesn't exist yet. Three ways this happens:
      //  1. First Google sign-in - no signup-form metadata at all.
      //  2. A signUp() whose "Confirm email" gate meant no session existed
      //     yet to call upsert_signup_profile with - date_of_birth/
      //     skill_level/utr_rating/home_town were stashed in user_metadata
      //     (see signUp() below) specifically so this branch can finish
      //     the job once, right here, the moment a real session exists
      //     (the SIGNED_IN event this function fires from is that exact
      //     moment - either right after signUp() when confirmation is
      //     off, or after the user clicks the confirmation link when it's
      //     on).
      //  3. This fires before signUp()'s own upsert_signup_profile RPC
      //     call has landed (confirmation-off race).
      if (fetchError?.code === 'PGRST116') {
        const name = sessionUser.user_metadata?.name || sessionUser.user_metadata?.full_name || sessionUser.email?.split('@')[0] || 'Player';
        const avatarUrl = sessionUser.user_metadata?.avatar_url || sessionUser.user_metadata?.picture || null;
        const pendingDateOfBirth = sessionUser.user_metadata?.date_of_birth as string | undefined;

        if (pendingDateOfBirth) {
          const { data: rpcResult, error: rpcError } = await withTimeout(
            supabase.rpc('upsert_signup_profile', {
              p_name: name,
              p_avatar_url: avatarUrl,
              p_date_of_birth: pendingDateOfBirth,
              p_skill_level: sessionUser.user_metadata?.skill_level ?? null,
              p_utr_rating: sessionUser.user_metadata?.utr_rating ?? null,
              p_home_town: sessionUser.user_metadata?.home_town ?? undefined,
            }),
            AUTH_TIMEOUT_MS,
            'Saving your profile timed out. Please try again.'
          );
          if (rpcError) throw rpcError;
          const resultProfile = (rpcResult as { ok?: boolean; profile?: Profile } | null)?.profile ?? null;
          if (mountedRef.current && resultProfile) {
            setProfile(resultProfile);
            setProfileError(resultProfile.tos_version && resultProfile.age_band ? null : PROFILE_LOAD_ERROR_MESSAGE);
          } else if (mountedRef.current) {
            setProfileError(PROFILE_LOAD_ERROR_MESSAGE);
          }
          return;
        }

        // QA fix: this used to be a plain .insert(), which could race
        // against signUp()'s own profile-creation call (both are
        // triggered by the same supabase.auth.signUp() and can run
        // concurrently). If signUp() won that race, this insert would
        // hit a 23505 duplicate-key error and this whole function would
        // fall into the catch block below, showing a spurious "could not
        // load your profile" error even though a perfectly good profile
        // (with the full legal/age fields) had just been created.
        // ignoreDuplicates makes a genuine race a safe, silent no-op -
        // whichever side actually created the row, we then always
        // re-select and use whatever is really in the database, so this
        // path can never overwrite a fuller row with this minimal one.
        //
        // skill_level is deliberately left null (not defaulted to
        // 'beginner') - this path only runs for an account that never
        // went through the signup form's skill-level field (first Google
        // sign-in, or a race landing here before upsert_signup_profile's
        // own call resolves), so there is no real chosen value to write.
        // A null skill_level surfaces as "Skill level not set" in the UI
        // and is picked up by the SkillLevelStep profile-completion
        // prompt on Players/Matches (useSocialEligibility.ts) rather
        // than silently asserting a level the user never chose.
        const { error: createError } = await withTimeout(
          supabase.from('profiles').upsert(
            { id: sessionUser.id, name, avatar_url: avatarUrl, role: 'player', skill_level: null, availability: [], favorite_courts: [] },
            { onConflict: 'id', ignoreDuplicates: true }
          ),
          AUTH_TIMEOUT_MS,
          'Profile creation timed out'
        );
        if (createError) throw createError;

        const { data: finalProfile, error: refetchError } = await withTimeout(
          supabase.from('profiles').select('*').eq('id', sessionUser.id).single(),
          AUTH_TIMEOUT_MS,
          'Profile fetch timed out'
        );
        if (refetchError) throw refetchError;
        if (mountedRef.current && finalProfile) {
          setProfile(finalProfile);
          setProfileError(null);
        }
      } else if (fetchError) {
        throw fetchError;
      }
    } catch (err) {
      // Same as fetchProfile above: a stale/invalid session isn't a
      // profile problem, retrying won't fix it, and it should never show
      // the scary banner - sign out locally and let the resulting
      // SIGNED_OUT event clear state through the normal listener path.
      if (isInvalidSessionError(err)) {
        console.error('[AuthContext] Invalid session in fetchOrCreateProfile - signing out locally:', err);
        void supabase.auth.signOut({ scope: 'local' });
        return;
      }
      // Same transient-blip tolerance as fetchProfile above - don't scare
      // the user over a single slow/dropped request.
      if (attempt < 2) {
        devLog(`[AuthContext] fetchOrCreateProfile failed (attempt ${attempt + 1}/3), retrying:`, err);
        return fetchOrCreateProfile(sessionUser, attempt + 1);
      }
      console.error('[AuthContext] Error in fetchOrCreateProfile:', err);
      reportProfileLoadFailure(err);
    }
  };

  // Automatic recovery for the one case the notice is shown for: signed in,
  // but no profile could be loaded at all. Retries on a backoff, and
  // immediately when the device reconnects or the app returns to the
  // foreground (the most common moment a cold/suspended iOS WebView's
  // first request fails). Success clears profileError and this effect
  // tears itself down - the user never has to refresh by hand.
  useEffect(() => {
    if (!user || profile || !profileError || profileError === MIGRATION_MISSING_MESSAGE) return;

    let cancelled = false;
    let attempt = 0;
    let timer: number | undefined;

    const retry = async () => {
      if (cancelled || recoveryInFlightRef.current) return;
      recoveryInFlightRef.current = true;
      try {
        await fetchOrCreateProfile(user);
      } finally {
        recoveryInFlightRef.current = false;
      }
      if (!cancelled && !profileRef.current) schedule();
    };

    const schedule = () => {
      const delay = PROFILE_RETRY_DELAYS_MS[Math.min(attempt, PROFILE_RETRY_DELAYS_MS.length - 1)];
      attempt += 1;
      timer = window.setTimeout(() => void retry(), delay);
    };

    const retryNow = () => {
      if (document.visibilityState !== 'visible') return;
      window.clearTimeout(timer);
      void retry();
    };

    window.addEventListener('online', retryNow);
    document.addEventListener('visibilitychange', retryNow);
    schedule();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener('online', retryNow);
      document.removeEventListener('visibilitychange', retryNow);
    };
  }, [user, profile, profileError]); // eslint-disable-line react-hooks/exhaustive-deps

  const signUp = async (email: string, password: string, name: string, info: SignUpProfileInfo) => {
    setError(null);
    // No context-wide setLoading() here - see signIn() below for why.

    const { data, error: signUpError } = await withTimeout(
      supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          // Carried in user_metadata (available even before email
          // confirmation) specifically so fetchOrCreateProfile's
          // PGRST116 branch can finish the upsert_signup_profile call
          // later, from the first real SIGNED_IN event, if this signUp()
          // call itself doesn't get an active session back (see the
          // data.session check below).
          data: {
            name,
            date_of_birth: info.date_of_birth,
            skill_level: info.skill_level,
            utr_rating: info.utr_rating,
            home_town: info.home_town,
          },
          emailRedirectTo: `${authRedirectOrigin()}/dashboard`,
        },
      }),
      AUTH_TIMEOUT_MS,
      'Sign up timed out. Please try again.'
    );

    if (signUpError) {
      console.error('[AuthContext] Sign up error:', signUpError.code ?? signUpError.status);
      setError(signUpError.message);
      throw signUpError;
    }

    // With "Confirm email" on, Supabase deliberately doesn't error for an
    // email that already has an account (to resist account enumeration):
    // it returns an obfuscated user with no identities and sends nothing.
    // Left alone, the user would be told to check an inbox for an email
    // that never arrives. Surface it the same way as the explicit
    // user_already_exists error so the signup form can point them to
    // Sign in / Reset password instead.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw Object.assign(new Error('An account already exists with this email.'), { code: 'user_already_exists' });
    }

    // Supabase's "Confirm email" setting controls whether signUp()
    // returns an active session immediately. When it's on, data.session
    // is null until the user clicks the confirmation link - there is no
    // authenticated request context yet, and upsert_signup_profile
    // (SECURITY DEFINER, requires auth.uid()) would just fail with "Not
    // authenticated" if called here. So: skip it entirely in that case
    // and let fetchOrCreateProfile finish the job later (see above) once
    // a real session exists. When confirmation is off (or already
    // satisfied), data.session is present immediately and today's exact
    // behavior below is unchanged.
    if (!data.session) {
      return { confirmationRequired: true };
    }

    // QA fix: this used to be a plain .insert() with the full legal/age
    // fields, silently ignoring a 23505 conflict. That conflict happens
    // reliably (not just occasionally) because supabase.auth.signUp()
    // also fires onAuthStateChange('SIGNED_IN'/'INITIAL_SESSION'),
    // whose handler (fetchOrCreateProfile above) races to create its
    // own *minimal* profile - and whichever insert lost the race had
    // its data silently discarded, so date_of_birth/age_band/
    // tos_version/tos_accepted_at/privacy_version/privacy_accepted_at
    // ended up NULL on essentially every signup. upsert_signup_profile
    // is a SECURITY DEFINER RPC that does a single INSERT ... ON
    // CONFLICT (id) DO UPDATE for exactly these fields, so no matter
    // which side's row-creation attempt reaches Postgres first, this
    // call is guaranteed to end with the full legal/age data in place.
    // (A plain client-side upsert can't do this: protect_sensitive_
    // profile_columns pins age_band/date_of_birth back to their prior
    // value on a normal authenticated self-UPDATE, which is exactly
    // what upsert-on-conflict would be here without the RPC's bypass.)
    //
    // skill_level/utr_rating/home_town ride along in the same RPC call
    // for the same reason, not a separate .update() afterward - see
    // 20260807000001_019_signup_skill_utr_location.sql's header
    // comment for why those three are also in the ON CONFLICT DO
    // UPDATE branch now (the same race could otherwise silently
    // discard the user's actual signup-form choices, not just default
    // them to 'beginner' - the original bug this whole RPC exists to
    // prevent).
    if (data.user) {
      const avatarUrl = data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture || null;

      const { data: rpcResult, error: rpcError } = await withTimeout(
        supabase.rpc('upsert_signup_profile', {
          p_name: name,
          p_avatar_url: avatarUrl,
          p_date_of_birth: info.date_of_birth,
          p_skill_level: info.skill_level,
          p_utr_rating: info.utr_rating,
          p_home_town: info.home_town,
        }),
        AUTH_TIMEOUT_MS,
        'Saving your profile timed out. Please try again.'
      );

      if (rpcError) {
        console.error('[AuthContext] Error upserting signup profile:', rpcError);
        setError(rpcError.message);
        throw rpcError;
      }

      const resultProfile = (rpcResult as { ok?: boolean; profile?: Profile } | null)?.profile ?? null;

      if (resultProfile) {
        // Verify the fields this whole fix exists to guarantee actually
        // landed, rather than silently trusting the RPC's own success
        // flag - if something unexpected happened, surface it visibly
        // instead of leaving the user looking "signed up" with a
        // profile that will fail every legal/matching check later.
        if (!resultProfile.tos_version || !resultProfile.age_band) {
          console.error('[AuthContext] upsert_signup_profile returned an incomplete profile:', resultProfile);
          setProfileError(PROFILE_LOAD_ERROR_MESSAGE);
        }
        if (mountedRef.current) {
          setProfile(resultProfile);
          setProfileError((prev) => (resultProfile.tos_version && resultProfile.age_band ? null : prev));
        }
      } else {
        console.error('[AuthContext] upsert_signup_profile returned no profile:', rpcResult);
        if (mountedRef.current) setProfileError(PROFILE_LOAD_ERROR_MESSAGE);
      }
    }

    return { confirmationRequired: false };
  };

  // Deliberately does NOT toggle the context-wide `loading` flag (that flag
  // means "initial session not resolved yet"). PublicOnlyRoute swaps the
  // login page for a spinner while `loading` is true, so toggling it here
  // unmounted LoginPage mid-request and remounted a blank one - silently
  // discarding the inline error for a wrong password. LoginPage tracks
  // its own submitting state. signInWithPassword() resolves only after
  // the SIGNED_IN listener (and its profile load) has run, so `user` is
  // already set by the time the caller navigates.
  const signIn = async (email: string, password: string) => {
    setError(null);
    const { error: signInError } = await withTimeout(
      supabase.auth.signInWithPassword({ email: email.trim(), password }),
      AUTH_TIMEOUT_MS,
      'Sign in timed out. Please try again.'
    );

    if (signInError) {
      // Code/status only - never the submitted credentials.
      console.error('[AuthContext] Sign in failed:', signInError.code ?? signInError.status);
      setError(signInError.code === 'email_not_confirmed' ? EMAIL_NOT_CONFIRMED_MESSAGE : null);
      // Rethrown as-is (not re-wrapped) so callers can classify it via
      // classifyAuthError() and show their own field-placed copy.
      throw signInError;
    }
  };

  const resendVerificationEmail = async (email: string) => {
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: `${authRedirectOrigin()}/dashboard` },
    });
    if (resendError) {
      console.error('[AuthContext] Resend verification email failed:', resendError.code ?? resendError.status);
      throw resendError;
    }
  };

  const deleteAccount = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      throw new Error('You must be signed in to delete your account.');
    }

    const { data, error: invokeError } = await supabase.functions.invoke('delete-account', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (invokeError || data?.ok !== true) {
      console.error('[AuthContext] delete-account failed:', { invokeError, data });
      throw new Error(data?.error || invokeError?.message || 'Could not delete your account. Please try again.');
    }
  };

  const signOut = async () => {
    setError(null);
    try {
      const { error: signOutError } = await withTimeout(
        supabase.auth.signOut(),
        AUTH_TIMEOUT_MS,
        'Sign out timed out'
      );

      if (signOutError) {
        console.error('[AuthContext] Sign out error:', signOutError);
        setError(signOutError.message);
        throw signOutError;
      }
    } catch (err) {
      console.error('[AuthContext] Sign out failed:', err);
      throw err;
    } finally {
      // Always clear local auth state so the UI reflects being logged out
      // immediately, even if the server-side signOut call errored or hung
      // (e.g. an already-expired session or a network timeout) - the
      // user's intent is to be logged out locally regardless.
      if (mountedRef.current) {
        setUser(null);
        setProfile(null);
        setProfileError(null);
        setSession(null);
      }
    }
  };

  const signInWithGoogle = async () => {
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/auth/callback',
      },
    });
    if (oauthError) {
      console.error('[AuthContext] Google sign-in error:', oauthError);
      setError(oauthError.message);
      throw oauthError;
    }
  };

  // Supabase returns success for unknown emails too (no account
  // enumeration), so callers must never phrase success as "we found your
  // account". On native, the link points at the deployed web app - see
  // authRedirectOrigin() - since a capacitor:// URL can't be opened from Mail.
  const resetPassword = async (email: string) => {
    const { error: resetError } = await withTimeout(
      supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: authRedirectOrigin() + '/auth/reset-password',
      }),
      AUTH_TIMEOUT_MS,
      'Sending the reset email timed out.'
    );
    if (resetError) {
      console.error('[AuthContext] Password reset request failed:', resetError.code ?? resetError.status);
      throw resetError;
    }
  };

  const updatePassword = async (newPassword: string, nonce?: string) => {
    const { error: updateError } = await withTimeout(
      supabase.auth.updateUser(nonce ? { password: newPassword, nonce } : { password: newPassword }),
      AUTH_TIMEOUT_MS,
      'Updating your password timed out.'
    );
    if (updateError) {
      console.error('[AuthContext] Password update failed:', updateError.code ?? updateError.status);
      throw updateError;
    }
    if (mountedRef.current) setPasswordRecovery(false);
  };

  const requestReauthentication = async () => {
    const { error: reauthError } = await withTimeout(
      supabase.auth.reauthenticate(),
      AUTH_TIMEOUT_MS,
      'Sending the verification code timed out.'
    );
    if (reauthError) {
      console.error('[AuthContext] Reauthentication request failed:', reauthError.code ?? reauthError.status);
      throw reauthError;
    }
  };

  const clearPasswordRecovery = () => setPasswordRecovery(false);

  const updateProfile = async (updates: Partial<Profile>): Promise<Profile> => {
    if (!user) throw new Error('Not authenticated');

    const { data, error: updateError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('[AuthContext] Update profile error:', updateError);
      throw updateError;
    }
    if (mountedRef.current) setProfile(data);
    return data;
  };

  const refreshProfile = async (opts?: { silent?: boolean }) => {
    if (user) {
      await fetchProfile(user.id, 0, opts?.silent ?? false);
    }
  };

  // Local-only merge into the cached profile, no network request. Safe to
  // use only for fields the caller has already confirmed server-side via a
  // SECURITY DEFINER RPC's own success result (e.g.
  // request_parent_consent/mark_parent_consent_email_sent) - this never
  // writes to the database itself. Lets a component reflect a known-true
  // server state immediately, without making UI correctness depend on a
  // follow-up fetchProfile() round trip that could time out.
  const setProfileFields = (updates: Partial<Profile>) => {
    if (!mountedRef.current) return;
    setProfile((prev) => (prev ? { ...prev, ...updates } : prev));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        error,
        profileError,
        isAuthenticated: !!user,
        signUp,
        signIn,
        signOut,
        signInWithGoogle,
        resetPassword,
        updateProfile,
        refreshProfile,
        setProfileFields,
        resendVerificationEmail,
        deleteAccount,
        passwordRecovery,
        clearPasswordRecovery,
        updatePassword,
        requestReauthentication,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
