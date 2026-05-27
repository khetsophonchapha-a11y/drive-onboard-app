import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { fetchAllHubs } from "@/lib/d1-hubs";
import { HubsClient } from "@/components/dashboard/hubs-client";

export const dynamic = "force-dynamic";

export default async function HubsPage() {
  const session = await auth();
  const user = session?.user;
  const role = (user as any)?.role;

  if (!user || (role !== "admin" && role !== "god")) {
    redirect("/dashboard");
  }

  const hubs = await fetchAllHubs();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">จัดการ Hub</h1>
        <p className="text-muted-foreground">เพิ่ม ลบ หรือแก้ไขข้อมูล Hub สำหรับจัดกลุ่มพนักงานขับรถ</p>
      </div>
      <HubsClient initialData={hubs} />
    </div>
  );
}
