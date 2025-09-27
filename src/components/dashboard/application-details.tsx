"use client";

import { useState } from "react";
import type { Application, Document, DocumentStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  FileClock,
  FileQuestion,
  Sparkles,
  Loader2,
  Upload,
} from "lucide-react";
import Image from "next/image";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { analyzeIncompleteForm } from "@/ai/flows/analyze-incomplete-forms";
import { applicationFormSchema, requiredDocumentsSchema } from "@/lib/schema";
import { getImageAsDataUri } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ApplicationDetailsProps = {
  application: Application;
};

const statusIcons: Record<DocumentStatus, React.ElementType> = {
  missing: FileQuestion,
  uploaded: FileClock,
  "pending review": FileClock,
  approved: CheckCircle2,
  rejected: XCircle,
};

const statusColors: Record<DocumentStatus, string> = {
  missing: "text-muted-foreground",
  uploaded: "text-blue-500",
  "pending review": "text-amber-500",
  approved: "text-success",
  rejected: "text-destructive",
};

const statusText: Record<Application["status"], string> = {
  incomplete: "เอกสารไม่ครบ",
  pending: "รอตรวจสอบ",
  approved: "อนุมัติ",
  rejected: "ปฏิเสธ",
};

const docStatusText: Record<DocumentStatus, string> = {
  missing: 'ไม่มีไฟล์',
  uploaded: 'อัปโหลดแล้ว',
  'pending review': 'รอตรวจสอบ',
  approved: 'อนุมัติ',
  rejected: 'ปฏิเสธ'
}

const statusVariantMap: Record<Application["status"], "default" | "secondary" | "success" | "destructive"> = {
  incomplete: "secondary",
  pending: "default",
  approved: "success",
  rejected: "destructive",
};

export function ApplicationDetails({ application: initialApplication }: ApplicationDetailsProps) {
  const [application, setApplication] = useState<Application>(initialApplication);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{ analysis: string; instructions: string } | null>(null);
  const [isAnalysisDialogOpen, setIsAnalysisDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const uploadedDocuments = application.documents.filter(doc => doc.fileUrl);
      const documentDataUris = await Promise.all(
        uploadedDocuments.map(doc => getImageAsDataUri(doc.fileUrl!))
      );
      
      const filledFormData = JSON.stringify({
        applicant: application.applicant,
        vehicle: application.vehicle,
        guarantor: application.guarantor,
      });

      const result = await analyzeIncompleteForm({
        documentDataUris,
        applicationFormSchema: JSON.stringify(applicationFormSchema),
        filledFormData,
      });

      setAnalysisResult(result);
      setIsAnalysisDialogOpen(true);

    } catch (error) {
      console.error("Failed to analyze form:", error);
      toast({
        variant: "destructive",
        title: "การวิเคราะห์ล้มเหลว",
        description: "ไม่สามารถวิเคราะห์ฟอร์มได้ กรุณาลองใหม่",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const allDocuments = requiredDocumentsSchema.map(reqDoc => {
    const submittedDoc = application.documents.find(d => d.type === reqDoc.type);
    return submittedDoc || { id: reqDoc.id, type: reqDoc.type, status: 'missing' };
  });

  const renderDetail = (label: string, value: string | number | undefined) => (
    <div className="grid grid-cols-3 gap-2 text-sm">
      <dt className="font-medium text-muted-foreground">{label}</dt>
      <dd className="col-span-2">{value || <span className="text-muted-foreground/70">ไม่ได้กรอก</span>}</dd>
    </div>
  );
  
  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="font-headline text-2xl">{application.applicant.fullName || "ผู้สมัครไม่มีชื่อ"}</CardTitle>
                  <CardDescription>รหัสใบสมัคร: {application.id}</CardDescription>
                </div>
                <Badge variant={statusVariantMap[application.status]} className="capitalize text-base">{statusText[application.status]}</Badge>
            </div>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader><CardTitle className="font-headline">ข้อมูลผู้สมัคร</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {renderDetail("ชื่อ-นามสกุล", application.applicant.fullName)}
            {renderDetail("อีเมล", application.applicant.email)}
            {renderDetail("เบอร์โทรศัพท์", application.applicant.phone)}
            {renderDetail("ที่อยู่", application.applicant.address)}
            {renderDetail("วันเกิด", application.applicant.dateOfBirth)}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader><CardTitle className="font-headline">ข้อมูลยานพาหนะ</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {renderDetail("ยี่ห้อ", application.vehicle.make)}
            {renderDetail("รุ่น", application.vehicle.model)}
            {renderDetail("ปี", application.vehicle.year)}
            {renderDetail("ป้ายทะเบียน", application.vehicle.licensePlate)}
            {renderDetail("เลขตัวถัง (VIN)", application.vehicle.vin)}
          </CardContent>
        </Card>
        
         <Card>
          <CardHeader><CardTitle className="font-headline">ข้อมูลผู้ค้ำประกัน</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {renderDetail("ชื่อ-นามสกุล", application.guarantor.fullName)}
            {renderDetail("อีเมล", application.guarantor.email)}
            {renderDetail("เบอร์โทรศัพท์", application.guarantor.phone)}
            {renderDetail("ที่อยู่", application.guarantor.address)}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">ตรวจสอบเอกสาร</CardTitle>
            <CardDescription>ตรวจสอบและอนุมัติ/ปฏิเสธเอกสารที่ส่งมา</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {allDocuments.map((doc: Document) => {
               const Icon = statusIcons[doc.status];
               return (
                <div key={doc.id} className="border rounded-lg p-4 space-y-4">
                   <div className="flex items-center justify-between">
                      <h4 className="font-semibold">{doc.type}</h4>
                      <div className={`flex items-center gap-2 text-sm font-medium ${statusColors[doc.status]}`}>
                          <Icon className="h-4 w-4" />
                          <span className="capitalize">{docStatusText[doc.status]}</span>
                      </div>
                  </div>

                  {doc.status !== 'missing' && doc.fileUrl && (
                    <div className="flex flex-col md:flex-row gap-4">
                       <div className="relative w-full md:w-1/3 aspect-video rounded-md overflow-hidden border">
                          <Image src={doc.fileUrl} alt={doc.type} fill style={{ objectFit: 'cover' }} data-ai-hint="document" />
                      </div>
                      <div className="flex-1 space-y-2">
                          <Select defaultValue={doc.quality || 'clear'}>
                              <SelectTrigger><SelectValue placeholder="ประเมินคุณภาพ..." /></SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="clear">ชัดเจน</SelectItem>
                                  <SelectItem value="blurry">เบลอ</SelectItem>
                                  <SelectItem value="incomplete">ไม่สมบูรณ์</SelectItem>
                                  <SelectItem value="incorrect">เอกสารไม่ถูกต้อง</SelectItem>
                              </SelectContent>
                          </Select>
                          <Textarea placeholder="เพิ่มบันทึกการตรวจสอบ..." defaultValue={doc.notes} />
                          <div className="flex gap-2 pt-2">
                              <Button size="sm" variant="success">อนุมัติ</Button>
                              <Button size="sm" variant="destructive">ปฏิเสธ</Button>
                          </div>
                      </div>
                    </div>
                  )}

                  {doc.status === 'missing' && (
                     <div className="flex items-center justify-center p-6 bg-muted/50 rounded-md border-dashed border-2">
                         <div className="text-center text-muted-foreground">
                             <p className="font-medium">ยังไม่ได้อัปโหลดเอกสาร</p>
                             <Button size="sm" variant="outline" className="mt-2"><Upload className="mr-2 h-4 w-4"/>ขอให้อัปโหลด</Button>
                         </div>
                     </div>
                  )}
                </div>
              )
            })}
          </CardContent>
           <CardFooter>
              <Button onClick={handleAnalyze} disabled={isAnalyzing}>
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    กำลังวิเคราะห์...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    วิเคราะห์ความไม่สมบูรณ์ด้วย AI
                  </>
                )}
              </Button>
           </CardFooter>
        </Card>
      </div>
       <Dialog open={isAnalysisDialogOpen} onOpenChange={setIsAnalysisDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-headline text-2xl">
              <Sparkles className="h-6 w-6 text-primary" />
              รายงานการวิเคราะห์ฟอร์มด้วย AI
            </DialogTitle>
            <DialogDescription>
              การวิเคราะห์ข้อมูลที่ขาดหายไปหรือไม่ถูกต้องจากข้อมูลที่ส่งมา
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto p-1 pr-4 space-y-4">
            <div>
              <h3 className="font-semibold text-lg mb-2">สรุปผลการวิเคราะห์</h3>
              <p className="text-sm text-muted-foreground bg-secondary p-3 rounded-md">{analysisResult?.analysis}</p>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">คำแนะนำสำหรับผู้สมัคร</h3>
              <div className="text-sm border p-3 rounded-md prose-sm prose-p:my-1 prose-ul:my-1">
                <p>{analysisResult?.instructions}</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
