
"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { requiredDocumentsSchema } from "@/lib/schema";
import { FileUp, FileCheck, X, Send, Loader2, AlertCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import type { Manifest, FileRef } from "@/lib/types";

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

const applicantSchema = z.object({
  fullName: z.string().min(1, "กรุณากรอกชื่อ-นามสกุล"),
  phone: z.string().min(1, "กรุณากรอกเบอร์โทรศัพท์"),
  address: z.string().optional(),
  nationalId: z.string().optional(),
});

const vehicleSchema = z.object({
  brand: z.string().optional(),
  model: z.string().optional(),
  year: z.coerce.number().optional(),
  plateNo: z.string().optional(),
  color: z.string().optional(),
});

const guarantorSchema = z.object({
    fullName: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
});

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

const formSchema = z.object({
    applicant: applicantSchema,
    vehicle: vehicleSchema,
    guarantor: guarantorSchema,
    documents: z.array(documentSchema)
      .refine(
        (docs) => docs.every(doc => !doc.required || doc.upload.status === 'selected' || doc.upload.status === 'success'),
        {
          message: 'กรุณาอัปโหลดเอกสารที่จำเป็นให้ครบถ้วน',
          // This path is not straightforward, so we'll handle showing a generic error in the UI if needed.
          // For now, disabling the button is the primary feedback.
        }
      ),
});

type FormValues = z.infer<typeof formSchema>;

export function ApplicationForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState(0);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      applicant: { fullName: "", phone: "", address: "", nationalId: "" },
      vehicle: { brand: "", model: "", plateNo: "", color: "" },
      guarantor: { fullName: "", phone: "", address: "" },
      documents: requiredDocumentsSchema.map(doc => ({
        ...doc,
        upload: { status: 'pending', progress: 0, file: null }
      }))
    },
    mode: "onChange", // Validate on change to enable/disable button
  });

  const { fields: documentFields, update: updateDocument } = useFieldArray({
    control: form.control,
    name: "documents"
  });

  const handleFileChange = (file: File | null, index: number) => {
    if (!file) return;
    const currentDocument = form.getValues(`documents.${index}`);
    
    // Validate file type and size on client-side first
    const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"];
    const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
        toast({ variant: "destructive", title: "ประเภทไฟล์ไม่ถูกต้อง", description: "รองรับเฉพาะไฟล์ JPG, PNG, และ PDF เท่านั้น" });
        return;
    }
    if (file.size > MAX_FILE_SIZE) {
        toast({ variant: "destructive", title: "ไฟล์มีขนาดใหญ่เกินไป", description: "ขนาดไฟล์ต้องไม่เกิน 15MB" });
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
    form.trigger('documents'); // Manually trigger validation for the documents array
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
     form.trigger('documents'); // Manually trigger validation for the documents array
  };

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    setSubmissionProgress(0);
    const appId = `app-${Date.now()}`;
    
    try {
        const filesToUpload = values.documents.filter(doc => doc.upload.status === 'selected' && doc.upload.file);
        const totalUploads = filesToUpload.length;
        let uploadedCount = 0;

        // Step 1: Upload all files in parallel
        const uploadPromises = filesToUpload.map(async (doc, index) => {
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
                setSubmissionProgress((uploadedCount / totalUploads) * 80); // 80% for uploads
                
                return { docType: doc.type, docId: doc.id, r2Key: key, mime: file.type, size: file.size, md5 };

             } catch (uploadError: any) {
                console.error(`Upload error for ${doc.type}:`, uploadError);
                updateDocument(docIndexInForm, { ...doc, upload: { ...doc.upload, status: 'error', errorMessage: uploadError.message } });
                throw new Error(`อัปโหลดไฟล์ "${doc.type}" ล้มเหลว`);
             }
        });
        
        const uploadedFileRefs = await Promise.all(uploadPromises);

        // Step 2: Build the manifest
        setSubmissionProgress(90); // 10% for manifest build

        const manifest: Manifest = {
            appId: appId,
            createdAt: new Date().toISOString(),
            applicant: values.applicant,
            vehicle: values.vehicle,
            guarantor: values.guarantor,
            docs: uploadedFileRefs.reduce((acc, fileRef) => {
                const fileData: FileRef = { r2Key: fileRef.r2Key, mime: fileRef.mime, size: fileRef.size, md5: fileRef.md5 };

                switch (fileRef.docId) {
                    case 'doc-citizen-id':
                        acc.citizenIdCopy = fileData;
                        break;
                    case 'doc-drivers-license':
                        acc.driverLicenseCopy = fileData;
                        break;
                    case 'doc-house-reg':
                        acc.houseRegCopy = fileData;
                        break;
                    case 'doc-car-reg':
                        acc.carRegCopy = fileData;
                        break;
                    case 'doc-bank-account':
                        acc.kbankBookFirstPage = fileData;
                        break;
                    case 'doc-tax-act':
                        acc.taxAndPRB = fileData;
                        break;
                    case 'doc-guarantor-citizen-id':
                        acc.guarantorCitizenIdCopy = fileData;
                        break;
                    case 'doc-guarantor-house-reg':
                        acc.guarantorHouseRegCopy = fileData;
                        break;
                    case 'doc-car-photo':
                        acc.carPhoto = fileData;
                        break;
                    case 'doc-insurance':
                        if (!acc.insurance) {
                           acc.insurance = {};
                        }
                        acc.insurance.policy = fileData;
                        break;
                }
                return acc;
            }, {} as Manifest['docs']),
            status: {
                completeness: 'complete', // Assuming all required docs are there
                verification: 'pending',
            }
        };

        // Step 3: Submit the manifest
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
    <Card>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="pt-6 space-y-8">
            {/* Applicant Section */}
            <div className="space-y-4">
              <CardTitle className="font-headline">ข้อมูลผู้สมัคร</CardTitle>
              <div className="grid md:grid-cols-2 gap-4">
                <FormField control={form.control} name="applicant.fullName" render={({ field }) => (
                  <FormItem><FormLabel>ชื่อ-นามสกุล<span className="text-destructive ml-1">*</span></FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="applicant.phone" render={({ field }) => (
                  <FormItem><FormLabel>เบอร์โทรศัพท์<span className="text-destructive ml-1">*</span></FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="applicant.nationalId" render={({ field }) => (
                  <FormItem><FormLabel>เลขบัตรประชาชน (ถ้ามี)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="applicant.address" render={({ field }) => (
                  <FormItem className="md:col-span-2"><FormLabel>ที่อยู่ (ถ้ามี)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </div>

            <Separator />

            {/* Vehicle Section */}
            <div className="space-y-4">
              <CardTitle className="font-headline">ข้อมูลยานพาหนะ (ถ้ามี)</CardTitle>
              <div className="grid md:grid-cols-2 gap-4">
                <FormField control={form.control} name="vehicle.brand" render={({ field }) => (
                  <FormItem><FormLabel>ยี่ห้อรถ</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="vehicle.model" render={({ field }) => (
                  <FormItem><FormLabel>รุ่นรถ</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="vehicle.year" render={({ field }) => (
                  <FormItem><FormLabel>ปีที่ผลิต</FormLabel><FormControl><Input type="number" {...field} value={field.value || ''} onChange={e => field.onChange(e.target.valueAsNumber || undefined)} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="vehicle.plateNo" render={({ field }) => (
                  <FormItem><FormLabel>ป้ายทะเบียน</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField control={form.control} name="vehicle.color" render={({ field }) => (
                  <FormItem><FormLabel>สีรถ</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </div>

            <Separator />

            {/* Guarantor Section */}
            <div className="space-y-4">
              <CardTitle className="font-headline">ข้อมูลผู้ค้ำประกัน (ถ้ามี)</CardTitle>
              <div className="grid md:grid-cols-2 gap-4">
                <FormField control={form.control} name="guarantor.fullName" render={({ field }) => (
                  <FormItem><FormLabel>ชื่อ-นามสกุล (ผู้ค้ำ)</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="guarantor.phone" render={({ field }) => (
                  <FormItem><FormLabel>เบอร์โทรศัพท์ (ผู้ค้ำ)</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="guarantor.address" render={({ field }) => (
                  <FormItem className="md:col-span-2"><FormLabel>ที่อยู่ (ผู้ค้ำ)</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </div>

            <Separator />

            {/* Documents Section */}
            <div className="space-y-4">
              <CardHeader className="p-0">
                <CardTitle className="font-headline">อัปโหลดเอกสาร</CardTitle>
                <CardDescription>กรุณาเซ็นสำเนาถูกต้องและถ่ายรูปให้ชัดเจนก่อนส่ง (JPG, PNG, PDF ขนาดไม่เกิน 15MB)</CardDescription>
              </CardHeader>
              <div className="space-y-4 pt-2">
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
                                {uploadState.status === 'pending' ? <FileUp className="mr-2 h-4 w-4" /> : <X className="mr-2 h-4 w-4" />}
                                {uploadState.status === 'pending' ? 'เลือกไฟล์' : 'เปลี่ยนไฟล์'}
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
            </div>

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
        </form>
      </Form>
    </Card>
  );
}

    