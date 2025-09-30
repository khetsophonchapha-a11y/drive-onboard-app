
"use client";

import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/dashboard/header";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();
  
  if (loading) {
    return <div className="flex items-center justify-center h-screen w-full"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div></div>;
  }

  return (
      <div className="flex min-h-screen w-full flex-col">
          <Header />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            {children}
          </main>
      </div>
  );
}
