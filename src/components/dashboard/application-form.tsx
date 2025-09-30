
"use client";

import { useState, useEffect } from "react";
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
import { carBrands, carColors } from "@/lib/vehicle-data";
import { FileUp, FileCheck, X, Send, Loader2, AlertCircle, Download } from "lucide-react";
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
  firstName: z.string().min(1, 'ต้องกรอกชื่อจริง').max(50, 'ชื่อจริงต้องไม่เกิน 50 ตัวอักษร'),
  lastName: z.string().min(1, 'ต้องกรอกนามสกุล').max(50, 'นามสกุลต้องไม่เกิน 50 ตัวอักษร'),
  phone: z.string().min(10, 'เบอร์โทรต้องมี 10 หลัก').max(10, 'เบอร์โทรต้องมี 10 หลัก').regex(/^[0-9]+$/, 'เบอร์โทรต้องเป็นตัวเลขเท่านั้น'),
  address: z.string().max(200, 'ที่อยู่ต้องไม่เกิน 200 ตัวอักษร').optional(),
  nationalId: z.string().length(13, 'เลขบัตรประชาชนต้องมี 13 หลัก').regex(/^[0-9]+$/, 'เลขบัตรประชาชนต้องเป็นตัวเลขเท่านั้น'),
});

const vehicleSchema = z.object({
  brand: z.string().optional(),
  brandOther: z.string().optional(),
  model: z.string().optional(),
  modelOther: z.string().optional(),
  year: z.coerce.number().optional(),
  plateNo: z.string().optional(),
  color: z.string().optional(),
  colorOther: z.string().optional(),
});

const guarantorSchema = z.object({
    firstName: z.string().max(50, 'ชื่อจริงผู้ค้ำต้องไม่เกิน 50 ตัวอักษร').optional(),
    lastName: z.string().max(50, 'นามสกุลผู้ค้ำต้องไม่เกิน 50 ตัวอักษร').optional(),
    phone: z.string().max(10, 'เบอร์โทรผู้ค้ำต้องมี 10 หลัก').regex(/^[0-9]*$/, 'เบอร์โทรผู้ค้ำต้องเป็นตัวเลขเท่านั้น').optional(),
    address: z.string().max(200, 'ที่อยู่ผู้ค้ำต้องไม่เกิน 200 ตัวอักษร').optional(),
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
        (docs) => docs.filter(d => d.required).every(doc => doc.upload.status === 'selected' || doc.upload.status === 'success'),
        {
          message: 'กรุณาอัปโหลดเอกสารที่จำเป็นให้ครบถ้วน',
        }
      ),
});

type FormValues = z.infer<typeof formSchema>;

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"];

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 30 }, (_, i) => currentYear - i);

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
    resolver: zodResolver(formSchema),
    defaultValues: {
      applicant: { firstName: "", lastName: "", phone: "", address: "", nationalId: "" },
      vehicle: { brand: "", model: "", plateNo: "", color: "" },
      guarantor: { firstName: "", lastName: "", phone: "", address: "" },
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

  const watchBrand = form.watch('vehicle.brand');
  const watchColor = form.watch('vehicle.color');
  const watchModel = form.watch('vehicle.model');

  const models = carBrands.find(b => b.name === watchBrand)?.models || [];

  useEffect(() => {
    // When brand changes, if it's not "Other", clear the "Other" input and reset model selection
    if (watchBrand !== 'อื่นๆ') {
      form.setValue('vehicle.brandOther', '');
      form.setValue('vehicle.model', '');
    }
  }, [watchBrand, form]);

  useEffect(() => {
      // When model changes, if it's not "Other", clear the "Other" input
      if (watchModel !== 'อื่นๆ') {
        form.setValue('vehicle.modelOther', '');
      }
  }, [watchModel, form]);

  useEffect(() => {
    // When color changes, if it's not "Other", clear the "Other" input
    if (watchColor !== 'อื่นๆ') {
      form.setValue('vehicle.colorOther', '');
    }
  }, [watchColor, form]);

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

        // Prepare vehicle data, considering "Other" fields
        const finalVehicleData = {
          ...values.vehicle,
          brand: values.vehicle.brand === 'อื่นๆ' ? values.vehicle.brandOther : values.vehicle.brand,
          model: values.vehicle.model === 'อื่นๆ' ? values.vehicle.modelOther : values.vehicle.model,
          color: values.vehicle.color === 'อื่นๆ' ? values.vehicle.colorOther : values.vehicle.color,
        };
        // Remove the "Other" temp fields
        delete finalVehicleData.brandOther;
        delete finalVehicleData.modelOther;
        delete finalVehicleData.colorOther;


        const manifest: Manifest = {
            appId: appId,
            createdAt: new Date().toISOString(),
            applicant: {
                ...values.applicant,
                fullName: `${values.applicant.firstName} ${values.applicant.lastName}`.trim(),
            },
            vehicle: finalVehicleData,
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
    <Card>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="pt-6 space-y-8">
            {/* Applicant Section */}
            <div className="space-y-4">
              <CardTitle className="font-headline">ข้อมูลผู้สมัคร</CardTitle>
              <div className="grid md:grid-cols-2 gap-4">
                <FormField control={form.control} name="applicant.firstName" render={({ field }) => (
                  <FormItem><FormLabel>ชื่อจริง<span className="text-destructive ml-1">*</span></FormLabel><FormControl><Input {...field} maxLength={50} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="applicant.lastName" render={({ field }) => (
                  <FormItem><FormLabel>นามสกุล<span className="text-destructive ml-1">*</span></FormLabel><FormControl><Input {...field} maxLength={50} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="applicant.nationalId" render={({ field }) => (
                  <FormItem><FormLabel>เลขบัตรประชาชน<span className="text-destructive ml-1">*</span></FormLabel><FormControl><Input {...field} placeholder="x-xxxx-xxxxx-xx-x" maxLength={13} onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ''))} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="applicant.phone" render={({ field }) => (
                  <FormItem><FormLabel>เบอร์โทรศัพท์<span className="text-destructive ml-1">*</span></FormLabel><FormControl><Input {...field} placeholder="xxx-xxx-xxxx" maxLength={10} onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ''))} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="applicant.address" render={({ field }) => (
                  <FormItem className="md:col-span-2"><FormLabel>ที่อยู่ (ถ้ามี)</FormLabel><FormControl><Input {...field} value={field.value || ''} maxLength={200} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </div>

            <Separator />

            {/* Vehicle Section */}
            <div className="space-y-4">
                <CardTitle className="font-headline">ข้อมูลยานพาหนะ (ถ้ามี)</CardTitle>
                <div className="grid md:grid-cols-2 gap-x-4 gap-y-4">
                     <FormField
                        control={form.control}
                        name="vehicle.brand"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>ยี่ห้อรถ</FormLabel>
                            <div className={`grid ${watchBrand === 'อื่นๆ' ? 'grid-cols-2 gap-2' : 'grid-cols-1'}`}>
                                <Select onValueChange={field.onChange} value={field.value || ''}>
                                <FormControl>
                                    <SelectTrigger><SelectValue placeholder="เลือกยี่ห้อรถ" /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {carBrands.map(brand => <SelectItem key={brand.name} value={brand.name}>{brand.name}</SelectItem>)}
                                    <SelectItem value="อื่นๆ">อื่นๆ (โปรดระบุ)</SelectItem>
                                </SelectContent>
                                </Select>
                                 {watchBrand === 'อื่นๆ' && (
                                    <FormField
                                        control={form.control}
                                        name="vehicle.brandOther"
                                        render={({ field: brandOtherField }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <Input {...brandOtherField} value={brandOtherField.value || ''} placeholder="ระบุยี่ห้อ" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}
                            </div>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="vehicle.model"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>รุ่นรถ</FormLabel>
                             <div className={`grid ${watchModel === 'อื่นๆ' ? 'grid-cols-2 gap-2' : 'grid-cols-1'}`}>
                                <Select onValueChange={field.onChange} value={field.value || ''} disabled={!watchBrand || watchBrand === 'อื่นๆ'}>
                                <FormControl>
                                    <SelectTrigger><SelectValue placeholder={!watchBrand || watchBrand === 'อื่นๆ' ? 'กรุณาระบุยี่ห้อก่อน' : 'เลือกรุ่นรถ'} /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {models.map(model => <SelectItem key={model} value={model}>{model}</SelectItem>)}
                                    <SelectItem value="อื่นๆ">อื่นๆ (โปรดระบุ)</SelectItem>
                                </SelectContent>
                                </Select>
                                {watchModel === 'อื่นๆ' && (
                                    <FormField
                                        control={form.control}
                                        name="vehicle.modelOther"
                                        render={({ field: modelOtherField }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <Input {...modelOtherField} value={modelOtherField.value || ''} placeholder="ระบุรุ่น" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}
                            </div>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="vehicle.year"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>ปีที่ผลิต (ค.ศ.)</FormLabel>
                            <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString() || ''}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="เลือกปี" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                {yearOptions.map(year => (
                                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField control={form.control} name="vehicle.plateNo" render={({ field }) => (
                        <FormItem><FormLabel>ป้ายทะเบียน</FormLabel><FormControl><Input {...field} value={field.value || ''} placeholder="เช่น 1กข 1234" /></FormControl><FormMessage /></FormItem>
                    )} />
                     <FormField
                        control={form.control}
                        name="vehicle.color"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>สีรถ</FormLabel>
                             <div className={`grid ${watchColor === 'อื่นๆ' ? 'grid-cols-2 gap-2' : 'grid-cols-1'}`}>
                                <Select onValueChange={field.onChange} value={field.value || ''}>
                                <FormControl>
                                    <SelectTrigger><SelectValue placeholder="เลือกสีรถ" /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {carColors.map(color => <SelectItem key={color} value={color}>{color}</SelectItem>)}
                                    <SelectItem value="อื่นๆ">อื่นๆ (โปรดระบุ)</SelectItem>
                                </SelectContent>
                                </Select>
                                {watchColor === 'อื่นๆ' && (
                                    <FormField
                                        control={form.control}
                                        name="vehicle.colorOther"
                                        render={({ field: colorOtherField }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <Input {...colorOtherField} value={colorOtherField.value || ''} placeholder="ระบุสี" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}
                            </div>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
            </div>

            <Separator />

            {/* Guarantor Section */}
            <div className="space-y-4">
              <CardTitle className="font-headline">ข้อมูลผู้ค้ำประกัน (ถ้ามี)</CardTitle>
              <div className="grid md:grid-cols-2 gap-4">
                <FormField control={form.control} name="guarantor.firstName" render={({ field }) => (
                  <FormItem><FormLabel>ชื่อจริง (ผู้ค้ำ)</FormLabel><FormControl><Input {...field} value={field.value || ''} maxLength={50} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField control={form.control} name="guarantor.lastName" render={({ field }) => (
                  <FormItem><FormLabel>นามสกุล (ผู้ค้ำ)</FormLabel><FormControl><Input {...field} value={field.value || ''} maxLength={50} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="guarantor.phone" render={({ field }) => (
                  <FormItem><FormLabel>เบอร์โทรศัพท์ (ผู้ค้ำ)</FormLabel><FormControl><Input {...field} value={field.value || ''} placeholder="xxx-xxx-xxxx" maxLength={10} onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ''))} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="guarantor.address" render={({ field }) => (
                  <FormItem className="md:col-span-2"><FormLabel>ที่อยู่ (ผู้ค้ำ)</FormLabel><FormControl><Input {...field} value={field.value || ''} maxLength={200} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </div>

            <Separator />

            {/* Documents Section */}
            <div className="space-y-4">
              <CardHeader className="p-0">
                <CardTitle className="font-headline">อัปโหลดเอกสาร</CardTitle>
                <CardDescription>กรุณาเซ็นสำเนาถูกต้องและถ่ายรูปให้ชัดเจนก่อนส่ง (JPG, PNG ไม่เกิน 2MB; PDF ไม่เกิน 10MB)</CardDescription>
              </CardHeader>
               <div className="space-y-4 pt-4">
                    <CardDescription>
                        ดาวน์โหลดแบบฟอร์มเพื่อกรอกและเซ็นชื่อ จากนั้นอัปโหลดในส่วนถัดไป
                    </CardDescription>
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

    