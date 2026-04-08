import { format, parseISO, eachDayOfInterval } from "date-fns";
import { auth } from "@/auth";
import { DashboardTabs } from "@/components/dashboard/dashboard-tabs";
import type { AppRow } from "@/lib/types";
import type { DailyReportSummaryRow } from "@/lib/daily-report";
import { TOTAL_DAILY_REPORT_SLOTS, getDailyReportProgressStatus } from "@/lib/daily-report";
import type { User } from "@/lib/types";
import { startOfMonth, endOfMonth, formatISO } from "date-fns";
import { listApplicationSummaries } from "@/lib/applications";
import { fetchDailyReportSummaryRange, isD1DailyReportEnabled } from "@/lib/d1-daily-report";
import { fetchAllUsers } from "@/lib/d1-users";
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

async function getDailyReportSummaryDirect(
  startStr: string,
  endStr: string,
  email?: string,
  apps?: AppRow[]
): Promise<DailyReportSummaryRow[]> {
  try {
    const startDate = parseISO(startStr);
    const endDate = parseISO(endStr);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    if (!isD1DailyReportEnabled()) return [];

    const d1Rows = await fetchDailyReportSummaryRange(startStr, endStr, email);
    if (!d1Rows) return [];

    const fillMissingForEmail = (targetEmail: string, sourceRows: any[]): any[] => {
      const byDate = new Map(sourceRows.map((r) => [r.date, r]));
      return days.map((day) => {
        const dateStr = format(day, "yyyy-MM-dd");
        const existing = byDate.get(dateStr);
        if (existing) return existing;
        return {
          appId: targetEmail,
          fullName: targetEmail,
          email: targetEmail,
          phone: null,
          date: dateStr,
          uploadedCount: 0,
          totalSlots: TOTAL_DAILY_REPORT_SLOTS,
          status: "missing",
          lastUpdated: undefined,
          notes: undefined,
        };
      });
    };

    if (email) {
      return fillMissingForEmail(email, d1Rows);
    }

    // Admin: get all employees
    const users = await fetchAllUsers();
    let employees = users.filter((u) => u.role === "employee").map((u) => u.email);
    const phoneMap = new Map(users.map((u) => [u.email.toLowerCase(), u.phone]));
    const addressMap = new Map<string, string>();
    if (apps) {
      for (const app of apps) {
        if (app.email && app.currentAddress) {
          addressMap.set(app.email.toLowerCase(), app.currentAddress);
        }
      }
    }

    for (const row of d1Rows) {
      const lowerEmail = (row.email || "").toLowerCase();
      const phone = phoneMap.get(lowerEmail);
      if (phone) (row as any).phone = phone;
      
      const addr = addressMap.get(lowerEmail);
      if (addr) (row as any).currentAddress = addr;
    }

    if (employees.length === 0) {
      employees = Array.from(new Set(d1Rows.map((r: any) => r.email).filter(Boolean)));
    }

    const filledAll: any[] = [];
    for (const emp of employees) {
      const rowsForEmp = d1Rows.filter((r: any) => r.email === emp);
      const lowerEmp = emp.toLowerCase();
      const phone = phoneMap.get(lowerEmp);
      const currentAddress = addressMap.get(lowerEmp);
      const filled = fillMissingForEmail(emp, rowsForEmp).map((r: any) => {
        return { ...r, phone, currentAddress };
      });
      filledAll.push(...filled);
    }

    filledAll.sort((a, b) => {
      const dA = parseISO(a.date).getTime();
      const dB = parseISO(b.date).getTime();
      if (dA !== dB) return dA - dB;
      return (a.fullName || a.email || "").localeCompare(b.fullName || b.email || "");
    });

    return filledAll;
  } catch (error) {
    console.error("Error in getDailyReportSummaryDirect:", error);
    return [];
  }
}

export default async function DashboardPage() {
  const session = await auth();
  const userRole = (session?.user as User | undefined)?.role;

  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard");
  }

  if (userRole !== "admin") {
    redirect("/employee/daily-report");
  }

  const apps = await getApplications();
  const today = new Date();
  const monthStr = format(today, "yyyy-MM");
  const startStr = formatISO(startOfMonth(today), { representation: "date" });
  const endOfMonthStr = formatISO(endOfMonth(today), { representation: "date" });
  const todayStr = formatISO(today, { representation: "date" });
  const endStr = endOfMonthStr > todayStr ? todayStr : endOfMonthStr;

  let dailyReportSummary: DailyReportSummaryRow[] = [];
  dailyReportSummary = await getDailyReportSummaryDirect(startStr, endStr, undefined, apps);

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
