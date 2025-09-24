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
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { requiredDocumentsSchema } from "@/lib/schema";
import { FileUp, FileCheck, X, ArrowLeft, ArrowRight, Send, Loader2 } from "lucide-react";


const applicantSchema = z.object({
  fullName: z.string().min(1, "กรุณากรอกชื่อ-นามสกุล"),
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

const documentSchema = z.object({
    id: z.string(),
    type: z.string(),
    file: z.any().optional(),
});

const formSchema = z.object({
    applicant: applicantSchema,
    vehicle: vehicleSchema,
    guarantor: guarantorSchema,
    documents: z.array(documentSchema),
});


const steps = [
  { id: "applicant", title: "ข้อมูลผู้สมัคร", fields: Object.keys(applicantSchema.shape) },
  { id: "vehicle", title: "ข้อมูลยานพาหนะ", fields: Object.keys(vehicleSchema.shape) },
  { id: "guarantor", title: "ข้อมูลผู้ค้ำประกัน", fields: Object.keys(guarantorSchema.shape) },
  { id: "documents", title: "อัปโหลดเอกสาร" },
];

export function ApplicationForm() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      applicant: { fullName: "", email: "", phone: "", address: "", dateOfBirth: "" },
      vehicle: { make: "", model: "", year: undefined, licensePlate: "", vin: "" },
      guarantor: { fullName: "", phone: "", email: "", address: "" },
      documents: requiredDocumentsSchema.map(doc => ({ ...doc, file: null }))
    },
  });
  
  const { fields: documentFields, update: updateDocument } = useFieldArray({
    control: form.control,
    name: "documents"
  });

  const handleNext = async () => {
    const stepId = steps[currentStep].id as keyof z.infer<typeof formSchema>;
    const fields = steps[currentStep].fields as any;
    const isValid = await form.trigger(fields, { shouldFocus: true });
    
    if (isValid) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => prev - 1);
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    console.log("Form values:", values);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));

    toast({
      title: "บันทึกใบสมัครสำเร็จ",
      description: `ใบสมัครสำหรับ ${values.applicant.fullName} ถูกสร้างเรียบร้อยแล้ว`,
      variant: "default"
    });
    
    setIsSubmitting(false);
    router.push("/dashboard/applications");
  }

  const handleFileChange = (file: File | null, index: number) => {
    if (file) {
      const currentDocument = form.getValues(`documents.${index}`);
      updateDocument(index, { ...currentDocument, file: file });
    }
  };

  const removeFile = (index: number) => {
    const currentDocument = form.getValues(`documents.${index}`);
    updateDocument(index, { ...currentDocument, file: null });
  }

  const progress = ((currentStep + 1) / (steps.length + 1)) * 100;

  return (
    <Card>
        <CardHeader>
            <Progress value={progress} className="mb-4" />
            <CardTitle className="font-headline">{steps[currentStep].title}</CardTitle>
            <CardDescription>ขั้นตอนที่ {currentStep + 1} จาก {steps.length}</CardDescription>
        </CardHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <CardContent className="space-y-6">
                    {currentStep === 0 && (
                        <div className="grid md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="applicant.fullName" render={({ field }) => (
                                <FormItem><FormLabel>ชื่อ-นามสกุล</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
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
                    )}

                    {currentStep === 1 && (
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
                    )}
                    
                    {currentStep === 2 && (
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
                    )}

                    {currentStep === 3 && (
                        <div className="space-y-4">
                            {documentFields.map((field, index) => (
                               <div key={field.id} className="border rounded-lg p-4 flex items-center justify-between">
                                  <div>
                                    <p className="font-medium">{field.type}</p>
                                    {form.getValues(`documents.${index}.file`) ? (
                                        <div className="flex items-center gap-2 text-sm text-green-600 mt-1">
                                            <FileCheck className="w-4 h-4" />
                                            <span>{(form.getValues(`documents.${index}.file`) as File).name}</span>
                                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeFile(index)}>
                                                <X className="w-4 h-4"/>
                                            </Button>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">ยังไม่ได้อัปโหลด</p>
                                    )}
                                  </div>
                                  <FormField
                                    control={form.control}
                                    name={`documents.${index}.file`}
                                    render={({ field: { onChange, value, ...rest }}) => (
                                      <FormItem>
                                        <FormControl>
                                            <Button asChild variant="outline">
                                                <label className="cursor-pointer">
                                                    <FileUp className="mr-2" />
                                                    อัปโหลด
                                                    <Input
                                                        type="file"
                                                        className="hidden"
                                                        onChange={(e) => handleFileChange(e.target.files?.[0] ?? null, index)}
                                                        {...rest}
                                                    />
                                                </label>
                                            </Button>
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                               </div>
                            ))}
                        </div>
                    )}

                </CardContent>
                <CardFooter className="flex justify-between">
                    <div>
                        {currentStep > 0 && (
                            <Button type="button" variant="outline" onClick={handleBack}>
                                <ArrowLeft className="mr-2"/>
                                ย้อนกลับ
                            </Button>
                        )}
                    </div>
                    <div>
                        {currentStep < steps.length - 1 && (
                            <Button type="button" onClick={handleNext}>
                                ถัดไป
                                <ArrowRight className="ml-2"/>
                            </Button>
                        )}
                        {currentStep === steps.length - 1 && (
                             <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    กำลังบันทึก...
                                  </>
                                ) : (
                                  <>
                                    <Send className="mr-2"/>
                                    ส่งใบสมัคร
                                  </>
                                )}
                            </Button>
                        )}
                    </div>
                </CardFooter>
            </form>
        </Form>
    </Card>
  );
}
