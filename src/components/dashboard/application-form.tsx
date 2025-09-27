
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

const applicantSchema = z.object({
  firstName: z.string().min(1, "กรุณากรอกชื่อจริง"),
  lastName: z.string().min(1, "กรุณากรอกนามสกุล"),
  email: z.string().email("รูปแบบอีเมลไม่ถูกต้อง"),
  phone: z.string().min(1, "กรุณากรอกเบอร์โทรศัพท์"),
  address: z.string().min(1, "กรุณากรอกที่อยู่"),
  dateOfBirth: z.string().min(1, "กรุณากรอกวันเกิด"),
});

const vehicleSchema = z.object({
  make: z.string().min(1, "กรุณากรอกยี่ห้อรถ"),
  model: z.string().min(1, "กรุณากรอกรุ่นรถ"),
  year: z.coerce.number().min(1900, "ปีไม่ถูกต้อง").max(new Date().getFullYear() + 1, "ปีไม่ถูกต้อง"),
  licensePlate: z.string().min(1, "กรุณากรอกป้ายทะเบียน"),
  vin: z.string().min(1, "กรุณากรอกเลขตัวถัง"),
});

const guarantorSchema = z.object({
    fullName: z.string().min(1, "กรุณากรอกชื่อ-นามสกุลผู้ค้ำ"),
    phone: z.string().min(1, "กรุณากรอกเบอร์โทรศัพท์ผู้ค้ำ"),
    email: z.string().email("รูปแบบอีเมลไม่ถูกต้อง").optional().or(z.literal('')),
    address: z.string().optional(),
});

const documentUploadSchema = z.object({
  status: z.enum(['pending', 'uploading', 'success', 'error']),
  progress: z.number(),
  file: z.any().optional(),
  r2Key: z.string().optional(),
  fileName: z.string().optional(),
  errorMessage: z.string().optional(),
});

const documentSchema = z.object({
    id: z.string(),
    type: z.string(),
    upload: documentUploadSchema,
});

const formSchema = z.object({
    applicant: applicantSchema,
    vehicle: vehicleSchema,
    guarantor: guarantorSchema,
    documents: z.array(documentSchema),
});

type UploadState = z.infer<typeof documentUploadSchema>;

export function ApplicationForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      applicant: { firstName: "", lastName: "", email: "", phone: "", address: "", dateOfBirth: "" },
      vehicle: { make: "", model: "", year: undefined, licensePlate: "", vin: "" },
      guarantor: { fullName: "", phone: "", email: "", address: "" },
      documents: requiredDocumentsSchema.map(doc => ({ 
        ...doc, 
        upload: { status: 'pending', progress: 0, file: null } 
      }))
    },
  });
  
  const { fields: documentFields, update: updateDocument } = useFieldArray({
    control: form.control,
    name: "documents"
  });

  const handleFileChange = async (file: File | null, index: number) => {
    if (!file) return;

    const currentDocument = form.getValues(`documents.${index}`);
    const applicationId = 'temp-' + Date.now(); // In a real app, you'd get this after saving a draft.

    updateDocument(index, { 
        ...currentDocument, 
        upload: { status: 'uploading', progress: 5, file: file, errorMessage: undefined }
    });

    try {
      // 1. Get pre-signed URL
      updateDocument(index, { ...currentDocument, upload: { ...currentDocument.upload, status: 'uploading', progress: 20 }});
      const signResponse = await fetch('/api/r2/sign-put-applicant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: applicationId,
          docType: currentDocument.type,
          fileName: file.name,
          mime: file.type,
          size: file.size,
        }),
      });

      if (!signResponse.ok) {
        throw new Error('ไม่สามารถขอ URL สำหรับอัปโหลดได้');
      }
      const { url, key } = await signResponse.json();
      updateDocument(index, { ...currentDocument, upload: { ...currentDocument.upload, status: 'uploading', progress: 40 }});

      // 2. Upload file to R2
      const uploadResponse = await fetch(url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      if (!uploadResponse.ok) {
        throw new Error('การอัปโหลดไฟล์ล้มเหลว');
      }
      updateDocument(index, { ...currentDocument, upload: { ...currentDocument.upload, status: 'uploading', progress: 100 }});


      // 3. Mark as success
      updateDocument(index, { 
          ...currentDocument, 
          upload: { 
              status: 'success', 
              progress: 100, 
              file: file,
              r2Key: key,
              fileName: file.name,
              errorMessage: undefined 
          }
      });

    } catch (error: any) {
      updateDocument(index, { 
          ...currentDocument, 
          upload: { 
              status: 'error', 
              progress: 0, 
              file: file,
              errorMessage: error.message || 'เกิดข้อผิดพลาดที่ไม่รู้จัก'
          }
      });
    }
  };

  const removeFile = (index: number) => {
    const currentDocument = form.getValues(`documents.${index}`);
    updateDocument(index, { ...currentDocument, upload: { status: 'pending', progress: 0, file: null, r2Key: undefined, fileName: undefined, errorMessage: undefined } });
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    
    // Filter for only successfully uploaded files
    const uploadedDocuments = values.documents
        .filter(doc => doc.upload.status === 'success' && doc.upload.r2Key)
        .map(doc => ({
            type: doc.type,
            r2Key: doc.upload.r2Key,
            fileName: doc.upload.fileName,
        }));
        
    const submissionData = {
        ...values,
        documents: uploadedDocuments
    }

    console.log("Form submission data:", submissionData);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));

    toast({
      title: "บันทึกใบสมัครสำเร็จ",
      description: `ใบสมัครสำหรับ ${values.applicant.firstName} ${values.applicant.lastName} ถูกสร้างเรียบร้อยแล้ว`,
      variant: "default"
    });
    
    setIsSubmitting(false);
    // In a real scenario, you might redirect to a "thank you" page
    // For now, redirecting to dashboard
    router.push("/dashboard");
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
                <FormField control={form.control} name="applicant.firstName" render={({ field }) => (
                  <FormItem><FormLabel>ชื่อจริง</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="applicant.lastName" render={({ field }) => (
                  <FormItem><FormLabel>นามสกุล</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="applicant.email" render={({ field }) => (
                  <FormItem><FormLabel>อีเมล</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="applicant.phone" render={({ field }) => (
                  <FormItem><FormLabel>เบอร์โทรศัพท์</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="applicant.dateOfBirth" render={({ field }) => (
                  <FormItem><FormLabel>วันเกิด</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="applicant.address" render={({ field }) => (
                  <FormItem className="md:col-span-2"><FormLabel>ที่อยู่</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </div>

            <Separator />

            {/* Vehicle Section */}
            <div className="space-y-4">
              <CardTitle className="font-headline">ข้อมูลยานพาหนะ</CardTitle>
              <div className="grid md:grid-cols-2 gap-4">
                <FormField control={form.control} name="vehicle.make" render={({ field }) => (
                  <FormItem><FormLabel>ยี่ห้อรถ</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="vehicle.model" render={({ field }) => (
                  <FormItem><FormLabel>รุ่นรถ</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="vehicle.year" render={({ field }) => (
                  <FormItem><FormLabel>ปีที่ผลิต</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="vehicle.licensePlate" render={({ field }) => (
                  <FormItem><FormLabel>ป้ายทะเบียน</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="vehicle.vin" render={({ field }) => (
                  <FormItem className="md:col-span-2"><FormLabel>เลขตัวถัง (VIN)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </div>

            <Separator />
            
            {/* Guarantor Section */}
            <div className="space-y-4">
              <CardTitle className="font-headline">ข้อมูลผู้ค้ำประกัน</CardTitle>
              <div className="grid md:grid-cols-2 gap-4">
                <FormField control={form.control} name="guarantor.fullName" render={({ field }) => (
                  <FormItem><FormLabel>ชื่อ-นามสกุล (ผู้ค้ำ)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="guarantor.phone" render={({ field }) => (
                  <FormItem><FormLabel>เบอร์โทรศัพท์ (ผู้ค้ำ)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="guarantor.email" render={({ field }) => (
                  <FormItem><FormLabel>อีเมล (ผู้ค้ำ) <span className="text-muted-foreground/80">(ถ้ามี)</span></FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="guarantor.address" render={({ field }) => (
                  <FormItem><FormLabel>ที่อยู่ (ผู้ค้ำ) <span className="text-muted-foreground/80">(ถ้ามี)</span></FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </div>
            
            <Separator />

            {/* Documents Section */}
            <div className="space-y-4">
              <CardTitle className="font-headline">อัปโหลดเอกสาร</CardTitle>
              <CardDescription>กรุณาเซ็นสำเนาถูกต้องและถ่ายรูปให้ชัดเจนก่อนส่ง (ขนาดไม่เกิน 15MB)</CardDescription>
              <div className="space-y-4 pt-2">
                {documentFields.map((field, index) => {
                  const uploadState = form.watch(`documents.${index}.upload`);
                  const isUploading = uploadState.status === 'uploading';
                  const isSuccess = uploadState.status === 'success';
                  const isError = uploadState.status === 'error';
                  const isPending = uploadState.status === 'pending';

                  return (
                  <div key={field.id} className="border rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex-1 w-full">
                      <div className="flex justify-between items-center">
                        <p className="font-medium">{field.type}</p>
                        {!isPending && !isUploading && (
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeFile(index)}>
                            <X className="w-4 h-4"/>
                          </Button>
                        )}
                      </div>
                      
                      {isPending && <p className="text-sm text-muted-foreground">ยังไม่ได้เลือกไฟล์</p>}

                      {isUploading && (
                        <div className="mt-2">
                          <Progress value={uploadState.progress} className="w-full h-2" />
                          <p className="text-sm text-muted-foreground mt-1">กำลังอัปโหลด... {uploadState.progress}%</p>
                        </div>
                      )}
                      
                      {isSuccess && (
                        <div className="flex items-center gap-2 text-sm text-green-600 mt-1">
                          <FileCheck className="w-4 h-4" />
                          <span className="truncate max-w-xs">{uploadState.fileName}</span>
                        </div>
                      )}

                      {isError && (
                        <div className="flex items-center gap-2 text-sm text-destructive mt-1">
                          <AlertCircle className="w-4 h-4" />
                          <span className="truncate max-w-xs">{uploadState.errorMessage}</span>
                        </div>
                      )}
                    </div>
                    
                    <FormField
                      control={form.control}
                      name={`documents.${index}.upload`}
                      render={() => (
                        <FormItem>
                          <FormControl>
                            <Button asChild variant="outline" disabled={isUploading}>
                              <label className="cursor-pointer">
                                {isSuccess || isError ? <X className="mr-2 h-4 w-4" /> : <FileUp className="mr-2 h-4 w-4" />}
                                {isSuccess ? 'เปลี่ยนไฟล์' : isError ? 'ลองใหม่' : 'เลือกไฟล์'}
                                <Input
                                  type="file"
                                  className="hidden"
                                  accept="image/jpeg,image/png,application/pdf"
                                  onChange={(e) => handleFileChange(e.target.files?.[0] ?? null, index)}
                                  disabled={isUploading}
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
          <CardFooter className="flex justify-end">
            <Button type="submit" size="lg" disabled={isSubmitting || documentFields.some(f => f.upload.status === 'uploading')}>
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
