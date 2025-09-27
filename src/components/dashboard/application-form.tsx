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

async function md5Base64(file: File) {
  const SparkMD5 = (await import('spark-md5')).default;
  const buf = await file.arrayBuffer();
  const hash = new SparkMD5.ArrayBuffer().append(buf).end();
  const bin = hash.match(/.{2}/g)!.map(h => String.fromCharCode(parseInt(h, 16))).join("");
  return btoa(bin);
}

// Helper function for safer fetching with better error messages
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
    firstName: z.string().min(1, "กรุณากรอกชื่อจริงผู้ค้ำ"),
    lastName: z.string().min(1, "กรุณากรอกนามสกุลผู้ค้ำ"),
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

export function ApplicationForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      applicant: { firstName: "", lastName: "", email: "", phone: "", address: "", dateOfBirth: "" },
      vehicle: { make: "", model: "", year: undefined, licensePlate: "", vin: "" },
      guarantor: { firstName: "", lastName: "", phone: "", email: "", address: "" },
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
    // This is a temporary ID. A real application would likely save a draft
    // of the application first and get a persistent ID.
    const applicationId = 'temp-' + Date.now(); 

    updateDocument(index, {
        ...currentDocument,
        upload: { status: 'uploading', progress: 5, file: file, errorMessage: undefined }
    });

    let md5, key, url;

    try {
      // Step 1: Get a pre-signed URL from our API
      updateDocument(index, { ...form.getValues(`documents.${index}`), upload: { ...form.getValues(`documents.${index}.upload`), status: 'uploading', progress: 10 }});
      md5 = await md5Base64(file);
      
      updateDocument(index, { ...form.getValues(`documents.${index}`), upload: { ...form.getValues(`documents.${index}.upload`), status: 'uploading', progress: 20 }});
      
      const signResponse = await safeFetch('/api/r2/sign-put-applicant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: applicationId,
          docType: currentDocument.type,
          fileName: file.name,
          mime: file.type,
          size: file.size,
          md5: md5,
        }),
      });
      
      const responseBody = await signResponse.json();
      url = responseBody.url;
      key = responseBody.key;

      // Step 2: Upload the file to R2 using the pre-signed URL
      updateDocument(index, { ...form.getValues(`documents.${index}`), upload: { ...form.getValues(`documents.${index}.upload`), status: 'uploading', progress: 40 }});
      
      await safeFetch(url, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
            'Content-MD5': md5,
          },
      });

      updateDocument(index, { ...form.getValues(`documents.${index}`), upload: { ...form.getValues(`documents.${index}.upload`), status: 'uploading', progress: 100 }});

      // Step 3: Mark as success
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
        console.error("Upload process failed:", error);
        updateDocument(index, {
            ...form.getValues(`documents.${index}`),
            upload: {
                status: 'error',
                progress: 0,
                file: file,
                errorMessage: `Upload failed: ${error.message}`
            }
        });
        return;
    }
  };


  const removeFile = (index: number) => {
    const currentDocument = form.getValues(`documents.${index}`);
    updateDocument(index, { ...currentDocument, upload: { status: 'pending', progress: 0, file: null, r2Key: undefined, fileName: undefined, errorMessage: undefined } });
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    
    try {
        const submissionData = {
            applicant: values.applicant,
            vehicle: values.vehicle,
            guarantor: {
              ...values.guarantor,
              fullName: `${values.guarantor.firstName} ${values.guarantor.lastName}`.trim()
            },
            documents: values.documents
                .filter(doc => doc.upload.status === 'success' && doc.upload.r2Key)
                .map(doc => ({
                    type: doc.type,
                    r2Key: doc.upload.r2Key,
                    fileName: doc.upload.fileName,
                    status: 'uploaded', 
                })),
        };

        const response = await safeFetch('/api/applications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(submissionData)
        });

        const newApplication = await response.json();

        toast({
          title: "ส่งใบสมัครสำเร็จ",
          description: `ใบสมัครสำหรับ ${values.applicant.firstName} ${values.applicant.lastName} ได้รับการส่งเรียบร้อยแล้ว`,
          variant: "default"
        });

        router.push("/dashboard");

    } catch(error: any) {
        console.error("Failed to submit application:", error);
        toast({
            variant: "destructive",
            title: "ส่งใบสมัครล้มเหลว",
            description: error.message || "เกิดข้อผิดพลาดบางอย่าง กรุณาลองใหม่อีกครั้ง",
        });
    } finally {
        setIsSubmitting(false);
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
                <FormField control={form.control} name="guarantor.firstName" render={({ field }) => (
                  <FormItem><FormLabel>ชื่อจริง (ผู้ค้ำ)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField control={form.control} name="guarantor.lastName" render={({ field }) => (
                  <FormItem><FormLabel>นามสกุล (ผู้ค้ำ)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
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
