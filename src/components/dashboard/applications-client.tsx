
"use client";

import { useState, useMemo } from "react";
import { OverviewCards } from "@/components/dashboard/overview-cards";
import { ApplicationsTable } from "@/components/dashboard/applications-table";
import type { AppRow, VerificationStatus } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type ApplicationsClientProps = {
  initialApplications: AppRow[];
  userRole?: string;
  userEmail?: string;
};

export function ApplicationsClient({ initialApplications, userRole, userEmail }: ApplicationsClientProps) {
  const [statusFilter, setStatusFilter] = useState<VerificationStatus | "all">("all");
  const { toast } = useToast();
  
  // No more local 'applications' state. We use the prop directly.
  // This ensures that when the parent Server Component re-renders with new data,
  // this component also re-renders with the fresh data.
  const isAdmin = userRole === "admin";
  const applications = useMemo(() => {
    if (isAdmin) return initialApplications;
    // employee: แสดงเฉพาะของตัวเอง ถ้าหารายการไม่เจอ ให้ได้เป็น [] ไม่เห็นของคนอื่น
    return initialApplications.filter(
      (app) => app.email?.toLowerCase() === userEmail?.toLowerCase()
    );
  }, [initialApplications, isAdmin, userEmail]);


  const handleStatusFilter = (status: VerificationStatus | "all") => {
    setStatusFilter(status);
  };
  
  const filteredApplications = useMemo(() => {
    if (statusFilter === 'all') {
      return applications;
    }
    return applications.filter(app => app.status === statusFilter);
  }, [applications, statusFilter]);

  const handleDeleteApplication = async (applicationId: string) => {
    // This is a placeholder. In a real app, you would call a DELETE API endpoint.
    // This endpoint would need to:
    // 1. Delete all files in the `applications/{appId}` folder in R2.
    // 2. Delete the `manifest.json`.
    // 3. Remove the entry from `index.json`.
    // After that, it should call revalidateTag('r2-index') and the UI will update.
    console.log(`TODO: Implement deletion for ${applicationId}`);
    
    toast({
      title: "ยังไม่รองรับการลบ",
      description: "ฟังก์ชันการลบข้อมูลยังไม่ถูกสร้างขึ้น",
      variant: "destructive"
    })
  };

  return (
    <>
      <OverviewCards 
          onStatusSelect={handleStatusFilter} 
          selectedStatus={statusFilter}
          applications={applications} 
      />
      <ApplicationsTable 
          applications={filteredApplications} 
          isAdmin={isAdmin}
          detailBasePath={isAdmin ? "/dashboard/applications" : "/employee/applications"}
          onDelete={handleDeleteApplication} 
      />
    </>
  );
}
