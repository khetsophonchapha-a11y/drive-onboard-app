"use client";

import { ApplicationsTable } from "@/components/dashboard/applications-table";
import type { AppRow } from "@/lib/types";

export function EmployeeApplicationsPanel({ applications }: { applications: AppRow[] }) {
  return (
    <ApplicationsTable
      applications={applications}
      isAdmin={false}
      detailBasePath="/employee/applications"
      showToolbar={false}
      showFooter={false}
      onDelete={() => {}}
    />
  );
}
