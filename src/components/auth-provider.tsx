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
          if (pathname === "/login") {
            router.push("/dashboard");
          }
        } else {
          if (pathname !== "/login") {
            router.push("/login");
          }
        }
      } catch (error) {
        console.error("Failed to parse user from localStorage", error);
        localStorage.removeItem("driveonboard_user");
        if (pathname !== "/login") {
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
    const newUser: User = { email, name: "Admin User", avatarUrl: "https://picsum.photos/seed/admin/100/100" };
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
  
  if (loading) {
    return <div className="flex items-center justify-center h-screen w-full"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div></div>;
  }
  
  if (!user && pathname !== '/login') {
     return <div className="flex items-center justify-center h-screen w-full"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div></div>;
  }


  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
