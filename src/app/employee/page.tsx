import { auth } from "@/auth";
import { EmployeeApplicationsPanel } from "@/components/employee/employee-applications-panel";
import { redirect } from "next/navigation";
import { listApplicationSummaries } from "@/lib/applications";

export const dynamic = "force-dynamic";

export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function EmployeePage() {
  const session = await auth();
  const user = session?.user;

  if (!user) {
    redirect("/login");
  }

  if ((user as any).role !== "employee") {
    redirect("/dashboard");
  }

  const applications = (await listApplicationSummaries()).filter(
    (application) => application.email?.toLowerCase() === user.email?.toLowerCase()
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">ข้อมูลใบสมัคร</h1>
      </div>
      <EmployeeApplicationsPanel applications={applications} />
    </div>
  );
}
