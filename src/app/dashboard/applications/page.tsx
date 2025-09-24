import { ApplicationsTable } from "@/components/dashboard/applications-table";
import { mockApplications } from "@/lib/data";

export default function ApplicationsPage() {
  // In a real app, you would fetch this data from your API
  const applications = mockApplications;

  return (
    <div className="space-y-6">
       <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">Applications</h1>
        <p className="text-muted-foreground">
          Manage and review all driver applications.
        </p>
      </div>
      <ApplicationsTable applications={applications} />
    </div>
  );
}
