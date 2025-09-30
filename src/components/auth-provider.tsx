"use client";

import React, { createContext, useState, useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";

interface User {
  email: string;
  name: string;
  avatarUrl?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string) => void;
  logout: () => void;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// List of public paths that don't require authentication
const publicPaths = ['/login', '/apply'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkUser = () => {
      try {
        const storedUser = localStorage.getItem("driveonboard_user");
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          // If user is logged in and tries to access the login page, redirect to dashboard.
          // Allow access to other public pages like /apply.
          if (pathname === '/login') {
            router.push("/dashboard");
          }
        } else {
          // If user is not logged in and not on a public path, redirect to login
          if (!publicPaths.some(path => pathname.startsWith(path))) {
            router.push("/login");
          }
        }
      } catch (error) {
        console.error("Failed to parse user from localStorage", error);
        localStorage.removeItem("driveonboard_user");
        if (!publicPaths.some(path => pathname.startsWith(path))) {
          router.push("/login");
        }
      } finally {
        setLoading(false);
      }
    };

    checkUser();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const login = (email: string) => {
    const newUser: User = { email, name: "ผู้ดูแลระบบ", avatarUrl: "https://picsum.photos/seed/admin/100/100" };
    localStorage.setItem("driveonboard_user", JSON.stringify(newUser));
    setUser(newUser);
    router.push("/dashboard");
  };

  const logout = () => {
    localStorage.removeItem("driveonboard_user");
    setUser(null);
    router.push("/login");
  };

  const value = { user, login, logout, loading };
  
  // While loading, show a spinner
  if (loading) {
    return <div className="flex items-center justify-center h-screen w-full"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div></div>;
  }
  
  // If not loading, and user is required but not present for a protected route, show spinner while redirecting
  if (!user && !publicPaths.some(path => pathname.startsWith(path))) {
     return <div className="flex items-center justify-center h-screen w-full"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div></div>;
  }


  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
