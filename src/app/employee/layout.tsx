import { Header } from "@/components/dashboard/header";
import { AuthProvider } from "@/components/auth-provider";

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex min-h-screen w-full flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </AuthProvider>
  );
}

