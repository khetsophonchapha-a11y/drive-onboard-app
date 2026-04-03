"use client";

import { useEffect, useState } from "react";
import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

/**
 * Wraps children with next-auth's SessionProvider so any useSession()
 * calls inside the tree (e.g., AuthProvider) have the required context.
 */
export function NextAuthProvider({ children }: { children: ReactNode }) {
  const [baseUrl, setBaseUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  return <SessionProvider baseUrl={baseUrl}>{children}</SessionProvider>;
}
