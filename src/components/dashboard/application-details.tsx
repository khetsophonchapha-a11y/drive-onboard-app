
"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
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
  UserX,
  CheckCircle,
  XCircle,
} from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ManifestSchema } from "@/lib/types";

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
import { useRouter } from "next/navigation";
import { updateApplicationStatus } from "@/app/actions";

type ApplicationDetailsProps = {
  application: Manifest;
};

type TempFile = {
    docId: string;
    file: File;
    objectUrl: string; // For client-side preview
};

type FileChanges = {
    toUpload: TempFile[];
    toDelete: string[]; // r2Keys
};

const statusText: Record<VerificationStatus, string> = {
  pending: "รอตรวจสอบ",
  approved: "อนุมัติ",
  rejected: "ปฏิเสธ",
  terminated: "เลิกจ้าง",
};

type BadgeVariant = "default" | "secondary" | "success" | "destructive" | "outline";

const statusVariantMap: Record<VerificationStatus, BadgeVariant> = {
  pending: "default",
  approved: "success",
  rejected: "destructive",
  terminated: "secondary",
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
    files, // Combined existing and temp files for display
    onFileUpload,
    onFileDelete,
}: {
    docSchema: typeof requiredDocumentsSchema[0];
    isEditMode: boolean;
    files: { type: 'existing' | 'temp', ref: FileRef | TempFile, displayUrl: string }[];
    onFileUpload: (docId: string, file: File, replaceKey?: string) => void;
    onFileDelete: (docId: string, key: string) => void;
}) {
    const hasFile = files.length > 0;
    const allowMultiple = false; // Hardcoded to false as per new requirement

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
                    {files.map((fileItem) => (
                        <div key={fileItem.type === 'existing' ? fileItem.ref.r2Key : (fileItem.ref as TempFile).objectUrl} className="flex flex-col gap-2">
                             <div className="relative w-full aspect-video rounded-md overflow-hidden border bg-muted">
                                <DocumentViewer
                                    fileRef={{
                                        r2Key: fileItem.type === 'existing' ? fileItem.ref.r2Key : (fileItem.ref as TempFile).file.name,
                                        mime: fileItem.type === 'existing' ? fileItem.ref.mime : (fileItem.ref as TempFile).file.type,
                                        size: fileItem.type === 'existing' ? fileItem.ref.size : (fileItem.ref as TempFile).file.size,
                                    }}
                                    previewUrl={fileItem.displayUrl}
                                />
                            </div>
                            {isEditMode && (
                                <div className="flex gap-2 pt-1 justify-end">
                                    <Button asChild size="sm" variant="outline" type="button">
                                         <label className="cursor-pointer">
                                            <Pencil className="h-4 w-4 mr-1" /> เปลี่ยนไฟล์
                                            <Input
                                                type="file"
                                                className="hidden"
                                                accept="image/jpeg,image/png,application/pdf"
                                                onChange={(e) => {
                                                    if (e.target.files?.[0]) {
                                                        const keyToDelete = fileItem.type === 'existing' ? fileItem.ref.r2Key : (fileItem.ref as TempFile).objectUrl;
                                                        onFileUpload(docSchema.id, e.target.files[0], keyToDelete);
                                                        e.target.value = '';
                                                    }
                                                }}
                                            />
                                        </label>
                                    </Button>
                                    <Button size="sm" variant="destructive" type="button" onClick={() => onFileDelete(docSchema.id, fileItem.type === 'existing' ? fileItem.ref.r2Key : (fileItem.ref as TempFile).objectUrl)}>
                                        <Trash2 className="h-4 w-4 mr-1" /> ลบ
                                    </Button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : null}

            {isEditMode && !hasFile && (
                 <div className="flex items-center justify-center p-6 bg-muted/50 rounded-md border-dashed border-2">
                     <div className="text-center text-muted-foreground">
                         <p className="font-medium">ยังไม่ได้อัปโหลดเอกสาร</p>
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
  const router = useRouter();

  const [fileChanges, setFileChanges] = useState<FileChanges>({ toUpload: [], toDelete: [] });

  const [isStatusPending, startStatusTransition] = useTransition();

  const form = useForm<z.infer<typeof ManifestSchema>>({
    resolver: zodResolver(ManifestSchema),
    defaultValues: initialApplication,
  });

  const {
    handleSubmit,
    control,
    reset,
    formState: { isDirty },
    trigger,
  } = form;

   // Revoke object URLs on cleanup
    useEffect(() => {
        return () => {
            fileChanges.toUpload.forEach(tempFile => URL.revokeObjectURL(tempFile.objectUrl));
        };
    }, [fileChanges.toUpload]);


  const handleEditToggle = () => {
    if (isEditMode) {
      reset(initialApplication); // Reset form to initial values
      setFileChanges({ toUpload: [], toDelete: [] }); // Reset file changes
    }
    setIsEditMode(!isEditMode);
  };
  
  const handleFileUpload = (docId: string, file: File, replaceKey?: string) => {
    const objectUrl = URL.createObjectURL(file);
    const newTempFile: TempFile = { docId, file, objectUrl };

    setFileChanges(prev => {
        let newUploads = [...prev.toUpload];
        let newDeletes = [...prev.toDelete];

        const allowMultiple = false; // No longer multiple

        if (replaceKey) {
             // If replacing an existing file, add its r2Key to toDelete
            if (Object.values(initialApplication.docs).flat().some(f => f && typeof f === 'object' && 'r2Key' in f && f.r2Key === replaceKey)) {
                 if (!newDeletes.includes(replaceKey)) {
                    newDeletes.push(replaceKey);
                 }
            }
             // Remove the old temp file being replaced, if any
            const uploadIndex = newUploads.findIndex(f => f.objectUrl === replaceKey);
            if (uploadIndex > -1) {
                URL.revokeObjectURL(newUploads[uploadIndex].objectUrl);
                newUploads.splice(uploadIndex, 1);
            }
        }
        
        if (!allowMultiple) {
            // For single-file docs, remove any existing temp file for this docId
            newUploads = newUploads.filter(f => {
                if (f.docId === docId) {
                    URL.revokeObjectURL(f.objectUrl);
                    return false;
                }
                return true;
            });
             // Also mark the original file for deletion if it exists
             const originalFile = getOriginalFileForDocId(docId);
             if (originalFile && !newDeletes.includes(originalFile.r2Key)) {
                 newDeletes.push(originalFile.r2Key);
             }
        }
        
        newUploads.push(newTempFile);
        
        return { toUpload: newUploads, toDelete: newDeletes };
    });
    trigger(); // Mark form as dirty
    toast({ title: 'เพิ่มไฟล์ในคิว', description: 'การเปลี่ยนแปลงจะถูกบันทึกเมื่อคุณกดปุ่ม "บันทึกการเปลี่ยนแปลง"' });
  };
  
    const handleFileDelete = (docId: string, key: string) => { // key can be r2Key or objectUrl
        setFileChanges(prev => {
            const newUploads = prev.toUpload.filter(f => {
                if (f.objectUrl === key) {
                    URL.revokeObjectURL(f.objectUrl);
                    return false;
                }
                return true;
            });
            const newDeletes = [...prev.toDelete];
            
            // If it's an r2Key and not already marked for deletion, add it
            if (key.startsWith('applications/') && !newDeletes.includes(key)) {
                newDeletes.push(key);
            }
            
            return { toUpload: newUploads, toDelete: newDeletes };
        });
        toast({ title: 'ลบไฟล์สำเร็จ', description: 'การเปลี่ยนแปลงจะถูกบันทึกเมื่อคุณกดปุ่ม "บันทึกการเปลี่ยนแปลง"' });
        trigger(); // Mark form as dirty
    };


  const onSubmit = async (values: z.infer<typeof ManifestSchema>) => {
      setIsSubmitting(true);
      
      const newManifest = JSON.parse(JSON.stringify(values)) as Manifest;
      // Re-create fullName
      newManifest.applicant.fullName = `${values.applicant.firstName} ${values.applicant.lastName}`.trim();
      if (newManifest.guarantor) {
        newManifest.guarantor.fullName = `${values.guarantor?.firstName || ''} ${values.guarantor?.lastName || ''}`.trim() || undefined;
      }

      const keysToDelete = [...fileChanges.toDelete]; // Copy keys to delete

      try {
        // Step 1: Upload new files
        const uploadPromises = fileChanges.toUpload.map(async tempFile => {
            const { docId, file } = tempFile;
            toast({ title: 'กำลังอัปโหลด...', description: file.name });
            try {
                const md5 = await md5Base64(file);
                const docSchema = requiredDocumentsSchema.find(d => d.id === docId);
                if (!docSchema) throw new Error(`Schema not found for ${docId}`);

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
                toast({ title: 'อัปโหลดสำเร็จ!', description: file.name, variant: 'default' });
                return { docId, ref: newFileRef };
            } catch (error: any) {
                 toast({ variant: 'destructive', title: `อัปโหลด ${file.name} ล้มเหลว`, description: error.message });
                 throw error;
            }
        });

        const uploadResults = await Promise.all(uploadPromises);

        // Step 2: Assemble the new manifest.docs object
        // Start with existing docs that are NOT marked for deletion
        if (newManifest.docs) {
            for (const key in newManifest.docs) {
                const docKey = key as keyof Manifest['docs'];
                const docValue = newManifest.docs[docKey];
                if (docValue && typeof docValue === 'object' && 'r2Key' in docValue) { // FileRef
                    if (fileChanges.toDelete.includes(docValue.r2Key)) {
                         delete newManifest.docs[docKey];
                    }
                } else if (docValue && typeof docValue === 'object' && 'policy' in docValue) { // Insurance
                    if (docValue.policy && fileChanges.toDelete.includes(docValue.policy.r2Key)) {
                        delete docValue.policy;
                    }
                }
            }
        }
        

        // Add the newly uploaded files
        for (const { docId, ref } of uploadResults) {
            const docMapping = {
                'doc-application-form': 'applicationForm',
                'doc-transport-contract': 'transportContract',
                'doc-guarantee-contract': 'guaranteeContract',
                'doc-citizen-id': 'citizenIdCopy',
                'doc-drivers-license': 'driverLicenseCopy',
                'doc-house-reg': 'houseRegCopy',
                'doc-car-reg': 'carRegCopy',
                'doc-car-photo': 'carPhoto',
                'doc-bank-account': 'kbankBookFirstPage',
                'doc-tax-act': 'taxAndPRB',
                'doc-guarantor-citizen-id': 'guarantorCitizenIdCopy',
                'doc-guarantor-house-reg': 'guarantorHouseRegCopy',
            };
            if (docId === 'doc-insurance') {
                if (!newManifest.docs.insurance) newManifest.docs.insurance = {};
                newManifest.docs.insurance.policy = ref;
            } else {
                 const key = docMapping[docId as keyof typeof docMapping];
                 if (key) {
                     (newManifest.docs as any)[key] = ref;
                 }
            }
        }

        // Step 3: Submit the final manifest
        await safeFetch('/api/applications/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appId: newManifest.appId, manifest: newManifest })
        });
        toast({ title: "บันทึกข้อมูลสำเร็จ!", description: "ข้อมูลใบสมัครได้รับการอัปเดตแล้ว", variant: "default" });
        setIsEditMode(false); 
        setFileChanges({ toUpload: [], toDelete: [] }); // Clear changes
        

        // Step 4: Delete old files from R2
        if (keysToDelete.length > 0) {
            try {
                await safeFetch('/api/r2/delete-objects', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ r2Keys: keysToDelete })
                });
                toast({ title: "ล้างข้อมูลสำเร็จ", description: `ไฟล์เก่าจำนวน ${keysToDelete.length} ไฟล์ถูกลบออกจากระบบแล้ว` });
            } catch (deleteError: any) {
                // Failure to delete is not critical for the user, so just log and toast.
                console.error("Failed to delete old files:", deleteError);
                toast({
                    variant: "destructive",
                    title: "ลบไฟล์เก่าล้มเหลว",
                    description: "การบันทึกข้อมูลสำเร็จ แต่ไม่สามารถลบไฟล์เก่าบางส่วนออกจากระบบได้",
                });
            }
        }
        
        // Step 5: Refresh the page to show the latest data
        router.refresh();
        reset(newManifest); // Update the form's default values for next edit session


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


  const handleUpdateStatus = (status: VerificationStatus) => {
    startStatusTransition(async () => {
      const result = await updateApplicationStatus(initialApplication.appId, status);
      if (result.success) {
        toast({
            title: `อัปเดตสถานะสำเร็จ`,
            description: `ใบสมัครถูกเปลี่ยนสถานะเป็น "${statusText[status]}"`,
            variant: "default"
        });
        // router.refresh() is automatically handled by revalidateTag in server action
      } else {
        toast({
            title: "อัปเดตสถานะล้มเหลว",
            description: result.error,
            variant: "destructive"
        });
      }
    });
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
  
  const getOriginalFileForDocId = (docId: string): FileRef | undefined => {
        const docs = initialApplication.docs;
        if (!docs) return undefined;
        switch (docId) {
            case 'doc-insurance': return docs.insurance?.policy;
            case 'doc-application-form': return docs.applicationForm;
            case 'doc-transport-contract': return docs.transportContract;
            case 'doc-guarantee-contract': return docs.guaranteeContract;
            case 'doc-citizen-id': return docs.citizenIdCopy;
            case 'doc-drivers-license': return docs.driverLicenseCopy;
            case 'doc-house-reg': return docs.houseRegCopy;
            case 'doc-car-reg': return docs.carRegCopy;
            case 'doc-car-photo': return docs.carPhoto;
            case 'doc-bank-account': return docs.kbankBookFirstPage;
            case 'doc-tax-act': return docs.taxAndPRB;
            case 'doc-guarantor-citizen-id': return docs.guarantorCitizenIdCopy;
            case 'doc-guarantor-house-reg': return docs.guarantorHouseRegCopy;
            default: return undefined;
        }
    };


 const getDisplayFiles = useMemo(() => (docId: string) => {
        const displayFiles: { type: 'existing' | 'temp', ref: FileRef | TempFile, displayUrl: string }[] = [];
        const tempUploadsForDoc = fileChanges.toUpload.filter(f => f.docId === docId);
        
        // Add temp files
        for (const tempFile of tempUploadsForDoc) {
            displayFiles.push({ type: 'temp', ref: tempFile, displayUrl: tempFile.objectUrl });
        }

        const allowMultiple = false; // No longer multiple

        // Add existing files that haven't been marked for deletion
        const addExistingFile = (fileRef: FileRef | undefined) => {
            if (fileRef && !fileChanges.toDelete.includes(fileRef.r2Key)) {
                 // For single-file docs, don't show existing if a temp one is replacing it
                if (!allowMultiple && fileChanges.toUpload.some(t => t.docId === docId)) {
                    return;
                }
                displayFiles.push({ type: 'existing', ref: fileRef, displayUrl: '' }); // displayUrl is empty, DocumentViewer will fetch it
            }
        };

        const originalFile = getOriginalFileForDocId(docId);
        if (Array.isArray(originalFile)) { // Should not happen anymore
            originalFile.forEach(addExistingFile);
        } else {
            addExistingFile(originalFile);
        }
        
        return displayFiles;
    }, [initialApplication.docs, fileChanges]);

  
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
                <FormField control={control} name="applicant.firstName" render={({ field }) => (
                  <FormItem><FormLabel>ชื่อจริง</FormLabel><FormControl><Input {...field} value={field.value || ''} readOnly={!isEditMode} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={control} name="applicant.lastName" render={({ field }) => (
                  <FormItem><FormLabel>นามสกุล</FormLabel><FormControl><Input {...field} value={field.value || ''} readOnly={!isEditMode} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={control} name="applicant.phone" render={({ field }) => (
                  <FormItem><FormLabel>เบอร์โทรศัพท์</FormLabel><FormControl><Input {...field} value={field.value || ''} readOnly={!isEditMode} /></FormControl><FormMessage /></FormItem>
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
                <FormField control={control} name="guarantor.firstName" render={({ field }) => (
                  <FormItem><FormLabel>ชื่อจริง (ผู้ค้ำ)</FormLabel><FormControl><Input {...field} value={field.value || ''} readOnly={!isEditMode} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={control} name="guarantor.lastName" render={({ field }) => (
                  <FormItem><FormLabel>นามสกุล (ผู้ค้ำ)</FormLabel><FormControl><Input {...field} value={field.value || ''} readOnly={!isEditMode} /></FormControl><FormMessage /></FormItem>
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
                    files={getDisplayFiles(reqDoc.id)}
                    onFileUpload={handleFileUpload}
                    onFileDelete={handleFileDelete}
                />
            ))}
          </CardContent>
           <CardFooter className="flex-col items-start gap-4">
                <div className="w-full space-y-4">
                    <Separator />
                     <div className="flex justify-between items-center w-full">
                        <h4 className="font-semibold">การดำเนินการ</h4>
                        <div className="flex gap-2">
                             {isEditMode && (isDirty || fileChanges.toUpload.length > 0 || fileChanges.toDelete.length > 0) ? (
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
                            ) : (
                                <>
                                    {initialApplication.status.verification === 'approved' ? (
                                        <Button variant="secondary" onClick={() => handleUpdateStatus('terminated')} disabled={isStatusPending}>
                                            {isStatusPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserX className="mr-2 h-4 w-4" />}
                                            เลิกจ้าง
                                        </Button>
                                    ) : initialApplication.status.verification === 'rejected' || initialApplication.status.verification === 'terminated' ? (
                                        <Button variant="success" onClick={() => handleUpdateStatus('approved')} disabled={isStatusPending}>
                                            {isStatusPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                            อนุมัติใบสมัครอีกครั้ง
                                        </Button>
                                    ) : (
                                        <>
                                            <Button variant="success" onClick={() => handleUpdateStatus('approved')} disabled={isStatusPending}>
                                                {isStatusPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                                อนุมัติใบสมัคร
                                            </Button>
                                            <Button variant="destructive" onClick={() => handleUpdateStatus('rejected')} disabled={isStatusPending}>
                                                {isStatusPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                                                ปฏิเสธใบสมัคร
                                            </Button>
                                            <Button variant="secondary" onClick={() => handleUpdateStatus('terminated')} disabled={isStatusPending}>
                                                {isStatusPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserX className="mr-2 h-4 w-4" />}
                                                เลิกจ้าง
                                            </Button>
                                        </>
                                    )}
                                </>
                            )}
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
      </div>
      </form>
    </Form>
  );
}
