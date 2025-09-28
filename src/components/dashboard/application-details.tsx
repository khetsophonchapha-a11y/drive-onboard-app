
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
  Loader2,
  Send,
  Pencil,
  X,
  UploadCloud,
  Trash2,
} from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ManifestSchema, FileRefSchema } from "@/lib/types";
import * as z from 'zod';

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
import { Separator } from "../ui/separator";

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

async function safeFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
    const response = await fetch(input, init);
    if (!response.ok) {
        let errorMessage = `Request failed with status ${response.status} (${response.statusText})`;
        try {
            const errorBody = await response.json();
            if (errorBody.error) {
                 errorMessage += `: ${errorBody.error}`
            }
        } catch (e) {
            // response body is not json, just use status text
        }
        throw new Error(errorMessage);
    }
    return response;
}

async function md5Base64(file: File) {
  const SparkMD5 = (await import('spark-md5')).default;
  const buf = await file.arrayBuffer();
  const hash = new SparkMD5.ArrayBuffer().append(buf).end();
  const bin = hash.match(/.{2}/g)!.map(h => String.fromCharCode(parseInt(h, 16))).join("");
  return btoa(bin);
}

// A new component to manage each document group
function DocumentGroup({
    docSchema,
    isEditMode,
    onFileUpload,
    onFileDelete,
    onFileReplace,
    files = []
}: {
    docSchema: typeof requiredDocumentsSchema[0];
    isEditMode: boolean;
    onFileUpload: (docId: string, file: File) => void;
    onFileDelete: (docId: string, r2Key: string) => void;
    onFileReplace: (docId: string, file: File, oldR2Key: string) => void;
    files: FileRef[];
}) {
    const hasFile = files.length > 0;
    const allowMultiple = docSchema.id === 'doc-car-photo';

    return (
        <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="font-semibold">{docSchema.type}</h4>
                <div className={`flex items-center gap-2 text-sm font-medium ${hasFile ? 'text-blue-500' : 'text-muted-foreground'}`}>
                    {hasFile ? <FileIcon className="h-4 w-4" /> : <FileQuestion className="h-4 w-4" />}
                    <span>{hasFile ? `มี ${files.length} ไฟล์` : 'ไม่มีไฟล์'}</span>
                </div>
            </div>

            {hasFile ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {files.map((docRef) => (
                        <div key={docRef.r2Key} className="flex flex-col gap-2">
                            <div className="relative w-full aspect-video rounded-md overflow-hidden border bg-muted">
                                <DocumentViewer fileRef={docRef} />
                            </div>
                            {isEditMode && (
                                <div className="flex gap-2 pt-1 justify-end">
                                    {!allowMultiple && (
                                        <Button asChild size="sm" variant="outline" type="button">
                                             <label className="cursor-pointer">
                                                <Pencil className="h-4 w-4 mr-1" /> เปลี่ยนไฟล์
                                                <Input
                                                    type="file"
                                                    className="hidden"
                                                    accept="image/jpeg,image/png,application/pdf"
                                                    onChange={(e) => {
                                                        if (e.target.files?.[0]) {
                                                            onFileReplace(docSchema.id, e.target.files[0], docRef.r2Key);
                                                            e.target.value = '';
                                                        }
                                                    }}
                                                />
                                            </label>
                                        </Button>
                                    )}
                                    <Button size="sm" variant="destructive" type="button" onClick={() => onFileDelete(docSchema.id, docRef.r2Key)}>
                                        <Trash2 className="h-4 w-4 mr-1" /> ลบ
                                    </Button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : null}

            {isEditMode && (allowMultiple || !hasFile) && (
                 <div className={`flex items-center justify-center p-6 bg-muted/50 rounded-md border-dashed border-2 ${hasFile ? 'mt-4' : ''}`}>
                     <div className="text-center text-muted-foreground">
                         <p className="font-medium">{hasFile ? 'อัปโหลดไฟล์เพิ่มเติม' : 'ยังไม่ได้อัปโหลดเอกสาร'}</p>
                        <Button asChild size="sm" variant="outline" className="mt-2" type="button">
                            <label className="cursor-pointer">
                                <UploadCloud className="mr-2 h-4 w-4" />
                                อัปโหลด
                                <Input
                                    type="file"
                                    className="hidden"
                                    accept="image/jpeg,image/png,application/pdf"
                                    onChange={(e) => {
                                        if (e.target.files?.[0]) {
                                            onFileUpload(docSchema.id, e.target.files[0]);
                                            e.target.value = ''; // Reset input to allow re-uploading same file
                                        }
                                    }}
                                />
                            </label>
                        </Button>
                     </div>
                 </div>
            )}
        </div>
    );
}


export function ApplicationDetails({ application: initialApplication }: ApplicationDetailsProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editLinkCopied, setEditLinkCopied] = useState(false);
  const applicantName = initialApplication.applicant.fullName;
  const { toast } = useToast();

  const form = useForm<Manifest>({
    resolver: zodResolver(ManifestSchema),
    defaultValues: initialApplication,
  });

  const {
    handleSubmit,
    control,
    reset,
    setValue,
    getValues,
    formState: { isDirty },
  } = form;

  const handleEditToggle = () => {
    if (isEditMode) {
      reset(initialApplication); // Reset form to initial values if canceling edit
    }
    setIsEditMode(!isEditMode);
  };
  
  const uploadAndGetRef = async (docId: string, file: File): Promise<FileRef> => {
     const docSchema = requiredDocumentsSchema.find(d => d.id === docId);
     if (!docSchema) throw new Error("Document schema not found");

     toast({ title: 'กำลังอัปโหลด...', description: file.name });
     
     try {
         const md5 = await md5Base64(file);
         
         const signResponse = await safeFetch('/api/r2/sign-put-applicant', {
             method: 'POST', headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
                 applicationId: initialApplication.appId, docType: docSchema.type, fileName: file.name,
                 mime: file.type, size: file.size, md5,
             }),
         });
         const { url, key } = await signResponse.json();

         await safeFetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type, 'Content-MD5': md5 } });
         
         const newFileRef: FileRef = { r2Key: key, mime: file.type, size: file.size, md5 };
         toast({ title: 'อัปโหลดไฟล์สำเร็จ!', description: file.name, variant: 'default' });

         return newFileRef;

     } catch (error: any) {
          toast({ variant: 'destructive', title: 'อัปโหลดล้มเหลว', description: error.message });
          throw error; // re-throw to be caught by caller
     }
  }
  
  const updateDocsState = (docId: string, fileRef: FileRef | FileRef[] | undefined) => {
       switch (docId) {
            case 'doc-car-photo':
                setValue('docs.carPhotos', fileRef as FileRef[] | undefined, { shouldDirty: true });
                break;
            case 'doc-insurance':
                 setValue('docs.insurance.policy', fileRef as FileRef | undefined, { shouldDirty: true });
                 break;
            case 'doc-citizen-id':
                setValue('docs.citizenIdCopy', fileRef as FileRef | undefined, { shouldDirty: true });
                break;
            case 'doc-drivers-license':
                setValue('docs.driverLicenseCopy', fileRef as FileRef | undefined, { shouldDirty: true });
                break;
            case 'doc-house-reg':
                setValue('docs.houseRegCopy', fileRef as FileRef | undefined, { shouldDirty: true });
                break;
            case 'doc-car-reg':
                setValue('docs.carRegCopy', fileRef as FileRef | undefined, { shouldDirty: true });
                break;
            case 'doc-bank-account':
                setValue('docs.kbankBookFirstPage', fileRef as FileRef | undefined, { shouldDirty: true });
                break;
            case 'doc-tax-act':
                setValue('docs.taxAndPRB', fileRef as FileRef | undefined, { shouldDirty: true });
                break;
            case 'doc-guarantor-citizen-id':
                setValue('docs.guarantorCitizenIdCopy', fileRef as FileRef | undefined, { shouldDirty: true });
                break;
            case 'doc-guarantor-house-reg':
                setValue('docs.guarantorHouseRegCopy', fileRef as FileRef | undefined, { shouldDirty: true });
                break;
        }
  }


  const handleFileUpload = async (docId: string, file: File) => {
        try {
            const newFileRef = await uploadAndGetRef(docId, file);
            if (docId === 'doc-car-photo') {
                const currentPhotos = getValues('docs.carPhotos') || [];
                updateDocsState(docId, [...currentPhotos, newFileRef]);
            } else {
                updateDocsState(docId, newFileRef);
            }
        } catch (error) {
            console.error("File upload process failed", error);
        }
    };
    
  const handleFileReplace = async (docId: string, file: File, oldR2Key: string) => {
        // For single-file docs, replacing is just a delete and upload
        handleFileDelete(docId, oldR2Key);
        await handleFileUpload(docId, file);
    };


    const handleFileDelete = (docId: string, r2Key: string) => {
        if (docId === 'doc-car-photo') {
            const currentPhotos = getValues('docs.carPhotos') || [];
            updateDocsState(docId, currentPhotos.filter(p => p.r2Key !== r2Key));
        } else {
            updateDocsState(docId, undefined);
        }
        toast({ title: 'ลบไฟล์สำเร็จ', description: 'การเปลี่ยนแปลงจะถูกบันทึกเมื่อคุณกดปุ่ม "บันทึกการเปลี่ยนแปลง"' });
    };


  const onSubmit = async (values: Manifest) => {
      setIsSubmitting(true);
      try {
        await safeFetch('/api/applications/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appId: values.appId, manifest: values })
        });
        toast({ title: "บันทึกข้อมูลสำเร็จ!", description: "ข้อมูลใบสมัครได้รับการอัปเดตแล้ว", variant: "default" });
        setIsEditMode(false); // Exit edit mode on successful submission
        reset(values); // Update the form's default values to the new state

      } catch (error: any) {
        toast({
            variant: "destructive",
            title: "บันทึกข้อมูลล้มเหลว",
            description: error.message || "เกิดข้อผิดพลาดบางอย่าง กรุณาลองใหม่อีกครั้ง",
        });
      } finally {
        setIsSubmitting(false);
      }
  };


  const editLink = `${window.location.origin}/apply?appId=${initialApplication.appId}`;


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
    const docs = form.watch('docs'); // Watch for changes
    if (!docs) return [];
    
    switch (docId) {
      case 'doc-car-photo':
        return docs.carPhotos || [];
      case 'doc-insurance':
        return docs.insurance?.policy ? [docs.insurance.policy] : [];
      case 'doc-citizen-id':
        return docs.citizenIdCopy ? [docs.citizenIdCopy] : [];
      case 'doc-drivers-license':
        return docs.driverLicenseCopy ? [docs.driverLicenseCopy] : [];
      case 'doc-house-reg':
        return docs.houseRegCopy ? [docs.houseRegCopy] : [];
      case 'doc-car-reg':
        return docs.carRegCopy ? [docs.carRegCopy] : [];
      case 'doc-bank-account':
        return docs.kbankBookFirstPage ? [docs.kbankBookFirstPage] : [];
      case 'doc-tax-act':
        return docs.taxAndPRB ? [docs.taxAndPRB] : [];
      case 'doc-guarantor-citizen-id':
        return docs.guarantorCitizenIdCopy ? [docs.guarantorCitizenIdCopy] : [];
      case 'doc-guarantor-house-reg':
        return docs.guarantorHouseRegCopy ? [docs.guarantorHouseRegCopy] : [];
      default:
        return [];
    }
  }
  
  return (
    <Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="font-headline text-2xl">{applicantName || "ผู้สมัครไม่มีชื่อ"}</CardTitle>
                  <CardDescription>รหัสใบสมัคร: {initialApplication.appId}</CardDescription>
                </div>
                 <div className="flex items-center gap-4">
                    <Badge variant={statusVariantMap[initialApplication.status.verification]} className="capitalize text-base h-8">{statusText[initialApplication.status.verification]}</Badge>
                    <Button type="button" size="icon" variant={isEditMode ? "destructive" : "outline"} onClick={handleEditToggle} className="h-8 w-8">
                      {isEditMode ? <X /> : <Pencil />}
                      <span className="sr-only">{isEditMode ? "Cancel Edit" : "Edit Application"}</span>
                    </Button>
                </div>
            </div>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader><CardTitle className="font-headline">ข้อมูลผู้สมัคร</CardTitle></CardHeader>
          <CardContent className="space-y-4">
             <div className="grid md:grid-cols-2 gap-4">
                <FormField control={control} name="applicant.fullName" render={({ field }) => (
                  <FormItem><FormLabel>ชื่อ-นามสกุล</FormLabel><FormControl><Input {...field} readOnly={!isEditMode} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={control} name="applicant.phone" render={({ field }) => (
                  <FormItem><FormLabel>เบอร์โทรศัพท์</FormLabel><FormControl><Input {...field} readOnly={!isEditMode} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={control} name="applicant.nationalId" render={({ field }) => (
                  <FormItem><FormLabel>เลขบัตรประชาชน</FormLabel><FormControl><Input {...field} value={field.value || ''} readOnly={!isEditMode} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={control} name="applicant.address" render={({ field }) => (
                  <FormItem className="md:col-span-2"><FormLabel>ที่อยู่</FormLabel><FormControl><Input {...field} value={field.value || ''} readOnly={!isEditMode} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader><CardTitle className="font-headline">ข้อมูลยานพาหนะ</CardTitle></CardHeader>
          <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                 <FormField control={control} name="vehicle.brand" render={({ field }) => (
                    <FormItem><FormLabel>ยี่ห้อ</FormLabel><FormControl><Input {...field} value={field.value || ''} readOnly={!isEditMode} /></FormControl><FormMessage /></FormItem>
                 )} />
                 <FormField control={control} name="vehicle.model" render={({ field }) => (
                    <FormItem><FormLabel>รุ่น</FormLabel><FormControl><Input {...field} value={field.value || ''} readOnly={!isEditMode} /></FormControl><FormMessage /></FormItem>
                 )} />
                  <FormField control={control} name="vehicle.year" render={({ field }) => (
                    <FormItem><FormLabel>ปี</FormLabel><FormControl><Input type="number" {...field} value={field.value || ''} onChange={e => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value, 10))} readOnly={!isEditMode} /></FormControl><FormMessage /></FormItem>
                 )} />
                 <FormField control={control} name="vehicle.plateNo" render={({ field }) => (
                    <FormItem><FormLabel>ป้ายทะเบียน</FormLabel><FormControl><Input {...field} value={field.value || ''} readOnly={!isEditMode} /></FormControl><FormMessage /></FormItem>
                 )} />
                 <FormField control={control} name="vehicle.color" render={({ field }) => (
                    <FormItem><FormLabel>สี</FormLabel><FormControl><Input {...field} value={field.value || ''} readOnly={!isEditMode} /></FormControl><FormMessage /></FormItem>
                 )} />
              </div>
          </CardContent>
        </Card>
        
         
        <Card>
        <CardHeader><CardTitle className="font-headline">ข้อมูลผู้ค้ำประกัน</CardTitle></CardHeader>
        <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
                <FormField control={control} name="guarantor.fullName" render={({ field }) => (
                  <FormItem><FormLabel>ชื่อ-นามสกุล (ผู้ค้ำ)</FormLabel><FormControl><Input {...field} value={field.value || ''} readOnly={!isEditMode} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={control} name="guarantor.phone" render={({ field }) => (
                  <FormItem><FormLabel>เบอร์โทรศัพท์ (ผู้ค้ำ)</FormLabel><FormControl><Input {...field} value={field.value || ''} readOnly={!isEditMode} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={control} name="guarantor.address" render={({ field }) => (
                  <FormItem className="md:col-span-2"><FormLabel>ที่อยู่ (ผู้ค้ำ)</FormLabel><FormControl><Input {...field} value={field.value || ''} readOnly={!isEditMode} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
        </CardContent>
        </Card>
         
        
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">ตรวจสอบเอกสาร</CardTitle>
            <CardDescription>เอกสารที่ผู้สมัครอัปโหลด</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {requiredDocumentsSchema.map((reqDoc) => (
                <DocumentGroup
                    key={reqDoc.id}
                    docSchema={reqDoc}
                    isEditMode={isEditMode}
                    files={getDocRefs(reqDoc.id)}
                    onFileUpload={handleFileUpload}
                    onFileDelete={handleFileDelete}
                    onFileReplace={handleFileReplace}
                />
            ))}
          </CardContent>
           <CardFooter className="flex-col items-start gap-4">
                <div className="w-full space-y-4">
                    <Separator />
                     <div className="flex justify-between items-center w-full">
                        <h4 className="font-semibold">การดำเนินการ</h4>
                        <div className="flex gap-2">
                            <Button variant="success">อนุมัติใบสมัคร</Button>
                            <Button variant="destructive">ปฏิเสธใบสมัคร</Button>
                        </div>
                    </div>
                    <Separator />
                    <div className="w-full">
                       <h4 className="font-semibold">ให้ผู้สมัครแก้ไข</h4>
                        <p className="text-sm text-muted-foreground">ส่งลิงก์ให้ผู้สมัครเพื่อกลับมาอัปโหลดเอกสารหรือแก้ไขข้อมูล</p>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" className="mt-2" type="button">
                              <LinkIcon className="mr-2 h-4 w-4" />
                              แสดงลิงก์สำหรับแก้ไข
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
        {isEditMode && isDirty && (
            <div className="flex justify-end gap-2 sticky bottom-4">
                <Button type="submit" size="lg" disabled={isSubmitting} className="min-w-[150px]">
                {isSubmitting ? (
                    <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    กำลังบันทึก...
                    </>
                ) : (
                    <>
                    <Send className="mr-2 h-4 w-4" />
                    บันทึกการเปลี่ยนแปลง
                    </>
                )}
                </Button>
            </div>
        )}
      </div>
      </form>
    </Form>
  );
}

    