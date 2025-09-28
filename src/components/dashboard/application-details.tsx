
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
  FileQuestion,
  File as FileIcon,
  Copy,
  Link as LinkIcon,
  Check,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { requiredDocumentsSchema } from "@/lib/schema";
import { DocumentViewer } from "@/components/dashboard/document-viewer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";


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
  const [editLinkCopied, setEditLinkCopied] = useState(false);
  const applicantName = application.applicant.fullName;
  const { toast } = useToast();

  // In a real app, this would be a unique, secure URL.
  // For now, it just points to the application form page.
  const editLink = `${window.location.origin}/apply?appId=${application.appId}`;


  const handleCopyLink = () => {
    navigator.clipboard.writeText(editLink);
    setEditLinkCopied(true);
    toast({
      title: "คัดลอกลิงก์สำเร็จ",
      description: "คุณสามารถส่งลิงก์นี้ให้ผู้สมัครเพื่อแก้ไขข้อมูลได้",
    });
    setTimeout(() => setEditLinkCopied(false), 2000);
  };

  const getDocRefs = (docId: string): FileRef[] => {
    switch (docId) {
      case 'doc-car-photo':
        return application.docs.carPhotos || [];
      case 'doc-insurance':
        return application.docs.insurance?.policy ? [application.docs.insurance.policy] : [];
      case 'doc-citizen-id':
        return application.docs.citizenIdCopy ? [application.docs.citizenIdCopy] : [];
      case 'doc-drivers-license':
        return application.docs.driverLicenseCopy ? [application.docs.driverLicenseCopy] : [];
      case 'doc-house-reg':
        return application.docs.houseRegCopy ? [application.docs.houseRegCopy] : [];
      case 'doc-car-reg':
        return application.docs.carRegCopy ? [application.docs.carRegCopy] : [];
      case 'doc-bank-account':
        return application.docs.kbankBookFirstPage ? [application.docs.kbankBookFirstPage] : [];
      case 'doc-tax-act':
        return application.docs.taxAndPRB ? [application.docs.taxAndPRB] : [];
      case 'doc-guarantor-citizen-id':
        return application.docs.guarantorCitizenIdCopy ? [application.docs.guarantorCitizenIdCopy] : [];
      case 'doc-guarantor-house-reg':
        return application.docs.guarantorHouseRegCopy ? [application.docs.guarantorHouseRegCopy] : [];
      default:
        return [];
    }
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
               const docRefs = getDocRefs(reqDoc.id);
               const hasFile = docRefs.length > 0;

               return (
                <div key={reqDoc.id} className="border rounded-lg p-4 space-y-4">
                   <div className="flex items-center justify-between">
                      <h4 className="font-semibold">{reqDoc.type}</h4>
                      <div className={`flex items-center gap-2 text-sm font-medium ${hasFile ? 'text-blue-500' : 'text-muted-foreground'}`}>
                          {hasFile ? <FileIcon className="h-4 w-4" /> : <FileQuestion className="h-4 w-4" />}
                          <span>{hasFile ? `มี ${docRefs.length} ไฟล์` : 'ไม่มีไฟล์'}</span>
                      </div>
                  </div>

                  {hasFile ? (
                    docRefs.map((docRef, index) => (
                      <div key={docRef.r2Key} className="flex flex-col md:flex-row gap-4">
                        <div className="relative w-full md:w-1/3 aspect-video rounded-md overflow-hidden border bg-muted">
                          <DocumentViewer fileRef={docRef} />
                        </div>
                        <div className="flex-1 space-y-2">
                            <p className="text-xs text-muted-foreground break-all">R2 Key: {docRef.r2Key}</p>
                            <Textarea placeholder={`เพิ่มบันทึกการตรวจสอบสำหรับไฟล์ที่ ${index + 1}...`} />
                            <div className="flex gap-2 pt-2">
                                <Button size="sm" variant="success">อนุมัติเอกสาร</Button>
                                <Button size="sm" variant="destructive">ปฏิเสธเอกสาร</Button>
                            </div>
                        </div>
                      </div>
                    ))
                  ) : (
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
                <div className="w-full space-y-4">
                    <div>
                        <h4 className="font-semibold">การดำเนินการกับใบสมัคร</h4>
                        <div className="flex gap-2 pt-2">
                            <Button variant="success">อนุมัติใบสมัคร</Button>
                            <Button variant="destructive">ปฏิเสธใบสมัคร</Button>
                        </div>
                    </div>
                    <div className="border-t pt-4 w-full">
                       <h4 className="font-semibold">ให้ผู้สมัครแก้ไข</h4>
                        <p className="text-sm text-muted-foreground">ส่งลิงก์ให้ผู้สมัครเพื่อกลับมาอัปโหลดเอกสารหรือแก้ไขข้อมูล</p>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" className="mt-2">
                              <LinkIcon className="mr-2 h-4 w-4" />
                              ส่งลิงก์สำหรับแก้ไข
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                              <DialogTitle>ลิงก์สำหรับแก้ไขใบสมัคร</DialogTitle>
                              <DialogDescription>
                                ส่งลิงก์นี้ให้ผู้สมัครเพื่อทำการแก้ไขข้อมูลและอัปโหลดเอกสารใหม่
                              </DialogDescription>
                            </DialogHeader>
                            <div className="flex items-center space-x-2">
                              <div className="grid flex-1 gap-2">
                                <Input
                                  id="edit-link"
                                  defaultValue={editLink}
                                  readOnly
                                />
                              </div>
                              <Button type="button" size="sm" className="px-3" onClick={handleCopyLink}>
                                <span className="sr-only">Copy</span>
                                {editLinkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                              </Button>
                            </div>
                            <DialogFooter className="sm:justify-start">
                              <DialogClose asChild>
                                <Button type="button" variant="secondary">
                                  ปิด
                                </Button>
                              </DialogClose>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                    </div>
                </div>
           </CardFooter>
        </Card>
      </div>
    </>
  );
}

    