"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApplicationsClient } from "@/components/dashboard/applications-client";
import { DailyReportTracker } from "@/components/dashboard/daily-report-tracker";
import type { AppRow } from "@/lib/types";
import type { DailyReportSummaryRow } from "@/lib/daily-report";

interface DashboardTabsProps {
  initialApplications: AppRow[];
  initialDailyReportDate: string; // deprecated, kept for compatibility
  initialStartDate?: string;
  initialEndDate?: string;
  initialDailyReportSummary: DailyReportSummaryRow[];
  userEmail?: string;
  userRole?: string;
}

export function DashboardTabs({
  initialApplications,
  initialDailyReportDate,
  initialStartDate,
  initialEndDate,
  initialDailyReportSummary,
  userEmail,
  userRole,
}: DashboardTabsProps) {
  const isAdmin = userRole === "admin" || userRole === "god";

  return (
    <Tabs defaultValue="applications" className="space-y-6">
      <TabsList className="w-full justify-start overflow-x-auto">
        <TabsTrigger value="applications">ข้อมูลใบสมัคร</TabsTrigger>
        <TabsTrigger value="daily-report">Daily Report</TabsTrigger>
      </TabsList>

      <TabsContent value="applications" className="space-y-6">
        <ApplicationsClient
          initialApplications={initialApplications}
          userRole={userRole}
          userEmail={userEmail}
        />
      </TabsContent>

      <TabsContent value="daily-report">
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              {isAdmin ? "Daily Report Overview" : "Daily Report ของฉัน"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isAdmin
                ? "ตรวจสอบความคืบหน้าการแนบรูปประจำวันของพนักงานทั้งหมด"
                : "ติดตามและอัปโหลดรายงานประจำวันของตนเอง"}
            </p>
          </div>
          <DailyReportTracker
            initialDate={initialDailyReportDate}
            initialStartDate={initialStartDate}
            initialEndDate={initialEndDate}
            initialRows={initialDailyReportSummary}
            userEmail={userEmail}
            userRole={userRole}
          />
        </div>
      </TabsContent>
    </Tabs>
  );
}
