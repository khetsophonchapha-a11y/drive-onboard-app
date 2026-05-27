import { ApplicationDetails } from "@/components/dashboard/application-details";
import { auth } from "@/auth";
import type { Manifest, User } from "@/lib/types";
import { notFound, redirect } from "next/navigation";

import { getApplicationById } from "@/lib/applications";

async function getApplication(id: string): Promise<Manifest | null> {
  try {
    const data = await getApplicationById(id);
    return data?.manifest || null;
  } catch (error) {
    console.error(`Error in getApplication(${id}):`, error);
    return null;
  }
}


export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userRole = (session?.user as User | undefined)?.role;
  if (userRole !== "admin" && userRole !== "god") {
    redirect("/employee");
  }

  const { id } = await params;

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
