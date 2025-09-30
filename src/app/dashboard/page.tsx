
import { ApplicationsClient } from "@/components/dashboard/applications-client";
import type { AppRow } from "@/lib/types";

// Helper to fetch data directly on the server
async function getApplications(): Promise<AppRow[]> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002';
  try {
    // We use fetch with cache: 'no-store' to ensure we always get fresh data
    // when this server component re-renders (e.g., after a router.refresh()).
    const res = await fetch(`${baseUrl}/api/applications`, { cache: 'no-store' });

    if (!res.ok) {
      console.error("Failed to fetch applications:", await res.text());
      return []; // Return empty array on error
    }
    return await res.json();
  } catch (error) {
    console.error("Error in getApplications:", error);
    return []; // Return empty array on network or parsing error
  }
}


export default async function DashboardPage() {
  const applications = await getApplications();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">แดชบอร์ด</h1>
        <p className="text-muted-foreground">
          ภาพรวมและจัดการใบสมัครพนักงานขับรถทั้งหมด
        </p>
      </div>
      <ApplicationsClient initialApplications={applications} />
    </div>
  );
}
