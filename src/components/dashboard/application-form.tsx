
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";

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
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { requiredDocumentsSchema } from "@/lib/schema";
import { FileUp, FileCheck, X, Send, Loader2, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import type { Manifest, FileRef } from "@/lib/types";
import { ManifestSchema, RequiredAddressSchema } from "@/lib/types";
import { carColors, getVehicleBrands, getVehicleModels, vehicleTypes } from "@/lib/vehicle-data";
import { DateWheelPicker } from "@/components/ui/date-wheel-picker";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { provinceOptions, getDistrictOptions, getSubDistrictOptions, jobPositionOptions } from "@/lib/form-options";
import { SignatureInput } from "@/components/ui/signature-input";
import { LegalAgreement } from "@/components/dashboard/legal-agreement";

function dataURLtoFile(dataurl: string, filename: string) {
    var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)![1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
}

// Helper for safer fetching with better error messages
async function safeFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
    const response = await fetch(input, init);
    if (!response.ok) {
        let errorMessage = `Request failed with status ${response.status} (${response.statusText})`;
        try {
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                const errorBody = await response.json();
                if (errorBody.error) {
                    errorMessage = errorBody.error;
                }
            } else {
                errorMessage = response.statusText;
            }
        } catch (e) {
            // Parsing JSON failed, stick with the status text.
            errorMessage = response.statusText;
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

const CURRENT_YEAR = new Date().getFullYear();

const calculateAge = (date: Date | undefined) => {
    if (!date) return undefined;
    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const monthDiff = today.getMonth() - date.getMonth();
    if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < date.getDate())
    ) {
        age -= 1;
    }
    return age < 0 ? 0 : age;
};

const GuarantorFormSchema = ManifestSchema.shape.guarantor
    .extend({
        address: RequiredAddressSchema.optional(),
    })
    .superRefine((data, ctx) => {
        if (data.isAddressSameAsApplicantCurrent) {
            return;
        }

        const addressValidation = RequiredAddressSchema.safeParse(data.address);
        if (addressValidation.success) {
            return;
        }

        for (const issue of addressValidation.error.issues) {
            ctx.addIssue({
                ...issue,
                path: ['address', ...issue.path],
            });
        }
    });

const ApplicationFormSchema = z.object({
    applicant: ManifestSchema.shape.applicant,
    applicationDetails: ManifestSchema.shape.applicationDetails,
    guarantor: GuarantorFormSchema,
    vehicle: ManifestSchema.shape.vehicle,
    signature: z.string({ required_error: 'กรุณาลงลายมือชื่อ' }).min(1, 'กรุณาลงลายมือชื่อ'),
    guarantorSignature: z.string().optional(),
    documents: z.array(documentSchema)
        .refine(
            (docs) => docs.filter(d => d.required).every(doc => doc.upload.status === 'selected' || doc.upload.status === 'success'),
            {
                message: 'กรุณาอัปโหลดเอกสารที่จำเป็นให้ครบถ้วน',
            }
        ),
});


type FormValues = z.infer<typeof ApplicationFormSchema>;
type ManifestDocs = NonNullable<Manifest['docs']>;

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const EMPTY_REQUIRED_ADDRESS = {
    houseNo: '',
    moo: '',
    street: '',
    subDistrict: '',
    district: '',
    province: '',
    postalCode: '',
};

export function ApplicationForm() {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submissionProgress, setSubmissionProgress] = useState(0);
    const router = useRouter();
    const { toast } = useToast();
    const guarantorAddressDraftRef = useRef<NonNullable<FormValues['guarantor']['address']> | null>(null);
    const previousGuarantorAddressSameRef = useRef(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(ApplicationFormSchema),
        defaultValues: {
            applicant: {
                prefix: undefined,
                firstName: '',
                lastName: '',
                nickname: '',
                nationalId: '',
                nationalIdIssueDate: undefined,
                nationalIdExpiryDate: undefined,
                dateOfBirth: undefined,
                race: 'ไทย',
                nationality: 'ไทย',
                religion: '',
                height: undefined,
                weight: undefined,
                gender: undefined,
                maritalStatus: undefined,
                currentAddress: {
                    houseNo: '',
                    moo: '',
                    street: '',
                    subDistrict: '',
                    district: '',
                    province: '',
                    postalCode: '',
                },
                permanentAddress: {
                    houseNo: '',
                    moo: '',
                    street: '',
                    subDistrict: '',
                    district: '',
                    province: '',
                    postalCode: '',
                },
                isPermanentAddressSame: false,
                homePhone: '',
                mobilePhone: '',
                email: '',
                residenceType: undefined,
                militaryStatus: undefined,
            },
            applicationDetails: {
                position: 'พนักงานขับรถ',
                criminalRecord: 'no',
                criminalRecordDetails: '',
                applicationDate: new Date(),
                emergencyContact: {
                    firstName: '',
                    lastName: '',
                    occupation: '',
                    relation: '',
                    phone: '',
                    mobilePhone: '',
                },
            },
            vehicle: {
                type: undefined,
                brand: undefined,
                brandOther: '',
                model: undefined,
                modelOther: '',
                plateNo: '',
                color: undefined,
                colorOther: '',
                year: undefined,
            },
            guarantor: {
                contractDate: undefined,
                firstName: '',
                lastName: '',
                age: undefined,
                race: 'ไทย',
                nationality: 'ไทย',
                address: {
                    ...EMPTY_REQUIRED_ADDRESS,
                },
                isAddressSameAsApplicantCurrent: false,
                nationalId: '',
                phone: '',
                occupation: '',
                applicantStartDate: undefined,
            },
            documents: requiredDocumentsSchema.map(doc => ({
                ...doc,
                upload: { status: 'pending', progress: 0, file: null }
            })),
            signature: undefined,
            guarantorSignature: undefined,
        },
        mode: "onChange",
    });

    const { fields: documentFields, update: updateDocument } = useFieldArray({
        control: form.control,
        name: "documents"
    });

    const watchIsPermanentAddressSame = form.watch('applicant.isPermanentAddressSame');
    const watchCurrentAddress = form.watch('applicant.currentAddress');
    const watchCurrentProvince = form.watch('applicant.currentAddress.province');
    const watchCurrentDistrict = form.watch('applicant.currentAddress.district');
    const watchPermanentProvince = form.watch('applicant.permanentAddress.province');
    const watchPermanentDistrict = form.watch('applicant.permanentAddress.district');
    const watchGuarantorProvince = form.watch('guarantor.address.province');
    const watchGuarantorDistrict = form.watch('guarantor.address.district');
    const watchGuarantorAddressSame = form.watch('guarantor.isAddressSameAsApplicantCurrent');
    const watchRelation = form.watch('applicationDetails.emergencyContact.relation');
    const watchVehicleType = form.watch('vehicle.type');
    const watchVehicleBrand = form.watch('vehicle.brand');
    const watchVehicleColor = form.watch('vehicle.color');
    const watchCriminalRecord = form.watch('applicationDetails.criminalRecord');
    const watchDateOfBirth = form.watch('applicant.dateOfBirth');
    const vehicleBrandOptions = useMemo(() => {
        if (!watchVehicleType) return [];
        return getVehicleBrands(watchVehicleType).map((brand) => ({
            value: brand.value,
            label: brand.label,
        }));
    }, [watchVehicleType]);

    const vehicleModelOptions = useMemo(() => {
        if (!watchVehicleType || !watchVehicleBrand || watchVehicleBrand === 'other') {
            return [];
        }
        return getVehicleModels(watchVehicleType, watchVehicleBrand).map((model) => ({
            value: model.value,
            label: model.label,
        }));
    }, [watchVehicleType, watchVehicleBrand]);

    const requiresCriminalDetails = watchCriminalRecord === 'yes';

    // Legal Text Constants
    const TRANSPORT_AGREEMENT_CLAUSES = [
        "\"ผู้ว่าจ้าง\" ตกลงจ้าง และ \"ผู้รับจ้าง\" ตกลงรับจ้างทำการขนส่งสินค้าตามรายละเอียดของสินค้าปรากฏตามใบสั่งของ...",
        "ผู้รับจ้างจะทำการขนส่งสินค้าด้วยรถยนต์ของตนเอง... โดยผู้รับจ้างจะต้องส่งให้ถึงผู้รับสินค้าตามวันเวลาและสถานที่ที่ผู้ว่าจ้างกำหนด",
        "ผู้รับจ้างจะต้องจัดให้มีคนขับรถ 1 คน... และพนักงานติดรถยนต์อีก 1 คน... โดยค่าใช้จ่ายต่างๆ ถือเป็นความรับผิดชอบของผู้รับจ้างทั้งสิ้น",
        "ผู้รับจ้างรวมถึงผู้อยู่ในความรับผิดชอบ... มีหน้าที่ต้องปฏิบัติตามกฎระเบียบข้อบังคับและคำสั่งของผู้ว่าจ้างทุกประการ",
        "เมื่อสินค้า...ได้บรรทุกขึ้นรถยนต์... ให้สินค้าเหล่านั้นอยู่ในความรับผิดชอบดูแลของผู้รับจ้างทันที... หากเกิดความเสียหาย... ผู้รับจ้างจะต้องรับผิดชอบชดใช้เต็มจำนวน",
        "ผู้รับจ้างจะต้องทำการขนส่งด้วยความระมัดระวัง... และจะต้องขนส่งโดยเร็วให้ทันตามกำหนด",
        "หากเกิดความเสียหาย... ผู้รับจ้างจะต้องแจ้งให้ผู้ว่าจ้างทราบทันทีทุกกรณี",
        "...ห้ามนำสินค้าโยกย้ายหรือสับเปลี่ยนสินค้าออกจากรถยนต์... โดยเด็ดขาด",
        "ในกรณีที่ผู้รับจ้างได้เก็บเงินจากลูกค้า ผู้รับจ้างจะต้องรีบนำเงินมาส่งให้ผู้ว่าจ้างโดยทันที มิฉะนั้นถือว่ามีเจตนายักยอกทรัพย์...",
        "...บอกเลิกสัญญา ผู้รับจ้างจะต้องแจ้ง...ล่วงหน้าอย่างน้อย 30 วัน และผู้รับจ้างจะต้องมาปฏิบัติงานทุกวันจนถึงวันเลิกสัญญา หากขาดงาน...ปรับเป็นเงินวันละ 1,500 บาท...",
        "ในกรณีที่ผู้รับจ้างบอกเลิกสัญญากะทันหัน... ผู้ว่าจ้างจะทำการปรับเงิน 1,500 บาท / ต่อวัน จนครบ 30 วัน",
        "ผู้ว่าจ้างจะจ่ายค่าขนส่งตามหนังสือประกาศ... โดยตัดบัญชีเดือนต่อเดือน... และจะจ่ายให้แล้วเสร็จภายในวันที่ 10 หรือวันที่ 25...",
        "...การส่งหนังสือถึงผู้รับจ้าง... ให้ถือว่าผู้ว่าจ้างได้ส่งให้แก่ผู้รับจ้างโดยชอบแล้ว",
        "ในกรณีที่ผู้รับจ้างลาออก ทางผู้ว่าจ้างยังไม่จ่ายค่าบรรทุกสินค้าในเดือนที่ลาออกนั้น จนกว่าผู้รับจ้างจะชดใช้ค่าเสียหาย...จนครบจบสิ้น",
        "ถ้า...ผู้รับจ้างได้ทำสินค้าเสียหาย...แล้วขาดการติดต่อ... ผู้ว่าจ้างจะถือว่าทางผู้รับจ้างตั้งใจทุจริต...และดำเนินคดีตามกฎหมายให้ถึงที่สุด"
    ];

    const GUARANTOR_AGREEMENT_CLAUSES = [
        "ตามที่บริษัทได้ตกลงรับ (ผู้สมัคร) เข้าทำงาน... ถ้าหากได้ก่อให้เกิดหนี้สินขึ้นแก่บริษัทหรือกระทำการใดๆ อันก่อให้เกิดความเสียหายขึ้นแก่บริษัท ข้าพเจ้าในฐานะผู้ค้ำประกันยอมรับผิดชอบหนี้สินและค่าเสียหายทั้งหมดเต็มจำนวน... ทันทีโดยไม่อ้างเหตุใดๆ มาปัดความรับผิดชอบเป็นอันขาด",
        "...ข้าพเจ้าผู้ค้ำประกันยอมสละสิทธิในอันที่จะขอให้บริษัทเรียกร้องเอาจากผู้รับจ้างก่อน... ผู้ค้ำประกันจะไม่อ้างเอาการผ่อนเวลาเช่นว่านั้นเป็นเหตุปลดเปลื้องความรับผิดชอบ...",
        "สัญญาค้ำประกันฉบับนี้ผู้ค้ำประกันตกลงยินยอมค้ำประกันให้ผู้รับจ้างตลอดระหว่างที่ทำงานอยู่กับบริษัท",
        "ในกรณีผู้ค้ำประกันประสงค์ที่จะบอกเลิกสัญญา... จะต้องแจ้งให้ทางบริษัททราบล่วงหน้าเป็นลายลักษณ์อักษรอย่างน้อย 30 วัน"
    ];

    useEffect(() => {
        if (watchIsPermanentAddressSame) {
            const currentAddress = form.getValues('applicant.currentAddress');
            if (currentAddress) {
                form.setValue(
                    'applicant.permanentAddress',
                    { ...currentAddress },
                    { shouldDirty: true }
                );
            }
        }
    }, [watchIsPermanentAddressSame, form]);

    useEffect(() => {
        const wasUsingApplicantAddress = previousGuarantorAddressSameRef.current;

        if (watchGuarantorAddressSame && !wasUsingApplicantAddress) {
            guarantorAddressDraftRef.current = {
                ...EMPTY_REQUIRED_ADDRESS,
                ...(form.getValues('guarantor.address') ?? {}),
            };
            form.clearErrors('guarantor.address');
        }

        if (!watchGuarantorAddressSame && wasUsingApplicantAddress && guarantorAddressDraftRef.current) {
            form.setValue(
                'guarantor.address',
                { ...guarantorAddressDraftRef.current },
                { shouldDirty: true, shouldValidate: true }
            );
        }

        previousGuarantorAddressSameRef.current = watchGuarantorAddressSame;
    }, [watchGuarantorAddressSame, form]);

    useEffect(() => {
        if (!watchGuarantorAddressSame) {
            return;
        }

        const currentAddress = form.getValues('applicant.currentAddress');
        if (currentAddress) {
            form.setValue(
                'guarantor.address',
                { ...currentAddress },
                { shouldDirty: true, shouldValidate: false }
            );
        }
    }, [watchGuarantorAddressSame, watchCurrentAddress, form]);

    useEffect(() => {
        const dateOfBirth = watchDateOfBirth instanceof Date ? watchDateOfBirth : undefined;
        const computedAge = calculateAge(dateOfBirth);
        form.setValue('applicant.age', computedAge ?? 0, {
            shouldDirty: false,
            shouldValidate: false,
        });
    }, [watchDateOfBirth, form]);

    useEffect(() => {
        if (!watchVehicleType) {
            form.setValue('vehicle.brand', undefined, { shouldDirty: true });
            form.setValue('vehicle.model', undefined, { shouldDirty: true });
            return;
        }
        const availableBrands = getVehicleBrands(watchVehicleType);
        const currentBrand = form.getValues('vehicle.brand');
        if (currentBrand && !availableBrands.some((brand) => brand.value === currentBrand)) {
            form.setValue('vehicle.brand', undefined, { shouldDirty: true });
            form.setValue('vehicle.model', undefined, { shouldDirty: true });
        }
    }, [watchVehicleType, form]);

    useEffect(() => {
        if (!watchVehicleBrand) {
            form.setValue('vehicle.model', undefined, { shouldDirty: true });
            return;
        }

        if (watchVehicleBrand !== 'other') {
            if (form.getValues('vehicle.brandOther')) {
                form.setValue('vehicle.brandOther', '', { shouldDirty: true });
            }
            if (form.getValues('vehicle.modelOther')) {
                form.setValue('vehicle.modelOther', '', { shouldDirty: true });
            }
        }

        if (!watchVehicleType) {
            return;
        }

        if (watchVehicleBrand === 'other') {
            form.setValue('vehicle.model', undefined, { shouldDirty: true });
            return;
        }

        const availableModels = getVehicleModels(watchVehicleType, watchVehicleBrand);
        const currentModel = form.getValues('vehicle.model');
        if (currentModel && !availableModels.some((model) => model.value === currentModel)) {
            form.setValue('vehicle.model', undefined, { shouldDirty: true });
        }
    }, [watchVehicleBrand, watchVehicleType, form]);

    useEffect(() => {
        if (watchVehicleColor !== 'other' && form.getValues('vehicle.colorOther')) {
            form.setValue('vehicle.colorOther', '', { shouldDirty: true });
        }
    }, [watchVehicleColor, form]);

    useEffect(() => {
        if (watchCriminalRecord !== 'yes' && form.getValues('applicationDetails.criminalRecordDetails')) {
            form.setValue('applicationDetails.criminalRecordDetails', '', { shouldDirty: true });
        }
    }, [watchCriminalRecord, form]);

    // Helper to compress images before upload
    const compressImage = async (file: File): Promise<File> => {
        // Only compress images
        if (!file.type.startsWith('image/')) return file;

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1200;
                    const MAX_HEIGHT = 1600; // Allow taller for documents
                    let width = img.width;
                    let height = img.height;

                    // Calculate new dimensions
                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        resolve(file); // Fallback to original
                        return;
                    }

                    // Draw white background (prevent transparency issues with JPEGs)
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, width, height);
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((blob) => {
                        if (blob) {
                            // Create a new file with the compressed blob
                            // Force JPEG for better compression of documents
                            const newName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
                            const resizedFile = new File([blob], newName, {
                                type: 'image/jpeg',
                                lastModified: Date.now(),
                            });
                            resolve(resizedFile);
                        } else {
                            reject(new Error('Image compression failed'));
                        }
                    }, 'image/jpeg', 0.85); // 0.85 quality
                };
                img.onerror = (error) => reject(error);
            };
            reader.onerror = (error) => reject(error);
        });
    };

    const handleFileChange = async (file: File | null, index: number) => {
        if (!file) return;
        const currentDocument = form.getValues(`documents.${index}`);

        if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
            toast({ variant: "destructive", title: "ประเภทไฟล์ไม่ถูกต้อง", description: "รองรับเฉพาะไฟล์ JPG, PNG, และ PDF เท่านั้น" });
            return;
        }

        let processedFile = file;

        // Compress image if it is an image
        if (file.type.startsWith('image/')) {
            try {
                // Show a loading toast or similar could be nice, but for now we just process
                processedFile = await compressImage(file);
            } catch (error) {
                console.error("Image compression error:", error);
                // Fallback to original if compression fails, but warn?
                // or just continue. We continue with original.
            }
        }

        // Validate size AFTER compression
        if (processedFile.type.startsWith('image/') && processedFile.size > MAX_IMAGE_SIZE) {
            toast({ variant: "destructive", title: "ไฟล์รูปภาพมีขนาดใหญ่เกินไป", description: "ขนาดไฟล์รูปภาพต้องไม่เกิน 2MB (หลังบีบอัดแล้ว)" });
            return;
        }

        if (processedFile.type === 'application/pdf' && processedFile.size > MAX_PDF_SIZE) {
            toast({ variant: "destructive", title: "ไฟล์ PDF มีขนาดใหญ่เกินไป", description: "ขนาดไฟล์ PDF ต้องไม่เกิน 10MB" });
            return;
        }

        updateDocument(index, {
            ...currentDocument,
            upload: {
                status: 'selected',
                progress: 0,
                file: processedFile,
                fileName: processedFile.name,
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
                            applicationId: appId, docType: doc.id, fileName: file.name,
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

            // Signature Upload
            let signatureFileRef: FileRef | undefined;
            if (values.signature) {
                try {
                    const file = dataURLtoFile(values.signature, `signature_${appId}.png`);
                    const md5 = await md5Base64(file);

                    const signResponse = await safeFetch('/api/r2/sign-put-applicant', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            applicationId: appId, docType: 'signature', fileName: file.name,
                            mime: file.type, size: file.size, md5,
                        }),
                    });
                    const { url, key } = await signResponse.json();
                    await safeFetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type, 'Content-MD5': md5 } });

                    signatureFileRef = { r2Key: key, mime: file.type, size: file.size, md5 };
                } catch (e: any) {
                    console.error("Signature upload failed", e);
                    throw new Error(`อัปโหลดลายเซ็นล้มเหลว: ${e.message}`);
                }
            }

            const uploadedFileRefs = await Promise.all(uploadPromises);

            setSubmissionProgress(90);

            const applicantData: NonNullable<FormValues['applicant']> = { ...(values.applicant ?? {}) };
            const guarantorData = { ...values.guarantor };
            const applicationDetails = { ...values.applicationDetails };
            const birthDate = applicantData.dateOfBirth instanceof Date ? applicantData.dateOfBirth : undefined;
            const calculatedAge = calculateAge(birthDate);
            if (calculatedAge !== undefined) {
                applicantData.age = calculatedAge;
            }
            if (applicantData.isPermanentAddressSame && applicantData.currentAddress) {
                applicantData.permanentAddress = { ...applicantData.currentAddress };
            }
            if (guarantorData?.isAddressSameAsApplicantCurrent && applicantData.currentAddress) {
                guarantorData.address = { ...applicantData.currentAddress };
            } else if (guarantorData && guarantorData.address) {
                guarantorData.address = { ...guarantorData.address };
            }
            if (!guarantorData?.address) {
                throw new Error('กรุณากรอกที่อยู่ผู้ค้ำประกันให้ครบถ้วน');
            }
            const normalizedGuarantorData = {
                ...guarantorData,
                address: { ...guarantorData.address },
            };
            if (applicationDetails.criminalRecord !== 'yes') {
                applicationDetails.criminalRecordDetails = undefined;
            }
            const vehicleData = { ...values.vehicle };
            if (vehicleData.brand === 'other') {
                vehicleData.model = undefined;
            } else if (vehicleData.brand) {
                vehicleData.brandOther = undefined;
                vehicleData.modelOther = undefined;
            } else {
                vehicleData.brandOther = undefined;
                vehicleData.model = undefined;
                vehicleData.modelOther = undefined;
            }
            if (vehicleData.color !== 'other') {
                vehicleData.colorOther = undefined;
            }
            if (typeof vehicleData.plateNo === 'string') {
                vehicleData.plateNo = vehicleData.plateNo.trim().toUpperCase() || undefined;
            }
            const docs = uploadedFileRefs.reduce<ManifestDocs>((acc, fileRef) => {
                const fileData: FileRef = { r2Key: fileRef.r2Key, mime: fileRef.mime, size: fileRef.size, md5: fileRef.md5 };

                switch (fileRef.docId) {
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
            }, {} as ManifestDocs);

            if (signatureFileRef) {
                docs.signature = signatureFileRef;
            }

            // Guarantor Signature Upload
            let guarantorSignatureFileRef: FileRef | undefined;
            if (values.guarantorSignature) {
                try {
                    const file = dataURLtoFile(values.guarantorSignature, `guarantor_signature_${appId}.png`);
                    const md5 = await md5Base64(file);

                    const signResponse = await safeFetch('/api/r2/sign-put-applicant', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            applicationId: appId, docType: 'guarantorSignature', fileName: file.name,
                            mime: file.type, size: file.size, md5,
                        }),
                    });
                    const { url, key } = await signResponse.json();
                    await safeFetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type, 'Content-MD5': md5 } });

                    guarantorSignatureFileRef = { r2Key: key, mime: file.type, size: file.size, md5 };
                } catch (e: any) {
                    console.error("Guarantor Signature upload failed", e);
                    throw new Error(`อัปโหลดลายเซ็นผู้ค้ำประกันล้มเหลว: ${e.message}`);
                }
            }
            if (guarantorSignatureFileRef) {
                docs.guarantorSignature = guarantorSignatureFileRef;
            }

            const manifest: Manifest = {
                appId: appId,
                createdAt: new Date().toISOString(),
                applicant: {
                    ...applicantData,
                    fullName: `${applicantData.firstName ?? ''} ${applicantData.lastName ?? ''}`.trim(),
                },
                applicationDetails,
                guarantor: {
                    ...normalizedGuarantorData,
                    fullName: `${normalizedGuarantorData.firstName ?? ''} ${normalizedGuarantorData.lastName ?? ''}`.trim() || undefined
                },
                vehicle: vehicleData,
                docs,
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

    const onInvalid = (errors: any) => {
        console.error("Form Validation Errors:", errors);
        toast({
            variant: "destructive",
            title: "ข้อมูลไม่ครบถ้วน",
            description: "กรุณากรอกข้อมูลในช่องที่มีเครื่องหมายดอกจัน (*) ให้ครบถ้วน รวมถึงการอัปโหลดเอกสารและการลงลายมือชื่อ",
        });
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-8">
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
                                        <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                                            <FormControl>
                                                <SelectTrigger ref={field.ref}>
                                                    <SelectValue placeholder="เลือกคำนำหน้า..." />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="นาย">นาย</SelectItem>
                                                <SelectItem value="นาง">นาง</SelectItem>
                                                <SelectItem value="นางสาว">นางสาว</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField
                                    control={form.control}
                                    name="applicant.firstName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>ชื่อ<span className="text-destructive ml-1">*</span></FormLabel>
                                            <FormControl>
                                                <Input
                                                    value={field.value ?? ''}
                                                    maxLength={40}
                                                    placeholder="ex. สมชาย"
                                                    onChange={(event) => field.onChange(event.target.value)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="applicant.lastName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>นามสกุล<span className="text-destructive ml-1">*</span></FormLabel>
                                            <FormControl>
                                                <Input
                                                    value={field.value ?? ''}
                                                    maxLength={40}
                                                    placeholder="ex. ใจดี"
                                                    onChange={(event) => field.onChange(event.target.value)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="applicant.nickname"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>ชื่อเล่น</FormLabel>
                                            <FormControl>
                                                <Input
                                                    value={field.value ?? ''}
                                                    maxLength={40}
                                                    placeholder="ex. ชาย"
                                                    onChange={(event) => field.onChange(event.target.value)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <FormField
                                    control={form.control}
                                    name="applicant.nationalId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>เลขที่บัตรประชาชน<span className="text-destructive ml-1">*</span></FormLabel>
                                            <FormControl>
                                                <Input
                                                    value={field.value ?? ''}
                                                    maxLength={13}
                                                    inputMode="numeric"
                                                    placeholder="ex. 1234567890123"
                                                    onChange={(event) =>
                                                        field.onChange(event.target.value.replace(/\D/g, '').slice(0, 13))
                                                    }
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="applicant.nationalIdIssueDate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>วันที่ออกบัตรประชาชน<span className="text-destructive ml-1">*</span></FormLabel>
                                            <FormControl>
                                                <DateWheelPicker
                                                    ref={field.ref}
                                                    value={field.value ?? undefined}
                                                    onChange={field.onChange}
                                                    fromYear={CURRENT_YEAR - 30}
                                                    toYear={CURRENT_YEAR}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="applicant.nationalIdExpiryDate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>วันที่บัตรประชาชนหมดอายุ<span className="text-destructive ml-1">*</span></FormLabel>
                                            <FormControl>
                                                <DateWheelPicker
                                                    ref={field.ref}
                                                    value={field.value ?? undefined}
                                                    onChange={field.onChange}
                                                    fromYear={CURRENT_YEAR}
                                                    toYear={CURRENT_YEAR + 20}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <FormField
                                    control={form.control}
                                    name="applicant.dateOfBirth"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>วัน/เดือน/ปีเกิด<span className="text-destructive ml-1">*</span></FormLabel>
                                            <FormControl>
                                                <DateWheelPicker
                                                    ref={field.ref}
                                                    value={field.value ?? undefined}
                                                    onChange={field.onChange}
                                                    fromYear={CURRENT_YEAR - 80}
                                                    toYear={CURRENT_YEAR}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="applicant.age"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>อายุ (ปี)<span className="text-destructive ml-1">*</span></FormLabel>
                                            <FormControl>
                                                <Input value={field.value?.toString() ?? ''} readOnly />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="applicant.height"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>ส่วนสูง (ซม.)<span className="text-destructive ml-1">*</span></FormLabel>
                                            <FormControl>
                                                <Input
                                                    value={field.value !== undefined ? String(field.value) : ''}
                                                    inputMode="numeric"
                                                    maxLength={3}
                                                    placeholder="ex. 175"
                                                    onChange={(event) =>
                                                        field.onChange(event.target.value.replace(/\D/g, '').slice(0, 3))
                                                    }
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="applicant.weight"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>น้ำหนัก (กก.)<span className="text-destructive ml-1">*</span></FormLabel>
                                            <FormControl>
                                                <Input
                                                    value={field.value !== undefined ? String(field.value) : ''}
                                                    inputMode="numeric"
                                                    maxLength={3}
                                                    placeholder="ex. 70"
                                                    onChange={(event) =>
                                                        field.onChange(event.target.value.replace(/\D/g, '').slice(0, 3))
                                                    }
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <FormField
                                    control={form.control}
                                    name="applicant.race"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>เชื้อชาติ<span className="text-destructive ml-1">*</span></FormLabel>
                                            <FormControl>
                                                <Input
                                                    value={field.value ?? ''}
                                                    maxLength={40}
                                                    placeholder="ex. ไทย"
                                                    onChange={(event) => field.onChange(event.target.value)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="applicant.nationality"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>สัญชาติ<span className="text-destructive ml-1">*</span></FormLabel>
                                            <FormControl>
                                                <Input
                                                    value={field.value ?? ''}
                                                    maxLength={40}
                                                    placeholder="ex. ไทย"
                                                    onChange={(event) => field.onChange(event.target.value)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="applicant.religion"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>ศาสนา<span className="text-destructive ml-1">*</span></FormLabel>
                                            <FormControl>
                                                <Input
                                                    value={field.value ?? ''}
                                                    maxLength={40}
                                                    placeholder="ex. พุทธ"
                                                    onChange={(event) => field.onChange(event.target.value)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="applicant.gender"
                                    render={({ field }) => (
                                        <FormItem className="space-y-3">
                                            <FormLabel>เพศ<span className="text-destructive ml-1">*</span></FormLabel>
                                            <FormControl>
                                                <RadioGroup
                                                    ref={field.ref}
                                                    className="flex items-center gap-4"
                                                    onValueChange={field.onChange}
                                                    value={field.value ?? undefined}
                                                >
                                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                                        <FormControl><RadioGroupItem value="male" /></FormControl>
                                                        <FormLabel className="font-normal">ชาย</FormLabel>
                                                    </FormItem>
                                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                                        <FormControl><RadioGroupItem value="female" /></FormControl>
                                                        <FormLabel className="font-normal">หญิง</FormLabel>
                                                    </FormItem>
                                                </RadioGroup>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="applicant.maritalStatus"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>สถานภาพ<span className="text-destructive ml-1">*</span></FormLabel>
                                            <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                                                <FormControl>
                                                    <SelectTrigger ref={field.ref}>
                                                        <SelectValue placeholder="เลือกสถานภาพ..." />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="single">โสด</SelectItem>
                                                    <SelectItem value="married">แต่งงาน</SelectItem>
                                                    <SelectItem value="widowed">หม้าย</SelectItem>
                                                    <SelectItem value="divorced">หย่าร้าง</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <FormField
                                    control={form.control}
                                    name="applicant.mobilePhone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>เบอร์โทรศัพท์มือถือ<span className="text-destructive ml-1">*</span></FormLabel>
                                            <FormControl>
                                                <Input
                                                    value={field.value ?? ''}
                                                    type="tel"
                                                    maxLength={10}
                                                    placeholder="ex. 0812345678"
                                                    onChange={(event) =>
                                                        field.onChange(event.target.value.replace(/\D/g, '').slice(0, 10))
                                                    }
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="applicant.homePhone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>เบอร์โทรศัพท์บ้าน<span className="text-muted-foreground ml-1 font-normal">(ถ้ามี)</span></FormLabel>
                                            <FormControl>
                                                <Input
                                                    value={field.value ?? ''}
                                                    type="tel"
                                                    maxLength={15}
                                                    placeholder="ex. 021234567"
                                                    onChange={(event) => field.onChange(event.target.value)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="applicant.email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>อีเมล <span className="text-destructive">*</span></FormLabel>
                                            <FormControl>
                                                <Input
                                                    value={field.value ?? ''}
                                                    type="email"
                                                    placeholder="ex. user@example.com"
                                                    onChange={(event) => field.onChange(event.target.value)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>
                        {/* Current Address */}
                        <div className="space-y-4 border-b pb-6">
                            <h4 className="text-md font-semibold">ที่อยู่ปัจจุบัน</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <FormField
                                    control={form.control}
                                    name="applicant.currentAddress.houseNo"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>บ้านเลขที่<span className="text-destructive ml-1">*</span></FormLabel>
                                            <FormControl>
                                                <Input
                                                    value={field.value ?? ''}
                                                    placeholder="ex. 123/45"
                                                    onChange={(event) => field.onChange(event.target.value)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="applicant.currentAddress.moo"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>หมู่ที่<span className="text-muted-foreground ml-1 font-normal">(ถ้ามี)</span></FormLabel>
                                            <FormControl>
                                                <Input
                                                    value={field.value ?? ''}
                                                    placeholder="ex. 1"
                                                    onChange={(event) => field.onChange(event.target.value)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="applicant.currentAddress.street"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>ถนน<span className="text-muted-foreground ml-1 font-normal">(ถ้ามี)</span></FormLabel>
                                            <FormControl>
                                                <Input
                                                    value={field.value ?? ''}
                                                    placeholder="ex. วิภาวดีรังสิต"
                                                    onChange={(event) => field.onChange(event.target.value)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="applicant.currentAddress.province"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>จังหวัด<span className="text-destructive ml-1">*</span></FormLabel>
                                            <FormControl>
                                                <SearchableSelect
                                                    ref={field.ref}
                                                    options={provinceOptions}
                                                    value={field.value ?? undefined}
                                                    onChange={(val) => {
                                                        field.onChange(val);
                                                        form.setValue('applicant.currentAddress.district', '');
                                                        form.setValue('applicant.currentAddress.subDistrict', '');
                                                    }}
                                                    placeholder="เลือกจังหวัด..."
                                                    allowClear
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="applicant.currentAddress.district"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>อำเภอ/เขต<span className="text-destructive ml-1">*</span></FormLabel>
                                            <FormControl>
                                                <SearchableSelect
                                                    ref={field.ref}
                                                    options={getDistrictOptions(watchCurrentProvince)}
                                                    value={field.value ?? undefined}
                                                    onChange={(val) => {
                                                        field.onChange(val);
                                                        form.setValue('applicant.currentAddress.subDistrict', '');
                                                    }}
                                                    placeholder={watchCurrentProvince ? "เลือกอำเภอ/เขต..." : "เลือกจังหวัดก่อน"}
                                                    disabled={!watchCurrentProvince}
                                                    allowClear
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="applicant.currentAddress.subDistrict"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>ตำบล/แขวง<span className="text-destructive ml-1">*</span></FormLabel>
                                            <FormControl>
                                                <SearchableSelect
                                                    ref={field.ref}
                                                    options={getSubDistrictOptions(watchCurrentProvince, watchCurrentDistrict)}
                                                    value={field.value ?? undefined}
                                                    onChange={(val) => field.onChange(val)}
                                                    placeholder={watchCurrentDistrict ? "เลือกตำบล/แขวง..." : "เลือกอำเภอ/เขตก่อน"}
                                                    disabled={!watchCurrentDistrict}
                                                    allowClear
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="applicant.currentAddress.postalCode"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>รหัสไปรษณีย์<span className="text-destructive ml-1">*</span></FormLabel>
                                            <FormControl>
                                                <Input
                                                    value={field.value ?? ''}
                                                    inputMode="numeric"
                                                    maxLength={5}
                                                    placeholder="ex. 10900"
                                                    onChange={(event) =>
                                                        field.onChange(event.target.value.replace(/\D/g, '').slice(0, 5))
                                                    }
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
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
                                    <FormField
                                        control={form.control}
                                        name="applicant.permanentAddress.houseNo"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>บ้านเลขที่<span className="text-destructive ml-1">*</span></FormLabel>
                                                <FormControl>
                                                    <Input
                                                        value={field.value ?? ''}
                                                        placeholder="ex. 123/45"
                                                        onChange={(event) => field.onChange(event.target.value)}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="applicant.permanentAddress.moo"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>หมู่ที่<span className="text-muted-foreground ml-1 font-normal">(ถ้ามี)</span></FormLabel>
                                                <FormControl>
                                                    <Input
                                                        value={field.value ?? ''}
                                                        placeholder="ex. 1"
                                                        onChange={(event) => field.onChange(event.target.value)}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="applicant.permanentAddress.street"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>ถนน<span className="text-muted-foreground ml-1 font-normal">(ถ้ามี)</span></FormLabel>
                                                <FormControl>
                                                    <Input
                                                        value={field.value ?? ''}
                                                        placeholder="ex. วิภาวดีรังสิต"
                                                        onChange={(event) => field.onChange(event.target.value)}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="applicant.permanentAddress.province"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>จังหวัด<span className="text-destructive ml-1">*</span></FormLabel>
                                                <FormControl>
                                                    <SearchableSelect
                                                        ref={field.ref}
                                                        options={provinceOptions}
                                                        value={field.value ?? undefined}
                                                        onChange={(val) => {
                                                            field.onChange(val);
                                                            form.setValue('applicant.permanentAddress.district', '');
                                                            form.setValue('applicant.permanentAddress.subDistrict', '');
                                                        }}
                                                        placeholder="เลือกจังหวัด..."
                                                        allowClear
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="applicant.permanentAddress.district"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>อำเภอ/เขต<span className="text-destructive ml-1">*</span></FormLabel>
                                                <FormControl>
                                                    <SearchableSelect
                                                        ref={field.ref}
                                                        options={getDistrictOptions(watchPermanentProvince)}
                                                        value={field.value ?? undefined}
                                                        onChange={(val) => {
                                                            field.onChange(val);
                                                            form.setValue('applicant.permanentAddress.subDistrict', '');
                                                        }}
                                                        placeholder={watchPermanentProvince ? "เลือกอำเภอ/เขต..." : "เลือกจังหวัดก่อน"}
                                                        disabled={!watchPermanentProvince}
                                                        allowClear
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="applicant.permanentAddress.subDistrict"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>ตำบล/แขวง<span className="text-destructive ml-1">*</span></FormLabel>
                                                <FormControl>
                                                    <SearchableSelect
                                                        ref={field.ref}
                                                        options={getSubDistrictOptions(watchPermanentProvince, watchPermanentDistrict)}
                                                        value={field.value ?? undefined}
                                                        onChange={(val) => field.onChange(val)}
                                                        placeholder={watchPermanentDistrict ? "เลือกตำบล/แขวง..." : "เลือกอำเภอ/เขตก่อน"}
                                                        disabled={!watchPermanentDistrict}
                                                        allowClear
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="applicant.permanentAddress.postalCode"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>รหัสไปรษณีย์<span className="text-destructive ml-1">*</span></FormLabel>
                                                <FormControl>
                                                    <Input
                                                        value={field.value ?? ''}
                                                        inputMode="numeric"
                                                        maxLength={5}
                                                        placeholder="ex. 10900"
                                                        onChange={(event) =>
                                                            field.onChange(event.target.value.replace(/\D/g, '').slice(0, 5))
                                                        }
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            )}
                        </div>
                        {/* Other Info */}
                        <div className="space-y-4 pt-6 border-t">
                            <h4 className="text-md font-semibold">ข้อมูลอื่นๆ</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="applicant.residenceType"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>ประเภทที่พักอาศัย<span className="text-destructive ml-1">*</span></FormLabel>
                                            <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                                                <FormControl>
                                                    <SelectTrigger ref={field.ref}>
                                                        <SelectValue placeholder="เลือกประเภท..." />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="own">บ้านตัวเอง</SelectItem>
                                                    <SelectItem value="rent">บ้านเช่า</SelectItem>
                                                    <SelectItem value="dorm">หอพัก</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="applicant.militaryStatus"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>ภาวะทางทหาร<span className="text-destructive ml-1">*</span></FormLabel>
                                            <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                                                <FormControl>
                                                    <SelectTrigger ref={field.ref}>
                                                        <SelectValue placeholder="เลือกสถานะ..." />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="exempt">ยกเว้น</SelectItem>
                                                    <SelectItem value="discharged">ปลดเป็นทหารกองหนุน</SelectItem>
                                                    <SelectItem value="not-drafted">ยังไม่ได้รับการเกณฑ์</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
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
                            <FormField
                                control={form.control}
                                name="applicationDetails.position"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>ตำแหน่งที่ต้องการสมัคร<span className="text-destructive ml-1">*</span></FormLabel>
                                        <FormControl>
                                            <SearchableSelect
                                                ref={field.ref}
                                                options={jobPositionOptions}
                                                value={field.value ?? undefined}
                                                onChange={field.onChange}
                                                placeholder="เลือกตำแหน่ง..."
                                                allowClear
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="applicationDetails.applicationDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>วันที่สมัคร<span className="text-destructive ml-1">*</span></FormLabel>
                                        <FormControl>
                                            <DateWheelPicker
                                                ref={field.ref}
                                                value={field.value ?? undefined}
                                                onChange={field.onChange}
                                                fromYear={CURRENT_YEAR - 1}
                                                toYear={CURRENT_YEAR + 1}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="applicationDetails.criminalRecord"
                            render={({ field }) => (
                                <FormItem className="space-y-3">
                                    <FormLabel>เคยมีประวัติอาชญากรรมหรือไม่<span className="text-destructive ml-1">*</span></FormLabel>
                                    <FormControl>
                                        <RadioGroup
                                            ref={field.ref}
                                            className="flex items-center gap-4"
                                            onValueChange={field.onChange}
                                            value={field.value ?? undefined}
                                        >
                                            <FormItem className="flex items-center space-x-2 space-y-0">
                                                <FormControl><RadioGroupItem value="no" /></FormControl>
                                                <FormLabel className="font-normal">ไม่เคย</FormLabel>
                                            </FormItem>
                                            <FormItem className="flex items-center space-x-2 space-y-0">
                                                <FormControl><RadioGroupItem value="yes" /></FormControl>
                                                <FormLabel className="font-normal">เคย</FormLabel>
                                            </FormItem>
                                        </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {requiresCriminalDetails && (
                            <FormField
                                control={form.control}
                                name="applicationDetails.criminalRecordDetails"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>รายละเอียดประวัติอาชญากรรม<span className="text-destructive ml-1">*</span></FormLabel>
                                        <FormControl>
                                            <Textarea
                                                value={field.value ?? ''}
                                                maxLength={500}
                                                rows={4}
                                                onChange={(event) => field.onChange(event.target.value)}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                        <div className="space-y-4 border-t pt-6">
                            <h4 className="text-md font-semibold">บุคคลที่ติดต่อได้กรณีฉุกเฉิน</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <FormField
                                    control={form.control}
                                    name="applicationDetails.emergencyContact.firstName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>ชื่อ<span className="text-destructive ml-1">*</span></FormLabel>
                                            <FormControl>
                                                <Input
                                                    value={field.value ?? ''}
                                                    maxLength={40}
                                                    onChange={(event) => field.onChange(event.target.value)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="applicationDetails.emergencyContact.lastName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>นามสกุล<span className="text-destructive ml-1">*</span></FormLabel>
                                            <FormControl>
                                                <Input
                                                    value={field.value ?? ''}
                                                    maxLength={40}
                                                    onChange={(event) => field.onChange(event.target.value)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="applicationDetails.emergencyContact.relation"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>ความเกี่ยวข้อง<span className="text-destructive ml-1">*</span></FormLabel>
                                            <FormControl>
                                                <SearchableSelect
                                                    ref={field.ref}
                                                    options={[
                                                        { value: 'พ่อ', label: 'พ่อ' },
                                                        { value: 'แม่', label: 'แม่' },
                                                        { value: 'พี่', label: 'พี่' },
                                                        { value: 'น้อง', label: 'น้อง' },
                                                        { value: 'สามี', label: 'สามี' },
                                                        { value: 'ภรรยา', label: 'ภรรยา' },
                                                        { value: 'อื่นๆ', label: 'อื่นๆ' }
                                                    ]}
                                                    value={field.value ?? undefined}
                                                    onChange={field.onChange}
                                                    placeholder="เลือกความสัมพันธ์..."
                                                    allowClear
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                {watchRelation === 'อื่นๆ' && (
                                    <FormField
                                        control={form.control}
                                        name="applicationDetails.emergencyContact.relationOther"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>โปรดระบุ<span className="text-destructive ml-1">*</span></FormLabel>
                                                <FormControl>
                                                    <Input
                                                        {...field}
                                                        value={field.value ?? ''}
                                                        maxLength={40}
                                                        placeholder="ex. ลุง, เพื่อน"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}
                                <FormField
                                    control={form.control}
                                    name="applicationDetails.emergencyContact.occupation"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>อาชีพ<span className="text-destructive ml-1">*</span></FormLabel>
                                            <FormControl>
                                                <Input
                                                    value={field.value ?? ''}
                                                    maxLength={80}
                                                    onChange={(event) => field.onChange(event.target.value)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="applicationDetails.emergencyContact.mobilePhone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>มือถือ<span className="text-destructive ml-1">*</span></FormLabel>
                                            <FormControl>
                                                <Input
                                                    value={field.value ?? ''}
                                                    inputMode="tel"
                                                    maxLength={10}
                                                    onChange={(event) =>
                                                        field.onChange(event.target.value.replace(/\D/g, '').slice(0, 10))
                                                    }
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline">ข้อมูลยานพาหนะ</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FormField
                            control={form.control}
                            name="vehicle.type"
                            render={({ field }) => (
                                <FormItem className="space-y-3">
                                    <FormLabel>ประเภทพาหนะ<span className="text-destructive ml-1">*</span></FormLabel>
                                    <FormControl>
                                        <RadioGroup
                                            ref={field.ref}
                                            className="flex flex-wrap gap-4"
                                            value={field.value ?? undefined}
                                            onValueChange={field.onChange}
                                        >
                                            {vehicleTypes.map((type) => (
                                                <FormItem key={type.value} className="flex items-center space-x-2 space-y-0">
                                                    <FormControl><RadioGroupItem value={type.value} /></FormControl>
                                                    <FormLabel className="font-normal">{type.label}</FormLabel>
                                                </FormItem>
                                            ))}
                                        </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <FormField
                                control={form.control}
                                name="vehicle.brand"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>ยี่ห้อรถ<span className="text-destructive ml-1">*</span></FormLabel>
                                        <FormControl>
                                            <SearchableSelect
                                                ref={field.ref}
                                                options={vehicleBrandOptions}
                                                value={field.value ?? undefined}
                                                onChange={(value) => field.onChange(value)}
                                                placeholder={watchVehicleType ? 'เลือกยี่ห้อ...' : 'เลือกประเภทก่อน'}
                                                disabled={!watchVehicleType}
                                                allowClear
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            {watchVehicleBrand === 'other' && (
                                <FormField
                                    control={form.control}
                                    name="vehicle.brandOther"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>ระบุยี่ห้อ<span className="text-destructive ml-1">*</span></FormLabel>
                                            <FormControl>
                                                <Input
                                                    value={field.value ?? ''}
                                                    maxLength={80}
                                                    onChange={(event) => field.onChange(event.target.value)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}

                            <FormField
                                control={form.control}
                                name="vehicle.model"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>รุ่นรถ{watchVehicleBrand !== 'other' ? <span className="text-destructive ml-1">*</span> : null}</FormLabel>
                                        <FormControl>
                                            <SearchableSelect
                                                ref={field.ref}
                                                options={vehicleModelOptions}
                                                value={field.value ?? undefined}
                                                onChange={(value) => field.onChange(value)}
                                                placeholder={watchVehicleBrand === 'other' ? 'ระบุรุ่นด้านล่าง' : 'เลือกรุ่น...'}
                                                disabled={!watchVehicleType || !watchVehicleBrand || watchVehicleBrand === 'other'}
                                                allowClear
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            {watchVehicleBrand === 'other' && (
                                <FormField
                                    control={form.control}
                                    name="vehicle.modelOther"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>ระบุรุ่น<span className="text-destructive ml-1">*</span></FormLabel>
                                            <FormControl>
                                                <Input
                                                    value={field.value ?? ''}
                                                    maxLength={80}
                                                    placeholder="ex. X5"
                                                    onChange={(event) => field.onChange(event.target.value)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                            <FormField
                                control={form.control}
                                name="vehicle.year"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>ปี (ค.ศ.)</FormLabel>
                                        <FormControl>
                                            <Input
                                                value={field.value !== undefined ? String(field.value) : ''}
                                                inputMode="numeric"
                                                maxLength={4}
                                                placeholder="ex. 2023"
                                                onChange={(event) =>
                                                    field.onChange(event.target.value.replace(/\D/g, '').slice(0, 4))
                                                }
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="vehicle.plateNo"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>ป้ายทะเบียน</FormLabel>
                                        <FormControl>
                                            <Input
                                                value={field.value ?? ''}
                                                maxLength={20}
                                                placeholder="ex. 1กข 1234"
                                                onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="vehicle.color"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>สี</FormLabel>
                                        <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                                            <FormControl>
                                                <SelectTrigger ref={field.ref}><SelectValue placeholder="เลือกสี..." /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {carColors.map((color) => (
                                                    <SelectItem key={color} value={color}>{color}</SelectItem>
                                                ))}
                                                <SelectItem value="other">อื่นๆ</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            {form.watch('vehicle.color') === 'other' && (
                                <FormField
                                    control={form.control}
                                    name="vehicle.colorOther"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>ระบุสี</FormLabel>
                                            <FormControl>
                                                <Input
                                                    value={field.value ?? ''}
                                                    maxLength={40}
                                                    placeholder="ex. ชมพู"
                                                    onChange={(event) => field.onChange(event.target.value)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline">ข้อมูลผู้ค้ำประกัน</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <FormField control={form.control} name="guarantor.firstName" render={({ field }) => (
                                <FormItem><FormLabel>ชื่อจริง (ผู้ค้ำ)<span className="text-destructive ml-1">*</span></FormLabel><FormControl><Input {...field} value={field.value ?? ''} placeholder="ex. สมหญิง" /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="guarantor.lastName" render={({ field }) => (
                                <FormItem><FormLabel>นามสกุล (ผู้ค้ำ)<span className="text-destructive ml-1">*</span></FormLabel><FormControl><Input {...field} value={field.value ?? ''} placeholder="ex. ใจดี" /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="guarantor.nationalId" render={({ field }) => (
                                <FormItem><FormLabel>เลขที่บัตรประจำตัวประชาชน (ผู้ค้ำ)<span className="text-destructive ml-1">*</span></FormLabel><FormControl><Input {...field} value={field.value ?? ''} maxLength={13} placeholder="ex. 1234567890123" onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ''))} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="guarantor.age" render={({ field }) => (
                                <FormItem><FormLabel>อายุ (ปี)<span className="text-destructive ml-1">*</span></FormLabel><FormControl><Input {...field} value={field.value ?? ''} type="number" onChange={(e) => field.onChange(Number(e.target.value) || undefined)} placeholder="ex. 35" /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="guarantor.race" render={({ field }) => (
                                <FormItem><FormLabel>เชื้อชาติ<span className="text-destructive ml-1">*</span></FormLabel><FormControl><Input {...field} value={field.value ?? ''} placeholder="ex. ไทย" /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="guarantor.nationality" render={({ field }) => (
                                <FormItem><FormLabel>สัญชาติ<span className="text-destructive ml-1">*</span></FormLabel><FormControl><Input {...field} value={field.value ?? ''} placeholder="ex. ไทย" /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="guarantor.phone" render={({ field }) => (
                                <FormItem><FormLabel>เบอร์โทรศัพท์มือถือ (ผู้ค้ำ)<span className="text-destructive ml-1">*</span></FormLabel><FormControl><Input {...field} value={field.value ?? ''} maxLength={10} placeholder="ex. 0812345678" onChange={(e) => field.onChange(e.target.value.replace(/\D/g, '').slice(0, 10))} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="guarantor.occupation" render={({ field }) => (
                                <FormItem><FormLabel>อาชีพ (ผู้ค้ำ)<span className="text-destructive ml-1">*</span></FormLabel><FormControl><Input {...field} value={field.value ?? ''} placeholder="ex. พนักงานบริษัท" /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                        <div className="space-y-4 pt-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold">ที่อยู่ผู้ค้ำประกัน</h4>
                                <FormField
                                    control={form.control}
                                    name="guarantor.isAddressSameAsApplicantCurrent"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                            <FormControl>
                                                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                            </FormControl>
                                            <div className="space-y-1 leading-none">
                                                <FormLabel>ใช้ที่อยู่เดียวกับที่อยู่ปัจจุบันของผู้สมัคร</FormLabel>
                                            </div>
                                        </FormItem>
                                    )}
                                />
                            </div>
                            {!watchGuarantorAddressSame && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <FormField control={form.control} name="guarantor.address.houseNo" render={({ field }) => (<FormItem><FormLabel>บ้านเลขที่<span className="text-destructive ml-1">*</span></FormLabel><FormControl><Input {...field} value={field.value ?? ''} placeholder="ex. 123/45" /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="guarantor.address.moo" render={({ field }) => (<FormItem><FormLabel>หมู่ที่<span className="text-muted-foreground ml-1 font-normal">(ถ้ามี)</span></FormLabel><FormControl><Input {...field} value={field.value ?? ''} placeholder="ex. 1" /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="guarantor.address.street" render={({ field }) => (<FormItem><FormLabel>ถนน<span className="text-muted-foreground ml-1 font-normal">(ถ้ามี)</span></FormLabel><FormControl><Input {...field} value={field.value ?? ''} placeholder="ex. วิภาวดีรังสิต" /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="guarantor.address.province" render={({ field }) => (<FormItem><FormLabel>จังหวัด<span className="text-destructive ml-1">*</span></FormLabel><FormControl><SearchableSelect ref={field.ref} options={provinceOptions} value={field.value ?? undefined} onChange={(val) => { field.onChange(val); form.setValue('guarantor.address.district', ''); form.setValue('guarantor.address.subDistrict', ''); }} allowClear placeholder="เลือกจังหวัด..." /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="guarantor.address.district" render={({ field }) => (<FormItem><FormLabel>อำเภอ/เขต<span className="text-destructive ml-1">*</span></FormLabel><FormControl><SearchableSelect ref={field.ref} options={getDistrictOptions(watchGuarantorProvince)} value={field.value ?? undefined} onChange={(val) => { field.onChange(val); form.setValue('guarantor.address.subDistrict', ''); }} disabled={!watchGuarantorProvince} allowClear placeholder={watchGuarantorProvince ? "เลือกอำเภอ/เขต..." : "เลือกจังหวัดก่อน"} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="guarantor.address.subDistrict" render={({ field }) => (<FormItem><FormLabel>ตำบล/แขวง<span className="text-destructive ml-1">*</span></FormLabel><FormControl><SearchableSelect ref={field.ref} options={getSubDistrictOptions(watchGuarantorProvince, watchGuarantorDistrict)} value={field.value ?? undefined} onChange={(val) => field.onChange(val)} disabled={!watchGuarantorDistrict} allowClear placeholder={watchGuarantorDistrict ? "เลือกตำบล/แขวง..." : "เลือกอำเภอ/เขตก่อน"} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="guarantor.address.postalCode" render={({ field }) => (<FormItem><FormLabel>รหัสไปรษณีย์<span className="text-destructive ml-1">*</span></FormLabel><FormControl><Input {...field} value={field.value ?? ''} maxLength={5} placeholder="ex. 10900" /></FormControl><FormMessage /></FormItem>)} />
                                </div>
                            )}
                        </div>


                        {/* Guarantor Signature */}
                        <div className="space-y-4 pt-6 border-t mt-4">
                            <LegalAgreement
                                title="เงื่อนไขสัญญาค้ำประกัน"
                                content={GUARANTOR_AGREEMENT_CLAUSES}
                                footer="ข้าพเจ้าผู้ค้ำประกันได้อ่านและเข้าใจข้อความในสัญญาค้ำประกันฉบับนี้โดยตลอดแล้วเห็นว่าถูกต้อง จึงได้ลงลายมือชื่อไว้กับบริษัทและพยานไว้เป็นสำคัญ"
                                className="mb-6"
                            />
                            <h4 className="text-sm font-semibold">ลายมือชื่อผู้ค้ำประกัน<span className="text-destructive ml-1">*</span></h4>
                            <FormField
                                control={form.control}
                                name="guarantorSignature"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>ลายเซ็นผู้ค้ำ</FormLabel>
                                        <FormControl>
                                            <SignatureInput
                                                value={field.value}
                                                onChange={field.onChange}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline">อัปโหลดเอกสาร</CardTitle>
                        <CardDescription>กรุณาเซ็นสำเนาถูกต้องและถ่ายรูปให้ชัดเจนก่อนส่ง (JPG, PNG ไม่เกิน 2MB; PDF ไม่เกิน 10MB)</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">

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
                                                        <X className="w-4 h-4" />
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
                                )
                            })}
                        </div>
                        {form.formState.errors.documents && (
                            <p className="text-sm font-medium text-destructive">{form.formState.errors.documents.message}</p>
                        )}

                        {/* Signature */}
                        <div className="space-y-4 border-t pt-6">
                            <LegalAgreement
                                title="เงื่อนไขสัญญาจ้างขนส่ง"
                                content={TRANSPORT_AGREEMENT_CLAUSES}
                                footer="ใจความในสัญญาแล้วเห็นว่าถูกต้องตรงตามเจตนาของคู่สัญญาทั้งสองฝ่าย จึงลงลายมือชื่อไว้ตรงต่อหน้าพยาน"
                                className="mb-6"
                            />
                            <h4 className="text-md font-semibold">ลายมือชื่อผู้สมัคร</h4>
                            <FormField
                                control={form.control}
                                name="signature"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>ลายเซ็น<span className="text-destructive ml-1">*</span></FormLabel>
                                        <FormControl>
                                            <SignatureInput
                                                value={field.value}
                                                onChange={field.onChange}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
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
                        <div className="flex gap-4 w-full justify-end">
                            <Button type="submit" size="lg" disabled={isSubmitting}>
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
                        </div>
                    </CardFooter>
                </Card>
            </form >
        </Form >
    );
}
