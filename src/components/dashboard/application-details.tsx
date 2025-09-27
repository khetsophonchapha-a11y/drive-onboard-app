"use client";

import { useState } from "react";
import type { Manifest, FileRef, VerificationStatus } from "@/lib/types";
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
  File as FileIcon,
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
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { requiredDocumentsSchema } from "@/lib/schema";

type ApplicationDetailsProps = {
  application: Manifest;
};


const statusText: Record<VerificationStatus, string> = {
  pending: "รอตรวจสอบ",
  approved: "อนุมัติ",
  rejected: "ปฏิเสธ",
};

const statusVariantMap: Record<VerificationStatus, "default" | "secondary" | "success" | "destructive"> = {
  pending: "default",
  approved: "success",
  rejected: "destructive",
};

export function ApplicationDetails({ application: initialApplication }: ApplicationDetailsProps) {
  const [application, setApplication] = useState<Manifest>(initialApplication);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{ analysis: string; instructions: string } | null>(null);
  const [isAnalysisDialogOpen, setIsAnalysisDialogOpen] = useState(false);
  const { toast } = useToast();
  const applicantName = application.applicant.fullName;


  const handleAnalyze = async () => {
    // This function needs to be adapted to the new data structure.
    // It would involve fetching presigned URLs for documents and then calling the AI flow.
    setIsAnalyzing(true);
    toast({
      title: "ฟังก์ชันยังไม่พร้อมใช้งาน",
      description: "การวิเคราะห์ด้วย AI จะถูกนำมาใช้กับโครงสร้างข้อมูลใหม่ในเร็วๆ นี้",
    });
    setIsAnalyzing(false);
  };
  
  const getDocRef = (docId: string): FileRef | undefined => {
    // This is a simplified mapping. A more robust solution would be better.
    const keyMap: Record<string, keyof Manifest['docs']> = {
        'doc-citizen-id': 'citizenIdCopy',
        'doc-drivers-license': 'driverLicenseCopy',
        'doc-house-reg': 'houseRegCopy',
        'doc-car-reg': 'carRegCopy',
        'doc-bank-account': 'kbankBookFirstPage',
        'doc-tax-act': 'taxAndPRB',
        'doc-guarantor-citizen-id': 'guarantorCitizenIdCopy',
        'doc-guarantor-house-reg': 'guarantorHouseRegCopy',
    };
    const docKey = keyMap[docId];
    if (!docKey) return undefined;
    // This doesn't handle array types like carPhotos or nested ones like insurance
    return application.docs[docKey] as FileRef | undefined;
  }

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
                  <CardTitle className="font-headline text-2xl">{applicantName || "ผู้สมัครไม่มีชื่อ"}</CardTitle>
                  <CardDescription>รหัสใบสมัคร: {application.appId}</CardDescription>
                </div>
                <Badge variant={statusVariantMap[application.status.verification]} className="capitalize text-base">{statusText[application.status.verification]}</Badge>
            </div>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader><CardTitle className="font-headline">ข้อมูลผู้สมัคร</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {renderDetail("ชื่อ-นามสกุล", application.applicant.fullName)}
            {renderDetail("เบอร์โทรศัพท์", application.applicant.phone)}
            {renderDetail("ที่อยู่", application.applicant.address)}
            {renderDetail("เลขบัตรประชาชน", application.applicant.nationalId)}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader><CardTitle className="font-headline">ข้อมูลยานพาหนะ</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {renderDetail("ยี่ห้อ", application.vehicle.brand)}
            {renderDetail("รุ่น", application.vehicle.model)}
            {renderDetail("ปี", application.vehicle.year)}
            {renderDetail("ป้ายทะเบียน", application.vehicle.plateNo)}
            {renderDetail("สี", application.vehicle.color)}
          </CardContent>
        </Card>
        
         {application.guarantor && (
            <Card>
            <CardHeader><CardTitle className="font-headline">ข้อมูลผู้ค้ำประกัน</CardTitle></CardHeader>
            <CardContent className="space-y-3">
                {renderDetail("ชื่อ-นามสกุล", application.guarantor.fullName)}
                {renderDetail("เบอร์โทรศัพท์", application.guarantor.phone)}
                {renderDetail("ที่อยู่", application.guarantor.address)}
            </CardContent>
            </Card>
         )}
        
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">ตรวจสอบเอกสาร</CardTitle>
            <CardDescription>เอกสารที่ผู้สมัครอัปโหลด</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {requiredDocumentsSchema.map((reqDoc) => {
               const docRef = getDocRef(reqDoc.id);
               const hasFile = !!docRef;

               return (
                <div key={reqDoc.id} className="border rounded-lg p-4 space-y-4">
                   <div className="flex items-center justify-between">
                      <h4 className="font-semibold">{reqDoc.type}</h4>
                      <div className={`flex items-center gap-2 text-sm font-medium ${hasFile ? 'text-blue-500' : 'text-muted-foreground'}`}>
                          {hasFile ? <FileIcon className="h-4 w-4" /> : <FileQuestion className="h-4 w-4" />}
                          <span>{hasFile ? 'มีไฟล์' : 'ไม่มีไฟล์'}</span>
                      </div>
                  </div>

                  {hasFile && (
                    <div className="flex flex-col md:flex-row gap-4">
                      {/* Placeholder for image/doc viewer */}
                      <div className="relative w-full md:w-1/3 aspect-video rounded-md overflow-hidden border bg-muted flex items-center justify-center">
                          <p className="text-xs text-muted-foreground">Viewer (TODO)</p>
                      </div>
                      <div className="flex-1 space-y-2">
                          <p className="text-xs text-muted-foreground break-all">R2 Key: {docRef.r2Key}</p>
                          <Textarea placeholder="เพิ่มบันทึกการตรวจสอบ..." />
                          <div className="flex gap-2 pt-2">
                              <Button size="sm" variant="success">อนุมัติเอกสาร</Button>
                              <Button size="sm" variant="destructive">ปฏิเสธเอกสาร</Button>
                          </div>
                      </div>
                    </div>
                  )}

                  {!hasFile && (
                     <div className="flex items-center justify-center p-6 bg-muted/50 rounded-md border-dashed border-2">
                         <div className="text-center text-muted-foreground">
                             <p className="font-medium">ยังไม่ได้อัปโหลดเอกสาร</p>
                         </div>
                     </div>
                  )}
                </div>
              )
            })}
          </CardContent>
           <CardFooter className="flex-col items-start gap-4">
                <div>
                    <h4 className="font-semibold">การดำเนินการกับใบสมัคร</h4>
                    <div className="flex gap-2 pt-2">
                        <Button variant="success">อนุมัติใบสมัคร</Button>
                        <Button variant="destructive">ปฏิเสธใบสมัคร</Button>
                    </div>
                </div>
              <Button onClick={handleAnalyze} disabled={isAnalyzing}>
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    กำลังวิเคราะห์...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    วิเคราะห์ความไม่สมบูรณ์ด้วย AI (เร็วๆนี้)
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
