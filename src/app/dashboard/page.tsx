
"use client";

import { useState } from "react";
import { OverviewCards } from "@/components/dashboard/overview-cards";
import { ApplicationsTable } from "@/components/dashboard/applications-table";
import { mockApplications } from "@/lib/data";
import type { Application, ApplicationStatus } from "@/lib/types";

export default function DashboardPage() {
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "all">("all");
  const [applications, setApplications] = useState<Application[]>(mockApplications);

  const handleStatusFilter = (status: ApplicationStatus | "all") => {
    setStatusFilter(status);
  };
  
  const filteredApplications = statusFilter === 'all' 
    ? applications 
    : applications.filter(app => app.status === statusFilter);

  const handleDeleteApplication = (applicationId: string) => {
    // In a real app, you would make an API call to delete the application from the database.
    // For this mock implementation, we'll just filter the state.
    setApplications(apps => apps.filter(app => app.id !== applicationId));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">แดชบอร์ด</h1>
        <p className="text-muted-foreground">
          ภาพรวมและจัดการใบสมัครพนักงานขับรถทั้งหมด
        </p>
      </div>
      <OverviewCards onStatusSelect={handleStatusFilter} selectedStatus={statusFilter} />
      <ApplicationsTable applications={filteredApplications} onDelete={handleDeleteApplication} />
    </div>
  );
}
