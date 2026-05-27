import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { listDeletedApplicationSummaries } from "@/lib/applications";
import { TrashClient } from "@/components/dashboard/trash-client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function TrashPage() {
  const session = await auth();
  const userRole = (session?.user as { role?: string })?.role;

  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard/trash");
  }

  if (userRole !== "admin" && userRole !== "god") {
    redirect("/employee/daily-report");
  }

  const deletedApplications = await listDeletedApplicationSummaries();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">ถังขยะ</h1>
        <p className="text-muted-foreground">
          ใบสมัครที่ถูกลบจะอยู่ในถังขยะ สามารถกู้คืนได้ และเฉพาะระดับ god เท่านั้นที่ลบถาวรได้
        </p>
      </div>
      <TrashClient deletedApplications={deletedApplications} currentUserRole={userRole} />
    </div>
  );
}
