
"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { requiredDocumentsSchema } from "@/lib/schema";
import { FileUp, FileCheck, X, Send, Loader2, AlertCircle, Download, CalendarIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import type { Manifest, FileRef } from "@/lib/types";
import { ManifestSchema } from "@/lib/types";

// Helper for safer fetching with better error messages
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

const documentUploadSchema = z.object({
  status: z.enum(['pending', 'selected', 'uploading', 'success', 'error']),
  progress: z.number(),
  file: z.instanceof(File).nullable(),
  r2Key: z.string().optional(),
  fileName: z.string().optional(),
  errorMessage: z.string().optional(),
});

const documentSchema = z.object({
    id: z.string(),
    type: z.string(),
    required: z.boolean(),
    upload: documentUploadSchema,
});

// We create a new schema for the form by picking only the fields we need
const ApplicationFormSchema = ManifestSchema.pick({
    applicant: true,
    applicationDetails: true,
    guarantor: true,
}).extend({
    documents: z.array(documentSchema)
      .refine(
        (docs) => docs.filter(d => d.required).every(doc => doc.upload.status === 'selected' || doc.upload.status === 'success'),
        {
          message: 'กรุณาอัปโหลดเอกสารที่จำเป็นให้ครบถ้วน',
        }
      ),
});


type FormValues = z.infer<typeof ApplicationFormSchema>;

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"];

const formTemplates = [
    { name: 'ใบสมัครงาน', filename: 'application-form.pdf' },
    { name: 'หนังสือสัญญาจ้างขนส่งสินค้า', filename: 'transport-contract.pdf' },
    { name: 'สัญญาค้ำประกันบุคคลเข้าทำงาน', filename: 'guarantee-contract.pdf' },
];

export function ApplicationForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState(0);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(ApplicationFormSchema),
    defaultValues: {
      applicant: {
        isPermanentAddressSame: false,
      },
      applicationDetails: {
        applicationDate: new Date(),
      },
      documents: requiredDocumentsSchema.map(doc => ({
        ...doc,
        upload: { status: 'pending', progress: 0, file: null }
      }))
    },
    mode: "onChange",
  });

  const { fields: documentFields, update: updateDocument } = useFieldArray({
    control: form.control,
    name: "documents"
  });

  const watchIsPermanentAddressSame = form.watch('applicant.isPermanentAddressSame');

  useEffect(() => {
    if(watchIsPermanentAddressSame) {
      const currentAddress = form.getValues('applicant.currentAddress');
      form.setValue('applicant.permanentAddress', currentAddress);
    }
  }, [watchIsPermanentAddressSame, form]);
  
  const handleFileChange = (file: File | null, index: number) => {
    if (!file) return;
    const currentDocument = form.getValues(`documents.${index}`);
    
    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
        toast({ variant: "destructive", title: "ประเภทไฟล์ไม่ถูกต้อง", description: "รองรับเฉพาะไฟล์ JPG, PNG, และ PDF เท่านั้น" });
        return;
    }

    if (file.type.startsWith('image/') && file.size > MAX_IMAGE_SIZE) {
        toast({ variant: "destructive", title: "ไฟล์รูปภาพมีขนาดใหญ่เกินไป", description: "ขนาดไฟล์รูปภาพต้องไม่เกิน 2MB" });
        return;
    }

    if (file.type === 'application/pdf' && file.size > MAX_PDF_SIZE) {
        toast({ variant: "destructive", title: "ไฟล์ PDF มีขนาดใหญ่เกินไป", description: "ขนาดไฟล์ PDF ต้องไม่เกิน 10MB" });
        return;
    }

    updateDocument(index, {
        ...currentDocument,
        upload: { 
            status: 'selected', 
            progress: 0, 
            file: file, 
            fileName: file.name,
            errorMessage: undefined 
        }
    });
    form.trigger('documents');
  };

  const removeFile = (index: number) => {
    const currentDocument = form.getValues(`documents.${index}`);
    updateDocument(index, { 
        ...currentDocument, 
        upload: { 
            status: 'pending', 
            progress: 0, 
            file: null, 
            r2Key: undefined, 
            fileName: undefined, 
            errorMessage: undefined 
        } 
    });
     form.trigger('documents');
  };

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    setSubmissionProgress(0);
    const appId = `app-${Date.now()}`;
    
    try {
        const filesToUpload = values.documents.filter(doc => doc.upload.status === 'selected' && doc.upload.file);
        const totalUploads = filesToUpload.length;
        let uploadedCount = 0;

        const uploadPromises = filesToUpload.map(async (doc) => {
             const file = doc.upload.file!;
             const docIndexInForm = values.documents.findIndex(d => d.id === doc.id);

             try {
                updateDocument(docIndexInForm, { ...doc, upload: { ...doc.upload, status: 'uploading', progress: 10 } });
                const md5 = await md5Base64(file);
                updateDocument(docIndexInForm, { ...doc, upload: { ...doc.upload, progress: 20 } });
                
                const signResponse = await safeFetch('/api/r2/sign-put-applicant', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        applicationId: appId, docType: doc.type, fileName: file.name,
                        mime: file.type, size: file.size, md5,
                    }),
                });
                const { url, key } = await signResponse.json();

                updateDocument(docIndexInForm, { ...doc, upload: { ...doc.upload, progress: 40 } });
                await safeFetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type, 'Content-MD5': md5 } });
                
                updateDocument(docIndexInForm, { ...doc, upload: { ...doc.upload, status: 'success', progress: 100, r2Key: key, file: null } });
                
                uploadedCount++;
                setSubmissionProgress((uploadedCount / totalUploads) * 80);
                
                return { docType: doc.type, docId: doc.id, r2Key: key, mime: file.type, size: file.size, md5 };

             } catch (uploadError: any) {
                console.error(`Upload error for ${doc.type}:`, uploadError);
                updateDocument(docIndexInForm, { ...doc, upload: { ...doc.upload, status: 'error', errorMessage: uploadError.message } });
                throw new Error(`อัปโหลดไฟล์ "${doc.type}" ล้มเหลว`);
             }
        });
        
        const uploadedFileRefs = await Promise.all(uploadPromises);

        setSubmissionProgress(90);

        const manifest: Manifest = {
            appId: appId,
            createdAt: new Date().toISOString(),
            applicant: {
                ...values.applicant,
                fullName: `${values.applicant.firstName} ${values.applicant.lastName}`.trim(),
            },
            applicationDetails: values.applicationDetails,
            guarantor: {
                ...values.guarantor,
                 fullName: `${values.guarantor?.firstName || ''} ${values.guarantor?.lastName || ''}`.trim() || undefined
            },
            docs: uploadedFileRefs.reduce((acc, fileRef) => {
                const fileData: FileRef = { r2Key: fileRef.r2Key, mime: fileRef.mime, size: fileRef.size, md5: fileRef.md5 };

                switch (fileRef.docId) {
                    case 'doc-application-form': acc.applicationForm = fileData; break;
                    case 'doc-transport-contract': acc.transportContract = fileData; break;
                    case 'doc-guarantee-contract': acc.guaranteeContract = fileData; break;
                    case 'doc-citizen-id': acc.citizenIdCopy = fileData; break;
                    case 'doc-drivers-license': acc.driverLicenseCopy = fileData; break;
                    case 'doc-house-reg': acc.houseRegCopy = fileData; break;
                    case 'doc-car-reg': acc.carRegCopy = fileData; break;
                    case 'doc-bank-account': acc.kbankBookFirstPage = fileData; break;
                    case 'doc-tax-act': acc.taxAndPRB = fileData; break;
                    case 'doc-car-photo': acc.carPhoto = fileData; break;
                    case 'doc-insurance':
                        if (!acc.insurance) acc.insurance = {};
                        acc.insurance.policy = fileData;
                        break;
                    case 'doc-guarantor-citizen-id': acc.guarantorCitizenIdCopy = fileData; break;
                    case 'doc-guarantor-house-reg': acc.guarantorHouseRegCopy = fileData; break;
                }
                return acc;
            }, {} as Manifest['docs']),
            status: {
                completeness: 'complete',
                verification: 'pending',
            }
        };

        await safeFetch('/api/applications/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appId, manifest })
        });
        
        setSubmissionProgress(100);
        toast({ title: "ส่งใบสมัครสำเร็จ!", description: `รหัสใบสมัครของคุณคือ: ${appId}`, variant: "default" });
        router.push("/dashboard");

    } catch (error: any) {
        setIsSubmitting(false);
        setSubmissionProgress(0);
        toast({
            variant: "destructive",
            title: "ส่งใบสมัครล้มเหลว",
            description: error.message || "เกิดข้อผิดพลาดบางอย่าง กรุณาลองใหม่อีกครั้ง",
        });
    }
  };


  return (
    <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline">ข้อมูลผู้สมัคร</CardTitle>
                    <CardDescription>ข้อมูลส่วนตัวและข้อมูลที่ใช้ในการติดต่อ</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Personal Info */}
                    <div className="space-y-4 border-b pb-6">
                        <h4 className="text-md font-semibold">ข้อมูลส่วนตัว</h4>
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <FormField control={form.control} name="applicant.prefix" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>คำนำหน้าชื่อ<span className="text-destructive ml-1">*</span></FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="เลือกคำนำหน้า..." /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="นาย">นาย</SelectItem>
                                            <SelectItem value="นาง">นาง</SelectItem>
                                            <SelectItem value="นางสาว">นางสาว</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="applicant.firstName" render={({ field }) => (
                                <FormItem><FormLabel>ชื่อ<span className="text-destructive ml-1">*</span></FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="applicant.lastName" render={({ field }) => (
                                <FormItem><FormLabel>นามสกุล<span className="text-destructive ml-1">*</span></FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                             <FormField control={form.control} name="applicant.nickname" render={({ field }) => (
                                <FormItem><FormLabel>ชื่อเล่น</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                             <FormField control={form.control} name="applicant.nationalId" render={({ field }) => (
                                <FormItem><FormLabel>เลขที่บัตรประจำตัวประชาชน<span className="text-destructive ml-1">*</span></FormLabel><FormControl><Input {...field} maxLength={13} onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ''))} /></FormControl><FormMessage /></FormItem>
                            )} />
                             <FormField control={form.control} name="applicant.nationalIdIssueDate" render={({ field }) => (
                                <FormItem className="flex flex-col"><FormLabel>วันที่ออกบัตร</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>เลือกวันที่</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date() || date < new Date("1900-01-01")} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                            )} />
                             <FormField control={form.control} name="applicant.nationalIdExpiryDate" render={({ field }) => (
                                <FormItem className="flex flex-col"><FormLabel>วันที่บัตรหมดอายุ</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>เลือกวันที่</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                            )} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                             <FormField control={form.control} name="applicant.dateOfBirth" render={({ field }) => (
                                <FormItem className="flex flex-col"><FormLabel>วัน/เดือน/ปีเกิด<span className="text-destructive ml-1">*</span></FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>เลือกวันที่</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date() || date < new Date("1900-01-01")} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="applicant.age" render={({ field }) => (
                                <FormItem><FormLabel>อายุ</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="applicant.race" render={({ field }) => (
                                <FormItem><FormLabel>เชื้อชาติ</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="applicant.nationality" render={({ field }) => (
                                <FormItem><FormLabel>สัญชาติ</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="applicant.religion" render={({ field }) => (
                                <FormItem><FormLabel>ศาสนา</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                             <FormField control={form.control} name="applicant.height" render={({ field }) => (
                                <FormItem><FormLabel>ส่วนสูง (ซม.)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                              <FormField control={form.control} name="applicant.weight" render={({ field }) => (
                                <FormItem><FormLabel>น้ำหนัก (กก.)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <FormField control={form.control} name="applicant.gender" render={({ field }) => (
                                <FormItem className="space-y-3"><FormLabel>เพศ</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex items-center space-x-4"><FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="male" /></FormControl><FormLabel className="font-normal">ชาย</FormLabel></FormItem><FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="female" /></FormControl><FormLabel className="font-normal">หญิง</FormLabel></FormItem></RadioGroup></FormControl><FormMessage /></FormItem>
                             )} />
                             <FormField control={form.control} name="applicant.maritalStatus" render={({ field }) => (
                                <FormItem><FormLabel>สถานภาพ</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="เลือกสถานภาพ..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="single">โสด</SelectItem><SelectItem value="married">แต่งงาน</SelectItem><SelectItem value="widowed">หม้าย</SelectItem><SelectItem value="divorced">หย่าร้าง</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                             )} />
                        </div>
                    </div>
                    {/* Current Address */}
                    <div className="space-y-4 border-b pb-6">
                        <h4 className="text-md font-semibold">ที่อยู่ปัจจุบัน</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                           <FormField control={form.control} name="applicant.currentAddress.houseNo" render={({ field }) => (
                                <FormItem><FormLabel>บ้านเลขที่</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                           )} />
                             <FormField control={form.control} name="applicant.currentAddress.moo" render={({ field }) => (
                                <FormItem><FormLabel>หมู่ที่</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                           )} />
                             <FormField control={form.control} name="applicant.currentAddress.street" render={({ field }) => (
                                <FormItem><FormLabel>ถนน</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                           )} />
                            <FormField control={form.control} name="applicant.currentAddress.subDistrict" render={({ field }) => (
                                <FormItem><FormLabel>ตำบล/แขวง</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                           )} />
                            <FormField control={form.control} name="applicant.currentAddress.district" render={({ field }) => (
                                <FormItem><FormLabel>อำเภอ/เขต</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                           )} />
                           <FormField control={form.control} name="applicant.currentAddress.province" render={({ field }) => (
                                <FormItem><FormLabel>จังหวัด</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                           )} />
                           <FormField control={form.control} name="applicant.currentAddress.postalCode" render={({ field }) => (
                                <FormItem><FormLabel>รหัสไปรษณีย์</FormLabel><FormControl><Input {...field} maxLength={5} /></FormControl><FormMessage /></FormItem>
                           )} />
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <FormField control={form.control} name="applicant.homePhone" render={({ field }) => (
                                <FormItem><FormLabel>โทรศัพท์ (บ้าน)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="applicant.mobilePhone" render={({ field }) => (
                                <FormItem><FormLabel>มือถือ<span className="text-destructive ml-1">*</span></FormLabel><FormControl><Input {...field} maxLength={10} onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ''))} /></FormControl><FormMessage /></FormItem>
                            )} />
                             <FormField control={form.control} name="applicant.email" render={({ field }) => (
                                <FormItem><FormLabel>อีเมล์</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                         </div>
                    </div>
                     {/* Permanent Address */}
                    <div className="space-y-4">
                         <div className="flex items-center justify-between">
                            <h4 className="text-md font-semibold">ที่อยู่ตามทะเบียนบ้าน</h4>
                            <FormField control={form.control} name="applicant.isPermanentAddressSame" render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                <div className="space-y-1 leading-none"><FormLabel>ใช้ที่อยู่เดียวกับที่อยู่ปัจจุบัน</FormLabel></div>
                                </FormItem>
                            )} />
                         </div>
                        {!watchIsPermanentAddressSame && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <FormField control={form.control} name="applicant.permanentAddress.houseNo" render={({ field }) => ( <FormItem><FormLabel>บ้านเลขที่</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                                <FormField control={form.control} name="applicant.permanentAddress.moo" render={({ field }) => ( <FormItem><FormLabel>หมู่ที่</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                                <FormField control={form.control} name="applicant.permanentAddress.street" render={({ field }) => ( <FormItem><FormLabel>ถนน</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                                <FormField control={form.control} name="applicant.permanentAddress.subDistrict" render={({ field }) => ( <FormItem><FormLabel>ตำบล/แขวง</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                                <FormField control={form.control} name="applicant.permanentAddress.district" render={({ field }) => ( <FormItem><FormLabel>อำเภอ/เขต</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                                <FormField control={form.control} name="applicant.permanentAddress.province" render={({ field }) => ( <FormItem><FormLabel>จังหวัด</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                                <FormField control={form.control} name="applicant.permanentAddress.postalCode" render={({ field }) => ( <FormItem><FormLabel>รหัสไปรษณีย์</FormLabel><FormControl><Input {...field} maxLength={5} /></FormControl><FormMessage /></FormItem> )}/>
                            </div>
                        )}
                    </div>
                     {/* Other Info */}
                    <div className="space-y-4 pt-6">
                        <h4 className="text-md font-semibold">ข้อมูลอื่นๆ</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <FormField control={form.control} name="applicant.residenceType" render={({ field }) => (
                                <FormItem><FormLabel>ประเภทที่พักอาศัย</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="เลือกประเภท..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="own">บ้านตัวเอง</SelectItem><SelectItem value="rent">บ้านเช่า</SelectItem><SelectItem value="dorm">หอพัก</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="applicant.militaryStatus" render={({ field }) => (
                                <FormItem><FormLabel>ภาวะทางทหาร</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="เลือกสถานะ..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="exempt">ยกเว้น</SelectItem><SelectItem value="discharged">ปลดเป็นทหารกองหนุน</SelectItem><SelectItem value="not-drafted">ยังไม่ได้รับการเกณฑ์</SelectItem></SelectContent></Select><FormMessage /></FormItem>
                            )} />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                 <CardHeader>
                    <CardTitle className="font-headline">ข้อมูลการสมัครงาน</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <FormField control={form.control} name="applicationDetails.position" render={({ field }) => (
                            <FormItem><FormLabel>ตำแหน่งที่ต้องการสมัคร</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="applicationDetails.criminalRecord" render={({ field }) => (
                            <FormItem className="space-y-3"><FormLabel>เคยมีประวัติอาชญากรรมหรือไม่</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex items-center space-x-4"><FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="no" /></FormControl><FormLabel className="font-normal">ไม่เคย</FormLabel></FormItem><FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="yes" /></FormControl><FormLabel className="font-normal">เคย</FormLabel></FormItem></RadioGroup></FormControl><FormMessage /></FormItem>
                        )} />
                    </div>
                     <div className="space-y-4 border-t pt-6">
                        <h4 className="text-md font-semibold">บุคคลที่ติดต่อได้กรณีฉุกเฉิน</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <FormField control={form.control} name="applicationDetails.emergencyContact.firstName" render={({ field }) => (
                                <FormItem><FormLabel>ชื่อ</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="applicationDetails.emergencyContact.lastName" render={({ field }) => (
                                <FormItem><FormLabel>นามสกุล</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="applicationDetails.emergencyContact.relation" render={({ field }) => (
                                <FormItem><FormLabel>ความเกี่ยวข้อง</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                             <FormField control={form.control} name="applicationDetails.emergencyContact.occupation" render={({ field }) => (
                                <FormItem><FormLabel>อาชีพ</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="applicationDetails.emergencyContact.mobilePhone" render={({ field }) => (
                                <FormItem><FormLabel>มือถือ</FormLabel><FormControl><Input {...field} maxLength={10} onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ''))} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                     </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="font-headline">ข้อมูลผู้ค้ำประกัน (ถ้ามี)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <FormField control={form.control} name="guarantor.firstName" render={({ field }) => (
                        <FormItem><FormLabel>ชื่อจริง (ผู้ค้ำ)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="guarantor.lastName" render={({ field }) => (
                        <FormItem><FormLabel>นามสกุล (ผู้ค้ำ)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="guarantor.nationalId" render={({ field }) => (
                            <FormItem><FormLabel>เลขที่บัตรประจำตัวประชาชน (ผู้ค้ำ)</FormLabel><FormControl><Input {...field} maxLength={13} onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ''))} /></FormControl><FormMessage /></FormItem>
                        )} />
                    </div>
                    <div className="space-y-4 pt-4">
                         <h4 className="text-sm font-semibold">ที่อยู่ผู้ค้ำประกัน</h4>
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <FormField control={form.control} name="guarantor.address.houseNo" render={({ field }) => ( <FormItem><FormLabel>บ้านเลขที่</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                                <FormField control={form.control} name="guarantor.address.moo" render={({ field }) => ( <FormItem><FormLabel>หมู่ที่</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                                <FormField control={form.control} name="guarantor.address.street" render={({ field }) => ( <FormItem><FormLabel>ถนน</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                                <FormField control={form.control} name="guarantor.address.subDistrict" render={({ field }) => ( <FormItem><FormLabel>ตำบล/แขวง</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                                <FormField control={form.control} name="guarantor.address.district" render={({ field }) => ( <FormItem><FormLabel>อำเภอ/เขต</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                                <FormField control={form.control} name="guarantor.address.province" render={({ field }) => ( <FormItem><FormLabel>จังหวัด</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                                <FormField control={form.control} name="guarantor.address.postalCode" render={({ field }) => ( <FormItem><FormLabel>รหัสไปรษณีย์</FormLabel><FormControl><Input {...field} maxLength={5} /></FormControl><FormMessage /></FormItem> )}/>
                            </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="font-headline">อัปโหลดเอกสาร</CardTitle>
                    <CardDescription>กรุณาเซ็นสำเนาถูกต้องและถ่ายรูปให้ชัดเจนก่อนส่ง (JPG, PNG ไม่เกิน 2MB; PDF ไม่เกิน 10MB)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-4">
                        <FormDescription>
                            ดาวน์โหลดแบบฟอร์มเพื่อกรอกและเซ็นชื่อ จากนั้นอัปโหลดในส่วนถัดไป
                        </FormDescription>
                        <div className="grid sm:grid-cols-3 gap-4">
                            {formTemplates.map((template) => (
                                <a 
                                    key={template.name}
                                    href={`/api/download-form?filename=${template.filename}`}
                                    download={template.filename}
                                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
                                >
                                    <Download className="mr-2 h-4 w-4" />
                                    {template.name}
                                </a>
                            ))}
                        </div>
                        <Separator className="!my-6" />
                    </div>
                    <div className="space-y-4">
                        {documentFields.map((field, index) => {
                        const uploadState = form.watch(`documents.${index}.upload`);
                        return (
                        <div key={field.id} className="border rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex-1 w-full">
                            <div className="flex justify-between items-center">
                                <p className="font-medium">{field.type}{field.required && <span className="text-destructive ml-1">*</span>}</p>
                                {uploadState.status !== 'pending' && uploadState.status !== 'uploading' && (
                                <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeFile(index)}>
                                    <X className="w-4 h-4"/>
                                </Button>
                                )}
                            </div>

                            {uploadState.status === 'pending' && <p className="text-sm text-muted-foreground">ยังไม่ได้เลือกไฟล์</p>}
                            
                            {(uploadState.status === 'selected' || uploadState.status === 'success') && (
                                <div className="flex items-center gap-2 text-sm text-green-600 mt-1">
                                <FileCheck className="w-4 h-4" />
                                <span className="truncate max-w-xs">{uploadState.fileName}</span>
                                </div>
                            )}

                            {uploadState.status === 'uploading' && (
                                <div className="mt-2">
                                <Progress value={uploadState.progress} className="w-full h-2" />
                                <p className="text-sm text-muted-foreground mt-1">กำลังอัปโหลด... {uploadState.progress}%</p>
                                </div>
                            )}

                            {uploadState.status === 'error' && (
                                <div className="flex flex-col gap-1 text-sm text-destructive mt-1">
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                    <span className="font-semibold">การอัปโหลดล้มเหลว</span>
                                </div>
                                <p className="pl-6 text-xs break-all">{uploadState.errorMessage}</p>
                                </div>
                            )}
                            </div>

                            <FormField
                            control={form.control} name={`documents.${index}.upload`}
                            render={() => (
                                <FormItem>
                                <FormControl>
                                    <Button asChild variant="outline" disabled={uploadState.status === 'uploading' || isSubmitting}>
                                    <label className="cursor-pointer">
                                        {uploadState.status === 'selected' || uploadState.status === 'success' ? <X className="mr-2 h-4 w-4" /> : <FileUp className="mr-2 h-4 w-4" />}
                                        {uploadState.status === 'selected' || uploadState.status === 'success' ? 'เปลี่ยนไฟล์' : 'เลือกไฟล์'}
                                        <Input
                                        type="file" className="hidden"
                                        accept="image/jpeg,image/png,application/pdf"
                                        onChange={(e) => handleFileChange(e.target.files?.[0] ?? null, index)}
                                        disabled={uploadState.status === 'uploading' || isSubmitting}
                                        />
                                    </label>
                                    </Button>
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                        </div>
                        )})}
                    </div>
                    {form.formState.errors.documents && (
                            <p className="text-sm font-medium text-destructive">{form.formState.errors.documents.message}</p>
                        )}
                </CardContent>
                 <CardFooter className="flex-col items-end gap-4">
                    {isSubmitting && (
                        <div className="w-full text-center">
                            <Progress value={submissionProgress} className="w-full h-2 mb-2" />
                            <p className="text-sm text-muted-foreground">
                                {submissionProgress < 100 ? `กำลังส่งใบสมัคร... ${Math.round(submissionProgress)}%` : 'ส่งใบสมัครสำเร็จ!'}
                            </p>
                        </div>
                    )}
                    <Button type="submit" size="lg" disabled={isSubmitting || !form.formState.isValid}>
                    {isSubmitting ? (
                        <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        กำลังบันทึก...
                        </>
                    ) : (
                        <>
                        <Send className="mr-2 h-4 w-4" />
                        ส่งใบสมัคร
                        </>
                    )}
                    </Button>
                </CardFooter>
            </Card>
        </form>
    </Form>
  );
}
