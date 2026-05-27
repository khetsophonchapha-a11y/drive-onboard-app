
"use client";

import { useState, useMemo } from "react";
import { OverviewCards } from "@/components/dashboard/overview-cards";
import { ApplicationsTable } from "@/components/dashboard/applications-table";
import type { AppRow, VerificationStatus } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { softDeleteApplication } from "@/app/actions";
import { useRouter } from "next/navigation";

type ApplicationsClientProps = {
  initialApplications: AppRow[];
  userRole?: string;
  userEmail?: string;
};

export function ApplicationsClient({ initialApplications, userRole, userEmail }: ApplicationsClientProps) {
  const [statusFilter, setStatusFilter] = useState<VerificationStatus | "all">("all");
  const { toast } = useToast();
  const router = useRouter();
  
  // No more local 'applications' state. We use the prop directly.
  // This ensures that when the parent Server Component re-renders with new data,
  // this component also re-renders with the fresh data.
  const isAdmin = userRole === "admin" || userRole === "god";
  const applications = useMemo(() => {
    const normalizedApplications = initialApplications
      .filter((app): app is AppRow => Boolean(app?.appId))
      .map((app) => ({
        appId: app.appId,
        fullName: typeof app.fullName === "string" && app.fullName.trim().length > 0 ? app.fullName : "ไม่ระบุชื่อ",
        email: typeof app.email === "string" ? app.email : undefined,
        phone: typeof app.phone === "string" ? app.phone : undefined,
        createdAt:
          typeof app.createdAt === "string" && Number.isFinite(new Date(app.createdAt).getTime())
            ? app.createdAt
            : new Date(0).toISOString(),
        status:
          app.status === "approved" ||
          app.status === "rejected" ||
          app.status === "terminated" ||
          app.status === "pending"
            ? app.status
            : "pending",
      }));

    if (isAdmin) return normalizedApplications;
    // employee: แสดงเฉพาะของตัวเอง ถ้าหารายการไม่เจอ ให้ได้เป็น [] ไม่เห็นของคนอื่น
    return normalizedApplications.filter(
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
    const result = await softDeleteApplication(applicationId);

    if (result.success) {
      toast({
        title: "ลบใบสมัครสำเร็จ",
        description: "ใบสมัครถูกย้ายไปในถังขยะ สามารถกู้คืนได้",
      });
      router.refresh();
    } else {
      toast({
        title: "ลบใบสมัครไม่สำเร็จ",
        description: result.error,
        variant: "destructive",
      });
    }
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
