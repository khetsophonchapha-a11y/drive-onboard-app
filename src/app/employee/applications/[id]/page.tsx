import { auth } from "@/auth";
import { ApplicationDetails } from "@/components/dashboard/application-details";
import { getApplicationById, normalizeEmail } from "@/lib/applications";
import { notFound, redirect } from "next/navigation";

export default async function EmployeeApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const user = session?.user;

  if (!user) {
    redirect("/login");
  }

  if ((user as any).role !== "employee") {
    redirect("/dashboard");
  }

  const { id } = await params;
  const application = await getApplicationById(id);

  if (!application) {
    notFound();
  }

  if (normalizeEmail(application.manifest.applicant.email) !== normalizeEmail(user.email ?? "")) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <ApplicationDetails application={application.manifest} readOnly />
    </div>
  );
}

