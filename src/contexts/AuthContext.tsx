import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, Profile } from '../lib/supabase';
import { withTimeout, isMissingColumnError, devLog } from '../lib/withTimeout';
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MIGRATION_MISSING_MESSAGE =
  'A required database update has not been applied yet, so some profile fields are unavailable. Please contact support.';
const PROFILE_LOAD_ERROR_MESSAGE = 'Could not load your profile. Please refresh or sign in again.';
const EMAIL_NOT_CONFIRMED_MESSAGE =
  'Please verify your email before using player matching or chat. Check your inbox for a verification link, or resend it below.';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Lets in-flight async work know the provider is still mounted before
  // touching state, so a slow/hung request can never call setState after
  // unmount (e.g. after a fast navigation away during initial load).
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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

      setSession(changedSession);
      setUser(changedSession?.user ?? null);
      setError(null);

      if (changedSession?.user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED')) {
        await fetchOrCreateProfile(changedSession.user);
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        setProfileError(null);
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
  const fetchProfile = async (userId: string, isRetry = false, silent = false) => {
    try {
      const { data, error: fetchError } = await withTimeout(
        supabase.from('profiles').select('*').eq('id', userId).single(),
        AUTH_TIMEOUT_MS,
        'Profile fetch timed out'
      );

      if (fetchError) throw fetchError;
      if (mountedRef.current && data) {
        setProfile(data);
        if (!silent) setProfileError(null);
      }
    } catch (err) {
      // Most real-world failures here are transient (a slow/cold
      // connection, a dropped request) rather than a genuine problem the
      // user needs to act on. One silent retry absorbs that without ever
      // showing the "could not load your profile" message for what was
      // really just a blip - only a second consecutive failure surfaces it.
      if (!isRetry) {
        devLog('[AuthContext] Profile fetch failed, retrying once:', err);
        return fetchProfile(userId, true, silent);
      }
      if (silent) {
        console.error('[AuthContext] Silent profile refresh failed (not shown to user):', err);
        return;
      }
      console.error('[AuthContext] Error fetching profile:', err);
      if (mountedRef.current) {
        setProfileError(isMissingColumnError(err) ? MIGRATION_MISSING_MESSAGE : PROFILE_LOAD_ERROR_MESSAGE);
      }
    }
  };

  const fetchOrCreateProfile = async (sessionUser: User, isRetry = false) => {
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
      // Same transient-blip tolerance as fetchProfile above - don't scare
      // the user over a single slow/dropped request.
      if (!isRetry) {
        devLog('[AuthContext] fetchOrCreateProfile failed, retrying once:', err);
        return fetchOrCreateProfile(sessionUser, true);
      }
      console.error('[AuthContext] Error in fetchOrCreateProfile:', err);
      if (mountedRef.current) {
        setProfileError(isMissingColumnError(err) ? MIGRATION_MISSING_MESSAGE : PROFILE_LOAD_ERROR_MESSAGE);
      }
    }
  };

  const signUp = async (email: string, password: string, name: string, info: SignUpProfileInfo) => {
    setError(null);
    setLoading(true);

    try {
      const { data, error: signUpError } = await withTimeout(
        supabase.auth.signUp({
          email,
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
        console.error('[AuthContext] Sign up error:', signUpError);
        setError(signUpError.message);
        throw signUpError;
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
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    setError(null);
    setLoading(true);

    try {
      const { error: signInError } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        AUTH_TIMEOUT_MS,
        'Sign in timed out. Please try again.'
      );

      if (signInError) {
        console.error('[AuthContext] Sign in error:', signInError);
        // Standard Supabase behavior when "Confirm email" is on: sign-in
        // is refused outright for an account that hasn't clicked its
        // verification link yet. Surface the task's specific gating copy
        // here instead of the raw API message ("Email not confirmed"),
        // since this is the primary moment an unverified user actually
        // encounters this state.
        const message = signInError.code === 'email_not_confirmed' ? EMAIL_NOT_CONFIRMED_MESSAGE : signInError.message;
        setError(message);
        throw new Error(message);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const resendVerificationEmail = async (email: string) => {
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${authRedirectOrigin()}/dashboard` },
    });
    if (resendError) {
      console.error('[AuthContext] Resend verification email error:', resendError);
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

  const resetPassword = async (email: string) => {
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: authRedirectOrigin() + '/auth/reset-password',
    });
    if (resetError) {
      console.error('[AuthContext] Reset password error:', resetError);
      setError(resetError.message);
      throw resetError;
    }
  };

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
      await fetchProfile(user.id, false, opts?.silent ?? false);
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
