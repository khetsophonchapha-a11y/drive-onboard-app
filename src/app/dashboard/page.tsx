import { format, subDays } from "date-fns";
import { auth } from "@/auth";
import { DashboardTabs } from "@/components/dashboard/dashboard-tabs";
import type { AppRow } from "@/lib/types";
import type { DailyReportSummaryRow } from "@/lib/daily-report";
import type { User } from "@/lib/types";
import { formatISO } from "date-fns";
import { listApplicationSummaries } from "@/lib/applications";
import { redirect } from "next/navigation";

// Force dynamic rendering
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

// --- Direct data fetching (NO self-referencing fetch) ---

async function getApplications(): Promise<AppRow[]> {
  try {
    return await listApplicationSummaries();
  } catch (error: any) {
    console.error("Error in getApplications:", error);
    return [];
  }
}

export default async function DashboardPage() {
  const session = await auth();
  const userRole = (session?.user as User | undefined)?.role;

  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard");
  }

  if (userRole !== "admin" && userRole !== "god") {
    redirect("/employee/daily-report");
  }

  const apps = await getApplications();
  const today = new Date();
  const monthStr = format(today, "yyyy-MM");
  const startStr = formatISO(subDays(today, 6), { representation: "date" });
  const endStr = formatISO(today, { representation: "date" });

  const dailyReportSummary: DailyReportSummaryRow[] = [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">แดชบอร์ด</h1>
        <p className="text-muted-foreground">
          ภาพรวมและจัดการใบสมัครพนักงานขับรถทั้งหมด
        </p>
      </div>
      <DashboardTabs
        initialApplications={apps}
        initialDailyReportDate={monthStr}
        initialStartDate={startStr}
        initialEndDate={endStr}
        initialDailyReportSummary={dailyReportSummary}
        userEmail={session?.user?.email ?? ""}
        userRole={userRole}
      />
    </div>
  );
}
