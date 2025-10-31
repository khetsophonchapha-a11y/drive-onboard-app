
import { ApplicationDetails } from "@/components/dashboard/application-details";
import type { Manifest } from "@/lib/types";
import { notFound } from "next/navigation";

// Helper to fetch data directly on the server, leveraging Next.js fetch caching
async function getApplication(id: string): Promise<Manifest | null> {
    // Construct the base URL safely, defaulting to localhost for local development
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002';
    try {
        // Use fetch with a specific tag for on-demand revalidation.
        // Next.js automatically caches fetch requests. The API route itself
        // sets a revalidate time of 3600s, which will be respected here.
        const res = await fetch(`${baseUrl}/api/applications/${id}`, { 
            next: { tags: [`r2-app-${id}`] } 
        });

        // If the application is not found, the API returns 404
        if (res.status === 404) {
            return null;
        }

        // For other errors, log them and throw to be caught below
        if (!res.ok) {
            const errorText = await res.text();
            console.error(`Failed to fetch application ${id}:`, errorText);
            throw new Error(`Failed to fetch application: ${res.statusText}`);
        }

        // Return the parsed JSON data
        return await res.json();

    } catch (error) {
        console.error(`Error in getApplication(${id}):`, error);
        // In case of a network or parsing error on the server, we can't recover,
        // so we'll treat it as if the application was not found.
        return null;
    }
}


export default async function ApplicationDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;

  // Validate that an ID is present
  if (!id) {
    notFound();
  }

  // Fetch the application data on the server
  const application = await getApplication(id);

  // If no application is found, render the 404 page
  if (!application) {
    notFound();
  }

  // Render the details component with the fetched data
  return (
    <div className="space-y-6">
      <ApplicationDetails application={application} />
    </div>
  );
}
