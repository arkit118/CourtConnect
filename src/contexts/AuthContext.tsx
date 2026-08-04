import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, Profile } from '../lib/supabase';
import { withTimeout, isMissingColumnError, devLog } from '../lib/withTimeout';

const AUTH_TIMEOUT_MS = 8000;

interface SignUpLegalInfo {
  date_of_birth: string;
  age_band: 'minor' | 'adult';
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  profileError: string | null;
  isAuthenticated: boolean;
  signUp: (email: string, password: string, name: string, legal: SignUpLegalInfo) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<Profile>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MIGRATION_MISSING_MESSAGE =
  'A required database update has not been applied yet, so some profile fields are unavailable. Please contact support.';
const PROFILE_LOAD_ERROR_MESSAGE = 'Could not load your profile. Please refresh or sign in again.';

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
    };
  }, []);

  const fetchProfile = async (userId: string, isRetry = false) => {
    try {
      const { data, error: fetchError } = await withTimeout(
        supabase.from('profiles').select('*').eq('id', userId).single(),
        AUTH_TIMEOUT_MS,
        'Profile fetch timed out'
      );

      if (fetchError) throw fetchError;
      if (mountedRef.current && data) {
        setProfile(data);
        setProfileError(null);
      }
    } catch (err) {
      // Most real-world failures here are transient (a slow/cold
      // connection, a dropped request) rather than a genuine problem the
      // user needs to act on. One silent retry absorbs that without ever
      // showing the "could not load your profile" message for what was
      // really just a blip - only a second consecutive failure surfaces it.
      if (!isRetry) {
        devLog('[AuthContext] Profile fetch failed, retrying once:', err);
        return fetchProfile(userId, true);
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

      // Profile doesn't exist yet (e.g. first Google sign-in, or this
      // fires before signUp()'s own upsert_signup_profile RPC call has
      // landed) - create a minimal one.
      if (fetchError?.code === 'PGRST116') {
        const name = sessionUser.user_metadata?.name || sessionUser.user_metadata?.full_name || sessionUser.email?.split('@')[0] || 'Player';
        const avatarUrl = sessionUser.user_metadata?.avatar_url || sessionUser.user_metadata?.picture || null;

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
        const { error: createError } = await withTimeout(
          supabase.from('profiles').upsert(
            { id: sessionUser.id, name, avatar_url: avatarUrl, role: 'player', skill_level: 'beginner', availability: [], favorite_courts: [] },
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

  const signUp = async (email: string, password: string, name: string, legal: SignUpLegalInfo) => {
    setError(null);
    setLoading(true);

    try {
      const { data, error: signUpError } = await withTimeout(
        supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
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
      if (data.user) {
        const avatarUrl = data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture || null;

        const { data: rpcResult, error: rpcError } = await withTimeout(
          supabase.rpc('upsert_signup_profile', {
            p_name: name,
            p_avatar_url: avatarUrl,
            p_date_of_birth: legal.date_of_birth,
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
        setError(signInError.message);
        throw signInError;
      }
    } finally {
      if (mountedRef.current) setLoading(false);
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
      redirectTo: window.location.origin + '/auth/reset-password',
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

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
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
