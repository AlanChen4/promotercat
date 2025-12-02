"use client";

import type { User } from "@supabase/supabase-js";
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
  isPremium: boolean;
  isPremiumLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticatedLoading, setIsAuthenticatedLoading] = useState(true);

  const [isPremium, setIsPremium] = useState(false);
  const [isPremiumLoading, setIsPremiumLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    const fetchUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setUser(user ?? null);
      } catch (error) {
        console.error("Error fetching user:", error);
        setUser(null);
      } finally {
        setIsAuthenticatedLoading(false);
        setIsPremiumLoading(false);
      }
    };

    fetchUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const fetchPremium = async () => {
      if (!user) return;
      const supabase = createClient();
      try {
        const { data: userData } = await supabase
          .from("users")
          .select("is_premium")
          .eq("id", user?.id)
          .single();
        setIsPremium(userData?.is_premium ?? false);
      } finally {
        setIsPremiumLoading(false);
      }
    };
    fetchPremium();
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isAuthenticatedLoading,
        isPremium,
        isPremiumLoading,
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
