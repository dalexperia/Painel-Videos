import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: any | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // 1. SAFETY TIMEOUT: Force loading to false after 5 seconds to prevent infinite loops
    const safetyTimeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn("Auth initialization timed out. Forcing app load.");
        setLoading(false);
      }
    }, 5000);

    const initAuth = async () => {
      try {
        // Get initial session
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error && error.message !== 'Auth session missing!') {
          console.error("Error getting session:", error);
        }

        if (mounted) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          
          if (initialSession?.user) {
            // Don't await profile fetch to prevent blocking the UI
            fetchProfile(initialSession.user.id).catch(console.warn);
          }
        }
      } catch (err) {
        console.error("Auth initialization unexpected error:", err);
      } finally {
        if (mounted) {
          setLoading(false);
          clearTimeout(safetyTimeout); // Clear timeout if successful
        }
      }
    };

    initAuth();

    // 2. Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (mounted) {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        
        if (newSession?.user) {
          fetchProfile(newSession.user.id).catch(console.warn);
        } else {
          setProfile(null);
        }
        
        // Ensure loading is false after any auth change
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
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
      // Silent fail for profile to not break auth flow
      console.warn("Profile fetch warning:", err);
    }
  };

  const value = {
    session,
    user,
    profile,
    loading,
    isAdmin: profile?.role === 'admin'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
