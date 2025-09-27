
"use client";

import { useState, useEffect } from "react";
import { OverviewCards } from "@/components/dashboard/overview-cards";
import { ApplicationsTable } from "@/components/dashboard/applications-table";
import type { AppRow, VerificationStatus } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const [statusFilter, setStatusFilter] = useState<VerificationStatus | "all">("all");
  const [applications, setApplications] = useState<AppRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchApplications = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/applications");
        if (!res.ok) {
          throw new Error("Failed to fetch applications");
        }
        const data = await res.json();
        setApplications(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchApplications();
  }, []);

  const handleStatusFilter = (status: VerificationStatus | "all") => {
    setStatusFilter(status);
  };
  
  const filteredApplications = statusFilter === 'all' 
    ? applications 
    : applications.filter(app => app.status === statusFilter);

  const handleDeleteApplication = async (applicationId: string) => {
    // This is a placeholder. In a real app, you would call a DELETE API endpoint.
    // This endpoint would need to:
    // 1. Delete all files in the `applications/{appId}` folder in R2.
    // 2. Delete the `manifest.json`.
    // 3. Remove the entry from `index.json`.
    console.log(`TODO: Implement deletion for ${applicationId}`);
    
    // For now, just remove from the UI optimistically.
    setApplications(apps => apps.filter(app => app.appId !== applicationId));
  };


  if (error) {
    return <div className="text-destructive">Error: {error}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">แดชบอร์ด</h1>
        <p className="text-muted-foreground">
          ภาพรวมและจัดการใบสมัครพนักงานขับรถทั้งหมด
        </p>
      </div>
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-[109px] w-full" />
          <Skeleton className="h-[109px] w-full" />
          <Skeleton className="h-[109px] w-full" />
          <Skeleton className="h-[109px] w-full" />
        </div>
      ) : (
        <OverviewCards 
          onStatusSelect={handleStatusFilter} 
          selectedStatus={statusFilter}
          applications={applications} 
        />
      )}
      {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
      ) : (
        <ApplicationsTable applications={filteredApplications} onDelete={handleDeleteApplication} />
      )}
    </div>
  );
}
