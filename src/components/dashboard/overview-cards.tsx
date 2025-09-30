
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { VerificationStatus, AppRow } from "@/lib/types";
import { Users, FileClock, CheckCircle, XCircle, UserX } from "lucide-react";
import { cn } from "@/lib/utils";

type OverviewCardsProps = {
  onStatusSelect: (status: VerificationStatus | "all") => void;
  selectedStatus: VerificationStatus | "all";
  applications: AppRow[];
};

export function OverviewCards({ onStatusSelect, selectedStatus, applications }: OverviewCardsProps) {
  const statusCounts = applications.reduce((acc, app) => {
    acc[app.status] = (acc[app.status] || 0) + 1;
    return acc;
  }, {} as Record<VerificationStatus, number>);

  const totalApplications = applications.length;
  const pendingApplications = statusCounts.pending || 0;
  const approvedApplications = statusCounts.approved || 0;
  const rejectedApplications = statusCounts.rejected || 0;
  const terminatedApplications = statusCounts.terminated || 0;

  const cardData = [
    {
      title: "ใบสมัครทั้งหมด",
      value: totalApplications,
      icon: Users,
      status: "all",
      color: "text-primary",
    },
    {
      title: "รอตรวจสอบ",
      value: pendingApplications,
      icon: FileClock,
      status: "pending",
      color: "text-amber-500",
    },
    {
      title: "อนุมัติแล้ว",
      value: approvedApplications,
      icon: CheckCircle,
      status: "approved",
      color: "text-success",
    },
    {
      title: "ปฏิเสธ",
      value: rejectedApplications,
      icon: XCircle,
      status: "rejected",
      color: "text-destructive",
    },
    {
      title: "เลิกจ้าง",
      value: terminatedApplications,
      icon: UserX,
      status: "terminated",
      color: "text-slate-500",
    },
  ] as const;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {cardData.map((card) => (
        <Card 
          key={card.status}
          onClick={() => onStatusSelect(card.status)}
          className={cn(
            "cursor-pointer transition-all hover:shadow-md hover:-translate-y-1",
            selectedStatus === card.status && "ring-2 ring-primary bg-secondary"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className={`h-5 w-5 ${card.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
