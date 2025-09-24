import { ApplicationForm } from "@/components/dashboard/application-form";

export default function NewApplicationPage() {
  return (
    <div className="space-y-6">
       <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">สร้างใบสมัครใหม่</h1>
        <p className="text-muted-foreground">
          กรอกข้อมูลผู้สมัครพนักงานขับรถตามขั้นตอน
        </p>
      </div>
      <ApplicationForm />
    </div>
  );
}
