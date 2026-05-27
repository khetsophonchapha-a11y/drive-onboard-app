import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/dashboard/header";
import { AuthProvider } from "@/components/auth-provider";

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/employee/daily-report");
  }

  if ((session.user as { role?: string }).role !== "employee") {
    redirect("/dashboard");
  }

  return (
    <AuthProvider>
      <div className="flex min-h-screen w-full flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </AuthProvider>
  );
}
