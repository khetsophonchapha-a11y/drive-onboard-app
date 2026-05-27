"use client";

import React, { createContext, ReactNode, useCallback } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import type { User } from "@/lib/types";

interface AuthContextType {
  user: User | null | undefined; // Can be undefined during loading
  login: () => void;
  logout: () => void;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const loading = status === "loading";

  // Map the session user to your app's User type
  const user = session?.user as User | null;

  const login = () => {
    signIn();
  };

  const logout = useCallback(async () => {
    await signOut({ redirect: false });
    window.location.assign(`${window.location.origin}/login`);
  }, []);

  const value = { user, login, logout, loading };

  // Route protection is handled in server layouts/pages.
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen w-full">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
