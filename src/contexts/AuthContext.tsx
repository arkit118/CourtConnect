import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, Profile } from '../lib/supabase';
import { CURRENT_TOS_VERSION, CURRENT_PRIVACY_VERSION } from '../lib/legal';
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
    let cancelled = false;

    async function init() {
      devLog('[AuthContext] initializing session...');
      try {
        const { data: { session: initialSession } } = await withTimeout(
          supabase.auth.getSession(),
          AUTH_TIMEOUT_MS,
          'Auth session check timed out'
        );

        if (cancelled || !mountedRef.current) return;

        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (initialSession?.user) {
          await fetchOrCreateProfile(initialSession.user);
        }
      } catch (err) {
        console.error('[AuthContext] Error initializing auth session:', err);
        if (mountedRef.current) {
          // A failed/timed-out session check should never block the rest
          // of the app - public pages must still render. We simply end up
          // signed-out looking, which is safe.
          setSession(null);
          setUser(null);
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          devLog('[AuthContext] initial load finished');
        }
      }
    }

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, changedSession) => {
      if (!mountedRef.current) return;
      devLog('[AuthContext] auth state change:', event);

      setSession(changedSession);
      setUser(changedSession?.user ?? null);
      setError(null);

      if (event === 'SIGNED_IN' && changedSession?.user) {
        await fetchOrCreateProfile(changedSession.user);
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        setProfileError(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
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
      console.error('[AuthContext] Error fetching profile:', err);
      if (mountedRef.current) {
        setProfileError(isMissingColumnError(err) ? MIGRATION_MISSING_MESSAGE : PROFILE_LOAD_ERROR_MESSAGE);
      }
    }
  };

  const fetchOrCreateProfile = async (sessionUser: User) => {
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

      // Profile doesn't exist yet (e.g. first Google sign-in) - create one
      if (fetchError?.code === 'PGRST116') {
        const name = sessionUser.user_metadata?.name || sessionUser.user_metadata?.full_name || sessionUser.email?.split('@')[0] || 'Player';
        const avatarUrl = sessionUser.user_metadata?.avatar_url || sessionUser.user_metadata?.picture || null;

        const { data: newProfile, error: createError } = await withTimeout(
          supabase
            .from('profiles')
            .insert({
              id: sessionUser.id,
              name,
              avatar_url: avatarUrl,
              role: 'player',
              skill_level: 'beginner',
              availability: [],
              favorite_courts: [],
            })
            .select()
            .single(),
          AUTH_TIMEOUT_MS,
          'Profile creation timed out'
        );

        if (createError) throw createError;
        if (mountedRef.current && newProfile) {
          setProfile(newProfile);
          setProfileError(null);
        }
      } else if (fetchError) {
        throw fetchError;
      }
    } catch (err) {
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

      // Create profile after signup (email confirmation disabled)
      if (data.user) {
        const avatarUrl = data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture || null;
        const now = new Date().toISOString();
        const { error: profileInsertError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            name,
            avatar_url: avatarUrl,
            role: 'player',
            skill_level: 'beginner',
            availability: [],
            favorite_courts: [],
            date_of_birth: legal.date_of_birth,
            age_band: legal.age_band,
            tos_accepted_at: now,
            tos_version: CURRENT_TOS_VERSION,
            privacy_accepted_at: now,
            privacy_version: CURRENT_PRIVACY_VERSION,
            safety_acknowledged_at: now,
          })
          .select()
          .single();

        if (profileInsertError && profileInsertError.code !== '23505') { // Ignore duplicate key error
          console.error('[AuthContext] Profile creation error:', profileInsertError);
          if (isMissingColumnError(profileInsertError)) {
            setProfileError(MIGRATION_MISSING_MESSAGE);
          }
        }

        // Fetch the profile to update state
        const { data: newProfile, error: refetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (refetchError) {
          console.error('[AuthContext] Error refetching profile after signup:', refetchError);
        } else if (newProfile && mountedRef.current) {
          setProfile(newProfile);
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
