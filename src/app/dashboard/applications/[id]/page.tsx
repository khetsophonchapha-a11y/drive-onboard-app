
import { ApplicationDetails } from "@/components/dashboard/application-details";
import type { Manifest } from "@/lib/types";
import { notFound } from "next/navigation";

// Helper to fetch data directly on the server
async function getApplication(id: string): Promise<Manifest | null> {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002';
    try {
        // Use fetch with a specific tag for on-demand revalidation
        const res = await fetch(`${baseUrl}/api/applications/${id}`, { 
            next: { tags: [`r2-app-${id}`] } 
        });

        if (res.status === 404) {
            return null;
        }

        if (!res.ok) {
            const errorText = await res.text();
            console.error(`Failed to fetch application ${id}:`, errorText);
            throw new Error(`Failed to fetch application: ${res.statusText}`);
        }
        return await res.json();
    } catch (error) {
        console.error(`Error in getApplication(${id}):`, error);
        // In case of a network or parsing error, we treat it as not found on the server.
        return null;
    }
}


export default async function ApplicationDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;

  if (!id) {
    notFound();
  }

  const application = await getApplication(id);

  if (!application) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <ApplicationDetails application={application} />
    </div>
  );
}
