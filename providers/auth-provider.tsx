"use client";

import type { User } from "@supabase/supabase-js";
import posthog from "posthog-js";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAuthenticatedLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticatedLoading, setIsAuthenticatedLoading] = useState(true);

  useEffect(() => {
    if (user && !user.is_anonymous) {
      posthog.identify(user.id, { email: user.email });
    }
  }, [user]);

  useEffect(() => {
    const supabase = createClient();

    // Supabase emits INITIAL_SESSION after loading storage, then later auth changes.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsAuthenticatedLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user && !user.is_anonymous,
        isAuthenticatedLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
