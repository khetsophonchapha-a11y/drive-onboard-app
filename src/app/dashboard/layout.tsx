
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthProvider } from "@/components/auth-provider";
import { Header } from "@/components/dashboard/header";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard");
  }

  if (role !== "admin" && role !== "god") {
    redirect("/employee/daily-report");
  }

  return (
    <AuthProvider>
      <div className="flex min-h-screen w-full flex-col">
          <Header />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            {children}
          </main>
      </div>
    </AuthProvider>
  );
}
