import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, Profile } from '../lib/supabase';
import { CURRENT_TOS_VERSION, CURRENT_PRIVACY_VERSION } from '../lib/legal';

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchOrCreateProfile(session.user);
        }
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);
        setError(null);

        if (event === 'SIGNED_IN' && session?.user) {
          // Check if user has a profile, create one if not
          await fetchOrCreateProfile(session.user);
        } else if (event === 'SIGNED_OUT') {
          setProfile(null);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error && data) {
        setProfile(data);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  const fetchOrCreateProfile = async (sessionUser: User) => {
    try {
      // Try to fetch existing profile
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sessionUser.id)
        .single();

      if (existingProfile) {
        setProfile(existingProfile);
        return;
      }

      // Profile doesn't exist, create one
      if (fetchError?.code === 'PGRST116') {
        const name = sessionUser.user_metadata?.name || sessionUser.user_metadata?.full_name || sessionUser.email?.split('@')[0] || 'Player';
        const avatarUrl = sessionUser.user_metadata?.avatar_url || sessionUser.user_metadata?.picture || null;

        const { data: newProfile, error: createError } = await supabase
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
          .single();

        if (!createError && newProfile) {
          setProfile(newProfile);
        }
      }
    } catch (err) {
      console.error('Error in fetchOrCreateProfile:', err);
    }
  };

  const signUp = async (email: string, password: string, name: string, legal: SignUpLegalInfo) => {
    setError(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      throw error;
    }

    // Create profile after signup (email confirmation disabled)
    if (data.user) {
      const avatarUrl = data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture || null;
      const now = new Date().toISOString();
      const { error: profileError } = await supabase
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

      if (profileError && profileError.code !== '23505') { // Ignore duplicate key error
        console.error('Profile creation error:', profileError);
      }

      // Fetch the profile to update state
      const { data: newProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (newProfile) {
        setProfile(newProfile);
      }
    }

    setLoading(false);
  };

  const signIn = async (email: string, password: string) => {
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      throw error;
    }

    setLoading(false);
  };

  const signOut = async () => {
    setError(null);
    const { error } = await supabase.auth.signOut();

    // Always clear local auth state so the UI reflects being logged out
    // immediately, even if the server-side signOut call itself errored
    // (e.g. an already-expired session) - the user's intent is to be
    // logged out locally regardless.
    setUser(null);
    setProfile(null);
    setSession(null);

    if (error) {
      console.error('Sign out error:', error);
      setError(error.message);
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/auth/callback',
      },
    });
    if (error) {
      setError(error.message);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/auth/reset-password',
    });
    if (error) {
      setError(error.message);
      throw error;
    }
  };

  const updateProfile = async (updates: Partial<Profile>): Promise<Profile> => {
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;
    setProfile(data);
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
