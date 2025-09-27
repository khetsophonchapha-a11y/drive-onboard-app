"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mockApplications } from "@/lib/data";
import type { ApplicationStatus } from "@/lib/types";
import { Users, FileClock, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type OverviewCardsProps = {
  onStatusSelect: (status: ApplicationStatus | "all") => void;
  selectedStatus: ApplicationStatus | "all";
};

export function OverviewCards({ onStatusSelect, selectedStatus }: OverviewCardsProps) {
  const statusCounts = mockApplications.reduce((acc, app) => {
    acc[app.status] = (acc[app.status] || 0) + 1;
    return acc;
  }, {} as Record<ApplicationStatus, number>);

  const totalApplications = mockApplications.length;
  const pendingApplications = statusCounts.pending || 0;
  const approvedApplications = statusCounts.approved || 0;
  const rejectedApplications = statusCounts.rejected || 0;
  const incompleteApplications = statusCounts.incomplete || 0;

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
  ] as const;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
