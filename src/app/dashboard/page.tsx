import { OverviewCards } from "@/components/dashboard/overview-cards";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">แดชบอร์ด</h1>
        <p className="text-muted-foreground">
          ภาพรวมใบสมัครพนักงานขับรถทั้งหมด
        </p>
      </div>
      <OverviewCards />
    </div>
  );
}
