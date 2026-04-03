
"use client";

import React, { useState, useEffect, useMemo, useTransition, useRef, useCallback } from "react";
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
    FileClock,
    Download,
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
import { ManifestSchema, EditManifestSchema } from "@/lib/types";

import { requiredDocumentsSchema } from "@/lib/schema";
import { DocumentViewer } from "@/components/dashboard/document-viewer";
import { SignatureInput } from "@/components/ui/signature-input";
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
import { cloneDeepWith } from 'lodash';
import { z } from "zod";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { DateWheelPicker } from "@/components/ui/date-wheel-picker";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
    getDistrictOptions,
    getSubDistrictOptions,
    jobPositionOptions,
    nationalityOptions as baseNationalityOptions,
    provinceOptions as baseProvinceOptions,
    raceOptions as baseRaceOptions,
    religionOptions as baseReligionOptions,
    withOtherOption,
    otherOption,
} from "@/lib/form-options";
import { carColors, getVehicleBrands, getVehicleModels, vehicleTypes } from "@/lib/vehicle-data";


const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB


type ApplicationDetailsProps = {
    application: Manifest;
    readOnly?: boolean;
};

type TempFile = {
    docId: string;
    file: File;
    objectUrl: string; // For client-side preview
    md5?: string; // Pre-calculated MD5 from worker
};

type FileChanges = {
    toUpload: TempFile[];
    toDelete: string[]; // r2Keys
};

type ManifestDocs = NonNullable<Manifest['docs']>;
type FileRefDocKey = Exclude<keyof ManifestDocs, 'insurance'>;

const statusText: Record<VerificationStatus, string> = {
    pending: "รอตรวจสอบ",
    approved: "อนุมัติ",
    rejected: "ปฏิเสธ",
    terminated: "เลิกจ้าง",
};

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const statusVariantMap: Record<VerificationStatus, BadgeVariant> = {
    pending: "default",
    approved: "default",
    rejected: "destructive",
    terminated: "secondary",
};


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
        console.error("safeFetch Error:", errorMessage);
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

function dataURLtoFile(dataurl: string, filename: string): File {
    const arr = dataurl.split(',');
    const match = arr[0].match(/:(.*?);/);
    const mime = match ? match[1] : 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
}

async function getSignedUrl(r2Key: string): Promise<string> {
    const res = await fetch('/api/r2/sign-get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ r2Key }),
    });

    if (!res.ok) {
        throw new Error('Failed to get signed URL');
    }
    const { url } = await res.json();
    return url;
}

// A new component to manage each document group
function DocumentGroup({
    docSchema,
    files, // Combined existing and temp files for display
    onFileUpload,
    onFileDelete,
}: {
    docSchema: typeof requiredDocumentsSchema[0];
    files: ({ type: 'existing', ref: FileRef, displayUrl: string } | { type: 'temp', ref: TempFile, displayUrl: string })[];
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
                        <div key={fileItem.type === 'existing' ? fileItem.ref.r2Key : fileItem.ref.objectUrl} className="flex flex-col gap-2">
                            <div className="relative w-full aspect-video rounded-md overflow-hidden border bg-muted">
                                <DocumentViewer
                                    fileRef={{
                                        r2Key: fileItem.type === 'existing' ? fileItem.ref.r2Key : fileItem.ref.file.name,
                                        mime: fileItem.type === 'existing' ? fileItem.ref.mime : fileItem.ref.file.type,
                                        size: fileItem.type === 'existing' ? fileItem.ref.size : fileItem.ref.file.size,
                                    }}
                                    previewUrl={fileItem.displayUrl}
                                />
                            </div>
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
                                                    const keyToDelete = fileItem.type === 'existing' ? fileItem.ref.r2Key : fileItem.ref.objectUrl;
                                                    onFileUpload(docSchema.id, e.target.files[0], keyToDelete);
                                                    e.target.value = '';
                                                }
                                            }}
                                        />
                                    </label>
                                </Button>
                                <Button size="sm" variant="destructive" type="button" onClick={() => onFileDelete(docSchema.id, fileItem.type === 'existing' ? fileItem.ref.r2Key : fileItem.ref.objectUrl)}>
                                    <Trash2 className="h-4 w-4 mr-1" /> ลบ
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}

            {!hasFile && (
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

// Helper function to sanitize data for the form
// - Only convert null to empty string for TEXT fields
// - Leave dates, numbers, and enum fields as undefined if not set
function sanitizeDataForForm(data: any): any {
    // Fields that should NOT be converted to empty string
    const skipToEmptyString = new Set([
        'nationalIdIssueDate', 'nationalIdExpiryDate', 'dateOfBirth', 'applicationDate',
        'contractDate', 'applicantStartDate',
        'gender', 'maritalStatus', 'residenceType', 'militaryStatus',
        'criminalRecord', 'type', 'brand', 'model', 'color', 'prefix',
        'height', 'weight', 'age', 'year',
        'isPermanentAddressSame', 'isContactAddressSame',
    ]);

    const processValue = (value: any, key?: string): any => {
        if (value === null || value === undefined) {
            // For special fields, keep as undefined
            if (key && skipToEmptyString.has(key)) {
                return undefined;
            }
            // For text fields, convert to empty string
            return '';
        }
        if (value instanceof Date) {
            return value;
        }
        if (Array.isArray(value)) {
            return value.map((item, idx) => processValue(item, String(idx)));
        }
        if (typeof value === 'object') {
            const result: any = {};
            for (const k in value) {
                result[k] = processValue(value[k], k);
            }
            return result;
        }
        return value;
    };

    return processValue(data);
}

const hasR2Key = (value: unknown): value is FileRef =>
    typeof value === 'object' && value !== null && 'r2Key' in value;

const hasInsurancePolicy = (
    value: unknown
): value is { policy?: FileRef } =>
    typeof value === 'object' && value !== null && 'policy' in value;

const CURRENT_YEAR = new Date().getFullYear();

const calculateAge = (date: Date | undefined) => {
    if (!date) return undefined;
    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const monthDiff = today.getMonth() - date.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
        age -= 1;
    }
    return age < 0 ? 0 : age;
};


export function ApplicationDetails({ application: initialApplication, readOnly = false }: ApplicationDetailsProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDownloading, setIsDownloading] = useState<string | null>(null);
    const [editLinkCopied, setEditLinkCopied] = useState(false);
    const applicantName = initialApplication.applicant.fullName;
    const { toast } = useToast();
    const router = useRouter();

    const [fileChanges, setFileChanges] = useState<FileChanges>({ toUpload: [], toDelete: [] });

    // Worker for image compression
    const workerRef = useRef<Worker | null>(null);

    useEffect(() => {
        workerRef.current = new Worker(new URL("@/workers/image-processor.ts", import.meta.url));
        return () => {
            workerRef.current?.terminate();
        };
    }, []);

    const processFileInWorker = (file: File, id: string): Promise<{ file: File; md5: string }> => {
        return new Promise((resolve, reject) => {
            if (!workerRef.current) {
                reject(new Error("Worker not initialized"));
                return;
            }

            const msgHandler = (e: MessageEvent) => {
                if (e.data.id === id) {
                    workerRef.current?.removeEventListener("message", msgHandler);
                    if (e.data.type === "complete") {
                        resolve({ file: e.data.file, md5: e.data.md5 });
                    } else {
                        reject(new Error(e.data.error || "Worker processing failed"));
                    }
                }
            };

            workerRef.current.addEventListener("message", msgHandler);
            workerRef.current.postMessage({ type: "process", id, file });
        });
    };

    const [isStatusPending, startStatusTransition] = useTransition();
    const verificationStatus = initialApplication.status?.verification ?? "pending" as VerificationStatus;

    const sanitizedInitialApplication = useMemo(() => {
        const sanitized = sanitizeDataForForm(initialApplication) as Manifest;

        const parseDateValue = (value: unknown) => {
            if (!value || value === '') return undefined;
            if (value instanceof Date) return value;
            const date = new Date(value as string);
            return Number.isNaN(date.getTime()) ? undefined : date;
        };

        if (sanitized.applicant) {
            const issueDate = parseDateValue(initialApplication.applicant?.nationalIdIssueDate) ?? undefined;
            const expiryDate = parseDateValue(initialApplication.applicant?.nationalIdExpiryDate) ?? undefined;
            const dob = parseDateValue(initialApplication.applicant?.dateOfBirth) ?? undefined;
            (sanitized.applicant as any).nationalIdIssueDate = issueDate;
            (sanitized.applicant as any).nationalIdExpiryDate = expiryDate;
            (sanitized.applicant as any).dateOfBirth = dob;
        }

        if (sanitized.applicationDetails) {
            const applicationDate = parseDateValue(initialApplication.applicationDetails?.applicationDate) ?? undefined;
            (sanitized.applicationDetails as any).applicationDate = applicationDate;
        }

        if (sanitized.guarantor) {
            sanitized.guarantor.contractDate = parseDateValue(initialApplication.guarantor?.contractDate);
            sanitized.guarantor.applicantStartDate = parseDateValue(initialApplication.guarantor?.applicantStartDate);
        }

        if (sanitized.vehicle) {
            const validTypes = vehicleTypes.map((type) => type.value);
            if (!sanitized.vehicle.type || !validTypes.includes(sanitized.vehicle.type as typeof validTypes[number])) {
                sanitized.vehicle.type = undefined;
            }

            const currentType = sanitized.vehicle.type as typeof vehicleTypes[number]['value'] | undefined;

            if (currentType) {
                const brandOptions = getVehicleBrands(currentType);
                const brandValues = brandOptions.map((brand) => brand.value);
                const originalBrand = initialApplication.vehicle?.brand;
                const currentBrand = sanitized.vehicle.brand;

                if (currentBrand && !brandValues.includes(currentBrand)) {
                    sanitized.vehicle.brand = 'other';
                    sanitized.vehicle.brandOther = initialApplication.vehicle?.brandOther || originalBrand || currentBrand;
                }

                const updatedBrand = sanitized.vehicle.brand;
                if (updatedBrand && updatedBrand !== 'other') {
                    const modelOptions = getVehicleModels(currentType, updatedBrand).map((model) => model.value);
                    const currentModel = sanitized.vehicle.model;
                    if (currentModel && !modelOptions.includes(currentModel)) {
                        sanitized.vehicle.model = undefined;
                    }
                    sanitized.vehicle.brandOther = undefined;
                    sanitized.vehicle.modelOther = undefined;
                } else if (updatedBrand === 'other') {
                    sanitized.vehicle.model = undefined;
                }
            } else {
                sanitized.vehicle.brand = undefined;
                sanitized.vehicle.model = undefined;
                sanitized.vehicle.brandOther = undefined;
                sanitized.vehicle.modelOther = undefined;
            }

            const originalColor = initialApplication.vehicle?.color;
            if (originalColor && (!carColors.includes(originalColor) || originalColor === 'other')) {
                sanitized.vehicle.color = 'other';
                sanitized.vehicle.colorOther = initialApplication.vehicle?.colorOther || originalColor;
            }
            if (sanitized.vehicle.color && sanitized.vehicle.color !== 'other') {
                sanitized.vehicle.colorOther = undefined;
            }
        }

        // Strip signatures so they can be populated by useEffect with fetched URLs
        if (sanitized.docs) {
            (sanitized.docs as any).signature = undefined;
            (sanitized.docs as any).guarantorSignature = undefined;
        }

        return sanitized as any;
    }, [initialApplication]);



    // Extend the schema to handle base64 signature strings for the form input
    const ApplicationDetailsSchema = EditManifestSchema.extend({
        docs: EditManifestSchema.shape.docs.unwrap().extend({
            signature: z.string().optional(),
            guarantorSignature: z.string().optional(),
        }).optional(),
    });

    const form = useForm<z.infer<typeof ApplicationDetailsSchema>>({
        resolver: zodResolver(ApplicationDetailsSchema),
        defaultValues: sanitizedInitialApplication as any,
    });

    const {
        handleSubmit,
        control,
        reset,
        formState: { isDirty, errors },
        trigger,
    } = form;

    const watchIsPermanentAddressSame = form.watch('applicant.isPermanentAddressSame');
    const watchVehicleType = form.watch('vehicle.type');
    const watchVehicleBrand = form.watch('vehicle.brand');
    const watchVehicleColor = form.watch('vehicle.color');
    const watchCriminalRecord = form.watch('applicationDetails.criminalRecord');
    const watchDateOfBirth = form.watch('applicant.dateOfBirth');
    const watchRace = form.watch('applicant.race');
    const watchNationality = form.watch('applicant.nationality');
    const watchReligion = form.watch('applicant.religion');
    const watchCurrentProvince = form.watch('applicant.currentAddress.province');
    const watchCurrentDistrict = form.watch('applicant.currentAddress.district');
    const watchCurrentSubDistrict = form.watch('applicant.currentAddress.subDistrict');
    const watchPermanentProvince = form.watch('applicant.permanentAddress.province');
    const watchPermanentDistrict = form.watch('applicant.permanentAddress.district');
    const watchPermanentSubDistrict = form.watch('applicant.permanentAddress.subDistrict');
    const watchGuarantorProvince = form.watch('guarantor.address.province');
    const watchGuarantorDistrict = form.watch('guarantor.address.district');
    const watchGuarantorSubDistrict = form.watch('guarantor.address.subDistrict');

    const raceValueSet = useMemo(
        () => new Set(baseRaceOptions.map((option) => option.value)),
        []
    );
    const nationalityValueSet = useMemo(
        () => new Set(baseNationalityOptions.map((option) => option.value)),
        []
    );
    const religionValueSet = useMemo(
        () => new Set(baseReligionOptions.map((option) => option.value)),
        []
    );
    const provinceValueSet = useMemo(
        () => new Set(baseProvinceOptions.map((option) => option.value)),
        []
    );

    const [isRaceCustom, setIsRaceCustom] = useState(false);
    const [isNationalityCustom, setIsNationalityCustom] = useState(false);
    const [isReligionCustom, setIsReligionCustom] = useState(false);
    const [isCurrentProvinceCustom, setIsCurrentProvinceCustom] = useState(false);
    const [isCurrentDistrictCustom, setIsCurrentDistrictCustom] = useState(false);
    const [isCurrentSubDistrictCustom, setIsCurrentSubDistrictCustom] =
        useState(false);
    const [isPermanentProvinceCustom, setIsPermanentProvinceCustom] =
        useState(false);
    const [isPermanentDistrictCustom, setIsPermanentDistrictCustom] =
        useState(false);
    const [isPermanentSubDistrictCustom, setIsPermanentSubDistrictCustom] =
        useState(false);
    const [isGuarantorProvinceCustom, setIsGuarantorProvinceCustom] =
        useState(false);
    const [isGuarantorDistrictCustom, setIsGuarantorDistrictCustom] =
        useState(false);
    const [isGuarantorSubDistrictCustom, setIsGuarantorSubDistrictCustom] =
        useState(false);

    const raceOptions = useMemo(
        () => withOtherOption(baseRaceOptions, watchRace),
        [watchRace]
    );
    const nationalityOptions = useMemo(
        () => withOtherOption(baseNationalityOptions, watchNationality),
        [watchNationality]
    );
    const religionOptions = useMemo(
        () => withOtherOption(baseReligionOptions, watchReligion),
        [watchReligion]
    );

    const applicantProvinceOptions = useMemo(
        () => withOtherOption(baseProvinceOptions, watchCurrentProvince),
        [watchCurrentProvince]
    );
    const applicantDistrictBaseOptions = useMemo(
        () => getDistrictOptions(watchCurrentProvince),
        [watchCurrentProvince]
    );
    const applicantDistrictOptions = useMemo(
        () =>
            withOtherOption(applicantDistrictBaseOptions, watchCurrentDistrict),
        [applicantDistrictBaseOptions, watchCurrentDistrict]
    );
    const applicantSubDistrictBaseOptions = useMemo(
        () => getSubDistrictOptions(watchCurrentProvince, watchCurrentDistrict),
        [watchCurrentProvince, watchCurrentDistrict]
    );
    const applicantSubDistrictOptions = useMemo(
        () =>
            withOtherOption(
                applicantSubDistrictBaseOptions,
                watchCurrentSubDistrict
            ),
        [applicantSubDistrictBaseOptions, watchCurrentSubDistrict]
    );

    const permanentProvinceOptions = useMemo(
        () => withOtherOption(baseProvinceOptions, watchPermanentProvince),
        [watchPermanentProvince]
    );
    const permanentDistrictBaseOptions = useMemo(
        () => getDistrictOptions(watchPermanentProvince),
        [watchPermanentProvince]
    );
    const permanentDistrictOptions = useMemo(
        () =>
            withOtherOption(
                permanentDistrictBaseOptions,
                watchPermanentDistrict
            ),
        [permanentDistrictBaseOptions, watchPermanentDistrict]
    );
    const permanentSubDistrictBaseOptions = useMemo(
        () =>
            getSubDistrictOptions(
                watchPermanentProvince,
                watchPermanentDistrict
            ),
        [watchPermanentProvince, watchPermanentDistrict]
    );
    const permanentSubDistrictOptions = useMemo(
        () =>
            withOtherOption(
                permanentSubDistrictBaseOptions,
                watchPermanentSubDistrict
            ),
        [permanentSubDistrictBaseOptions, watchPermanentSubDistrict]
    );

    const guarantorProvinceOptions = useMemo(
        () => withOtherOption(baseProvinceOptions, watchGuarantorProvince),
        [watchGuarantorProvince]
    );
    const guarantorDistrictBaseOptions = useMemo(
        () => getDistrictOptions(watchGuarantorProvince),
        [watchGuarantorProvince]
    );
    const guarantorDistrictOptions = useMemo(
        () =>
            withOtherOption(
                guarantorDistrictBaseOptions,
                watchGuarantorDistrict
            ),
        [guarantorDistrictBaseOptions, watchGuarantorDistrict]
    );
    const guarantorSubDistrictBaseOptions = useMemo(
        () =>
            getSubDistrictOptions(
                watchGuarantorProvince,
                watchGuarantorDistrict
            ),
        [watchGuarantorProvince, watchGuarantorDistrict]
    );
    const guarantorSubDistrictOptions = useMemo(
        () =>
            withOtherOption(
                guarantorSubDistrictBaseOptions,
                watchGuarantorSubDistrict
            ),
        [guarantorSubDistrictBaseOptions, watchGuarantorSubDistrict]
    );

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

    useEffect(() => {
        if (watchRace === undefined || watchRace === null) {
            setIsRaceCustom(false);
            return;
        }
        if (watchRace === "") {
            return;
        }
        setIsRaceCustom(!raceValueSet.has(watchRace));
    }, [watchRace, raceValueSet]);

    useEffect(() => {
        if (watchNationality === undefined || watchNationality === null) {
            setIsNationalityCustom(false);
            return;
        }
        if (watchNationality === "") {
            return;
        }
        setIsNationalityCustom(!nationalityValueSet.has(watchNationality));
    }, [watchNationality, nationalityValueSet]);

    useEffect(() => {
        if (watchReligion === undefined || watchReligion === null) {
            setIsReligionCustom(false);
            return;
        }
        if (watchReligion === "") {
            return;
        }
        setIsReligionCustom(!religionValueSet.has(watchReligion));
    }, [watchReligion, religionValueSet]);

    useEffect(() => {
        if (watchCurrentProvince === undefined || watchCurrentProvince === null) {
            setIsCurrentProvinceCustom(false);
            return;
        }
        if (watchCurrentProvince === "") {
            return;
        }
        setIsCurrentProvinceCustom(!provinceValueSet.has(watchCurrentProvince));
    }, [watchCurrentProvince, provinceValueSet]);

    useEffect(() => {
        if (watchCurrentDistrict === undefined || watchCurrentDistrict === null) {
            setIsCurrentDistrictCustom(false);
            return;
        }
        if (watchCurrentDistrict === "") {
            return;
        }
        const exists = applicantDistrictBaseOptions.some(
            (option) => option.value === watchCurrentDistrict
        );
        setIsCurrentDistrictCustom(!exists);
    }, [watchCurrentDistrict, applicantDistrictBaseOptions]);

    useEffect(() => {
        if (
            watchCurrentSubDistrict === undefined ||
            watchCurrentSubDistrict === null
        ) {
            setIsCurrentSubDistrictCustom(false);
            return;
        }
        if (watchCurrentSubDistrict === "") {
            return;
        }
        const exists = applicantSubDistrictBaseOptions.some(
            (option) => option.value === watchCurrentSubDistrict
        );
        setIsCurrentSubDistrictCustom(!exists);
    }, [watchCurrentSubDistrict, applicantSubDistrictBaseOptions]);

    useEffect(() => {
        if (watchPermanentProvince === undefined || watchPermanentProvince === null) {
            setIsPermanentProvinceCustom(false);
            return;
        }
        if (watchPermanentProvince === "") {
            return;
        }
        setIsPermanentProvinceCustom(!provinceValueSet.has(watchPermanentProvince));
    }, [watchPermanentProvince, provinceValueSet]);

    useEffect(() => {
        if (watchPermanentDistrict === undefined || watchPermanentDistrict === null) {
            setIsPermanentDistrictCustom(false);
            return;
        }
        if (watchPermanentDistrict === "") {
            return;
        }
        const exists = permanentDistrictBaseOptions.some(
            (option) => option.value === watchPermanentDistrict
        );
        setIsPermanentDistrictCustom(!exists);
    }, [watchPermanentDistrict, permanentDistrictBaseOptions]);

    useEffect(() => {
        if (
            watchPermanentSubDistrict === undefined ||
            watchPermanentSubDistrict === null
        ) {
            setIsPermanentSubDistrictCustom(false);
            return;
        }
        if (watchPermanentSubDistrict === "") {
            return;
        }
        const exists = permanentSubDistrictBaseOptions.some(
            (option) => option.value === watchPermanentSubDistrict
        );
        setIsPermanentSubDistrictCustom(!exists);
    }, [watchPermanentSubDistrict, permanentSubDistrictBaseOptions]);

    useEffect(() => {
        if (watchGuarantorProvince === undefined || watchGuarantorProvince === null) {
            setIsGuarantorProvinceCustom(false);
            return;
        }
        if (watchGuarantorProvince === "") {
            return;
        }
        setIsGuarantorProvinceCustom(!provinceValueSet.has(watchGuarantorProvince));
    }, [watchGuarantorProvince, provinceValueSet]);

    useEffect(() => {
        if (watchGuarantorDistrict === undefined || watchGuarantorDistrict === null) {
            setIsGuarantorDistrictCustom(false);
            return;
        }
        if (watchGuarantorDistrict === "") {
            return;
        }
        const exists = guarantorDistrictBaseOptions.some(
            (option) => option.value === watchGuarantorDistrict
        );
        setIsGuarantorDistrictCustom(!exists);
    }, [watchGuarantorDistrict, guarantorDistrictBaseOptions]);

    useEffect(() => {
        if (
            watchGuarantorSubDistrict === undefined ||
            watchGuarantorSubDistrict === null
        ) {
            setIsGuarantorSubDistrictCustom(false);
            return;
        }
        if (watchGuarantorSubDistrict === "") {
            return;
        }
        const exists = guarantorSubDistrictBaseOptions.some(
            (option) => option.value === watchGuarantorSubDistrict
        );
        setIsGuarantorSubDistrictCustom(!exists);
    }, [watchGuarantorSubDistrict, guarantorSubDistrictBaseOptions]);

    // This useEffect ensures that if the initialApplication prop changes (e.g., after router.refresh()),
    // the form's default values are updated. This prevents the form from incorrectly
    // thinking it's "dirty" just because new data has arrived from the server.
    useEffect(() => {
        reset(sanitizedInitialApplication);
    }, [sanitizedInitialApplication, reset]);

    useEffect(() => {
        if (watchIsPermanentAddressSame) {
            const currentAddress = form.getValues('applicant.currentAddress');
            if (currentAddress) {
                form.setValue('applicant.permanentAddress', { ...currentAddress }, { shouldDirty: true });
            }
        }
    }, [watchIsPermanentAddressSame, form]);

    useEffect(() => {
        const dobValue = watchDateOfBirth;
        const parsedDob = dobValue instanceof Date ? dobValue : dobValue ? new Date(dobValue) : undefined;
        const computedAge = calculateAge(parsedDob);
        form.setValue('applicant.age', computedAge, { shouldDirty: false, shouldValidate: false });
    }, [watchDateOfBirth, form]);

    useEffect(() => {
        if (!watchVehicleType) {
            if (form.getValues('vehicle.brand') !== undefined) {
                form.setValue('vehicle.brand', undefined, { shouldDirty: true });
            }
            if (form.getValues('vehicle.brandOther')) {
                form.setValue('vehicle.brandOther', '', { shouldDirty: true });
            }
            if (form.getValues('vehicle.model') !== undefined) {
                form.setValue('vehicle.model', undefined, { shouldDirty: true });
            }
            if (form.getValues('vehicle.modelOther')) {
                form.setValue('vehicle.modelOther', '', { shouldDirty: true });
            }
            return;
        }

        const brandValues = getVehicleBrands(watchVehicleType).map((brand) => brand.value);
        const currentBrand = form.getValues('vehicle.brand');
        if (currentBrand && !brandValues.includes(currentBrand)) {
            form.setValue('vehicle.brand', undefined, { shouldDirty: true });
            if (form.getValues('vehicle.brandOther')) {
                form.setValue('vehicle.brandOther', '', { shouldDirty: true });
            }
            if (form.getValues('vehicle.model') !== undefined) {
                form.setValue('vehicle.model', undefined, { shouldDirty: true });
            }
            if (form.getValues('vehicle.modelOther')) {
                form.setValue('vehicle.modelOther', '', { shouldDirty: true });
            }
        }
    }, [watchVehicleType, form]);

    useEffect(() => {
        if (!watchVehicleBrand) {
            if (form.getValues('vehicle.brandOther')) {
                form.setValue('vehicle.brandOther', '', { shouldDirty: true });
            }
            if (form.getValues('vehicle.model')) {
                form.setValue('vehicle.model', undefined, { shouldDirty: true });
            }
            if (form.getValues('vehicle.modelOther')) {
                form.setValue('vehicle.modelOther', '', { shouldDirty: true });
            }
            return;
        }

        if (watchVehicleBrand === 'other') {
            if (form.getValues('vehicle.model')) {
                form.setValue('vehicle.model', undefined, { shouldDirty: true });
            }
            return;
        }

        if (watchVehicleType) {
            const modelValues = getVehicleModels(watchVehicleType, watchVehicleBrand).map((model) => model.value);
            const currentModel = form.getValues('vehicle.model');
            if (currentModel && !modelValues.includes(currentModel)) {
                form.setValue('vehicle.model', undefined, { shouldDirty: true });
            }
        }

        if (form.getValues('vehicle.brandOther')) {
            form.setValue('vehicle.brandOther', '', { shouldDirty: true });
        }
        if (form.getValues('vehicle.modelOther')) {
            form.setValue('vehicle.modelOther', '', { shouldDirty: true });
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

    // Revoke object URLs on cleanup
    useEffect(() => {
        return () => {
            fileChanges.toUpload.forEach(tempFile => URL.revokeObjectURL(tempFile.objectUrl));
        };
    }, [fileChanges.toUpload]);


    const handleCancel = () => {
        reset(sanitizedInitialApplication); // Reset form to initial sanitized values
        setFileChanges({ toUpload: [], toDelete: [] }); // Reset file changes
        toast({ title: 'ยกเลิกการเปลี่ยนแปลง', description: 'ข้อมูลกลับเป็นเหมือนเดิมแล้ว' });
    };

    const handleFileUpload = async (docId: string, file: File, replaceKey?: string) => {
        toast({ title: "กำลังประมวลผลไฟล์...", description: "กรุณารอสักครู่..." });

        let fileToUpload = file;
        let md5 = undefined;

        try {
            const processed = await processFileInWorker(file, docId);
            fileToUpload = processed.file;
            md5 = processed.md5;

            // Validate Size
            const isImage = fileToUpload.type.startsWith('image/');
            const limit = isImage ? MAX_IMAGE_SIZE : 10 * 1024 * 1024; // 5MB for images, 10MB for others (PDF)

            if (fileToUpload.size > limit) {
                toast({ variant: "destructive", title: "ไฟล์มีขนาดใหญ่เกินไป", description: `ขนาดไฟล์ต้องไม่เกิน ${limit / (1024 * 1024)}MB` });
                return;
            }

            toast({ title: "ประมวลผลสำเร็จ", description: `ขนาด: ${(fileToUpload.size / 1024).toFixed(0)}KB` });

        } catch (error) {
            console.error("Image processing/MD5 failed:", error);
            // Fallback: If worker fails, we continue with original file. 
            // MD5 will be calculated in onSubmit if missing.
            toast({ variant: "destructive", title: "การประมวลผลล้มเหลว", description: "จะลองใช้วิธีปกติ" });
        }

        const objectUrl = URL.createObjectURL(fileToUpload);
        const newTempFile: TempFile = { docId, file: fileToUpload, objectUrl, md5 };

        setFileChanges(prev => {
            let newUploads = [...prev.toUpload];
            let newDeletes = [...prev.toDelete];

            const allowMultiple = false; // No longer multiple

            if (replaceKey) {
                // If replacing an existing file, add its r2Key to toDelete
                if (Object.values(initialApplication.docs || {}).flat().some(f => f && typeof f === 'object' && 'r2Key' in f && f.r2Key === replaceKey)) {
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
        trigger(); // Mark form as dirty
    };

    // Fetch existing signatures
    useEffect(() => {
        const fetchSignatures = async () => {
            if (initialApplication.docs?.signature && hasR2Key(initialApplication.docs.signature) && !form.getValues('docs.signature')) {
                try {
                    const url = await getSignedUrl(initialApplication.docs.signature.r2Key);
                    form.setValue('docs.signature', url, { shouldDirty: false });
                } catch (e) {
                    console.error("Failed to load signature", e);
                }
            }

            if (initialApplication.docs?.guarantorSignature && hasR2Key(initialApplication.docs.guarantorSignature) && !form.getValues('docs.guarantorSignature')) {
                try {
                    const url = await getSignedUrl(initialApplication.docs.guarantorSignature.r2Key);
                    form.setValue('docs.guarantorSignature', url, { shouldDirty: false });
                } catch (e) {
                    console.error("Failed to load guarantor signature", e);
                }
            }
        };
        fetchSignatures();
    }, [initialApplication.docs, form]);


    const onSubmit = async (values: z.infer<typeof ApplicationDetailsSchema>) => {
        setIsSubmitting(true);

        const newManifest = JSON.parse(JSON.stringify(values)) as Manifest;
        if (!newManifest.docs) {
            newManifest.docs = {};
        }

        if (newManifest.applicant) {
            const applicant = newManifest.applicant;
            const dobValue = values.applicant?.dateOfBirth;
            const dob = dobValue instanceof Date ? dobValue : dobValue ? new Date(dobValue as unknown as string) : undefined;
            const computedAge = calculateAge(dob);
            applicant.age = computedAge;
            applicant.fullName = `${values.applicant?.firstName || ''} ${values.applicant?.lastName || ''}`.trim();

            if (applicant.isPermanentAddressSame && applicant.currentAddress) {
                applicant.permanentAddress = { ...applicant.currentAddress };
            }
        }

        if (newManifest.applicationDetails) {
            if (newManifest.applicationDetails.criminalRecord !== 'yes') {
                newManifest.applicationDetails.criminalRecordDetails = undefined;
            }
        }

        if (newManifest.guarantor) {
            newManifest.guarantor.fullName = `${values.guarantor?.firstName || ''} ${values.guarantor?.lastName || ''}`.trim() || undefined;
        }

        if (newManifest.vehicle) {
            const vehicle = newManifest.vehicle as Manifest['vehicle'];
            if (!vehicle.type) {
                vehicle.type = undefined;
                vehicle.brand = undefined;
                vehicle.brandOther = undefined;
                vehicle.model = undefined;
                vehicle.modelOther = undefined;
            } else if (vehicle.brand !== 'other') {
                vehicle.brandOther = undefined;
                vehicle.modelOther = undefined;
            } else {
                vehicle.model = undefined;
            }

            if (vehicle.color !== 'other') {
                vehicle.colorOther = undefined;
            }

            if (typeof vehicle.year === 'number' && Number.isNaN(vehicle.year)) {
                vehicle.year = undefined;
            }
            if (typeof vehicle.brandOther === 'string') {
                vehicle.brandOther = vehicle.brandOther.trim();
                if (!vehicle.brandOther) {
                    vehicle.brandOther = undefined;
                }
            }
            if (typeof vehicle.modelOther === 'string') {
                vehicle.modelOther = vehicle.modelOther.trim();
                if (!vehicle.modelOther) {
                    vehicle.modelOther = undefined;
                }
            }
            if (typeof vehicle.plateNo === 'string') {
                vehicle.plateNo = vehicle.plateNo.trim().toUpperCase();
                if (!vehicle.plateNo) {
                    vehicle.plateNo = undefined;
                }
            }
            if (typeof vehicle.colorOther === 'string') {
                vehicle.colorOther = vehicle.colorOther.trim();
                if (!vehicle.colorOther) {
                    vehicle.colorOther = undefined;
                }
            }
        }

        // Handle Signature Uploads
        // We create a separate list for signatures to upload them alongside normal files
        const signatureFiles: TempFile[] = [];
        const keysToDelete = [...fileChanges.toDelete];

        // Cast values to any because we use a local schema override for base64 strings
        const formValues = values as any;

        // Process Applicant Signature
        if (formValues.docs?.signature && typeof formValues.docs.signature === 'string' && formValues.docs.signature.startsWith('data:image')) {
            const file = dataURLtoFile(formValues.docs.signature, `signature_${initialApplication.appId}.png`);
            signatureFiles.push({ docId: 'signature', file, objectUrl: '' });

            // [FIX] If replacing an existing signature, delete the old one
            if (initialApplication.docs?.signature && hasR2Key(initialApplication.docs.signature)) {
                if (!keysToDelete.includes(initialApplication.docs.signature.r2Key)) {
                    keysToDelete.push(initialApplication.docs.signature.r2Key);
                }
            }
        }

        // Process Guarantor Signature
        if (formValues.docs?.guarantorSignature && typeof formValues.docs.guarantorSignature === 'string' && formValues.docs.guarantorSignature.startsWith('data:image')) {
            const file = dataURLtoFile(formValues.docs.guarantorSignature, `guarantor_signature_${initialApplication.appId}.png`);
            signatureFiles.push({ docId: 'guarantorSignature', file, objectUrl: '' });

            // [FIX] If replacing an existing signature, delete the old one
            if (initialApplication.docs?.guarantorSignature && hasR2Key(initialApplication.docs.guarantorSignature)) {
                if (!keysToDelete.includes(initialApplication.docs.guarantorSignature.r2Key)) {
                    keysToDelete.push(initialApplication.docs.guarantorSignature.r2Key);
                }
            }
        }

        // Combine regular file uploads with signature uploads
        const filesToUpload = [...fileChanges.toUpload, ...signatureFiles];
        // keysToDelete initialized above

        // Handle Unchanged Signatures (Revert URL string to FileRef)
        // If docs.signature is a string but NOT a data URL, it's the signed URL we fetched.
        // We must revert it to the original FileRef for the manifest.
        if (newManifest.docs && typeof newManifest.docs.signature === 'string' && !(newManifest.docs.signature as unknown as string).startsWith('data:')) {
            // It's a URL, revert to original
            newManifest.docs.signature = initialApplication.docs?.signature;
        }
        if (newManifest.docs && typeof newManifest.docs.guarantorSignature === 'string' && !(newManifest.docs.guarantorSignature as unknown as string).startsWith('data:')) {
            newManifest.docs.guarantorSignature = initialApplication.docs?.guarantorSignature;
        }

        // Handle Deleted Signatures
        // If form value is undefined but initial was present, it was cleared.
        // Add old key to delete list
        if (initialApplication.docs?.signature && !formValues.docs?.signature) {
            if (hasR2Key(initialApplication.docs.signature) && !keysToDelete.includes(initialApplication.docs.signature.r2Key)) {
                keysToDelete.push(initialApplication.docs.signature.r2Key);
            }
        }
        if (initialApplication.docs?.guarantorSignature && !formValues.docs?.guarantorSignature) {
            if (hasR2Key(initialApplication.docs.guarantorSignature) && !keysToDelete.includes(initialApplication.docs.guarantorSignature.r2Key)) {
                keysToDelete.push(initialApplication.docs.guarantorSignature.r2Key);
            }
        }

        try {
            // Step 1: Upload new files
            const uploadPromises = filesToUpload.map(async tempFile => {
                const { docId, file, md5: preCalculatedMd5 } = tempFile;
                toast({ title: 'กำลังอัปโหลด...', description: file.name });
                try {
                    const md5 = preCalculatedMd5 || await md5Base64(file);

                    // Determine docType (Use ID for R2 Key to avoid Thai characters)
                    let r2Folder = 'other';
                    if (docId === 'signature') r2Folder = 'signature';
                    else if (docId === 'guarantorSignature') r2Folder = 'guarantor_signature';
                    else {
                        const docSchema = requiredDocumentsSchema.find(d => d.id === docId);
                        if (docSchema) r2Folder = docSchema.id;
                        else if (docId.startsWith('signature')) r2Folder = 'signature';
                        else r2Folder = docId; // Fallback to docId itself which is usually english
                    }

                    const signResponse = await safeFetch('/api/r2/sign-put-applicant', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            applicationId: initialApplication.appId, docType: r2Folder, fileName: file.name,
                            mime: file.type, size: file.size, md5,
                        }),
                    });

                    const { url, key } = await signResponse.json();

                    await safeFetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type, 'Content-MD5': md5 } });

                    const newFileRef: FileRef = { r2Key: key, mime: file.type, size: file.size, md5 };
                    toast({ title: 'อัปโหลดสำเร็จ!', description: file.name, variant: 'default' });
                    return { docId, ref: newFileRef };
                } catch (error: any) {
                    toast({ variant: 'destructive', title: `อัปโหลด ${file.name} ล้มเหลว`, description: (error as Error).message });
                    throw error;
                }
            });

            const uploadResults = await Promise.all(uploadPromises);

            // Step 2: Assemble the new manifest.docs object
            const docs: ManifestDocs = (newManifest.docs ??
                (newManifest.docs = {} as ManifestDocs));

            // Start with existing docs that are NOT marked for deletion
            for (const key of Object.keys(docs) as (keyof ManifestDocs)[]) {
                const docValue = docs[key];
                if (hasR2Key(docValue)) {
                    if (fileChanges.toDelete.includes(docValue.r2Key)) {
                        delete docs[key];
                    }
                } else if (key === 'insurance' && docValue && hasInsurancePolicy(docValue)) {
                    if (docValue.policy && fileChanges.toDelete.includes(docValue.policy.r2Key)) {
                        delete docValue.policy;
                    }
                }
            }


            // Add the newly uploaded files
            const docMapping: Partial<Record<string, FileRefDocKey>> = {
                "doc-citizen-id": "citizenIdCopy",
                "doc-drivers-license": "driverLicenseCopy",
                "doc-house-reg": "houseRegCopy",
                "doc-car-reg": "carRegCopy",
                "doc-car-photo": "carPhoto",
                "doc-bank-account": "kbankBookFirstPage",
                "doc-tax-act": "taxAndPRB",
                "doc-guarantor-citizen-id": "guarantorCitizenIdCopy",
                "doc-guarantor-house-reg": "guarantorHouseRegCopy",
            };

            for (const { docId, ref } of uploadResults) {
                if (docId === 'doc-insurance') {
                    if (!docs.insurance) docs.insurance = {};
                    docs.insurance.policy = ref;
                } else if (docId === 'signature') {
                    docs.signature = ref;
                } else if (docId === 'guarantorSignature') {
                    docs.guarantorSignature = ref;
                } else {
                    const mappedKey = docMapping[docId];
                    if (mappedKey) {
                        docs[mappedKey] = ref as FileRef;
                    }
                }
            }

            // Step 3: Submit the final manifest
            await safeFetch('/api/applications/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ appId: newManifest.appId, manifest: newManifest })
            });
            toast({ title: "บันทึกการเปลี่ยนแปลงสำเร็จ!", description: "ข้อมูลใบสมัครได้รับการอัปเดตแล้ว", variant: "default" });
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

            // Step 5: Refresh server data and reset form state
            router.refresh();
            const newSanitized = sanitizeDataForForm(newManifest);
            reset(newSanitized); // Update the form's default values with the new sanitized data


        } catch (error: any) {
            console.error("onSubmit failed:", error);
            toast({
                variant: "destructive",
                title: "บันทึกข้อมูลล้มเหลว",
                description: (error as Error).message || "เกิดข้อผิดพลาดบางอย่าง กรุณาลองใหม่อีกครั้ง",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const onInvalid = (errors: any) => {
        // Recursively flatten nested error objects to get all error messages
        const getAllErrorMessages = (obj: any, prefix = ''): string[] => {
            const messages: string[] = [];
            for (const key in obj) {
                const fullPath = prefix ? `${prefix}.${key}` : key;
                const value = obj[key];
                if (value?.message) {
                    messages.push(`${fullPath}: ${value.message}`);
                } else if (typeof value === 'object' && value !== null) {
                    messages.push(...getAllErrorMessages(value, fullPath));
                }
            }
            return messages;
        };

        const allErrors = getAllErrorMessages(errors);
        console.error("Form validation failed:", errors);
        console.error("All error messages:", allErrors);

        const firstErrorMessage = allErrors.length > 0
            ? allErrors[0].split(': ')[1] || allErrors[0]
            : "กรุณาตรวจสอบข้อมูลที่กรอกไม่ถูกต้อง";

        toast({
            variant: "destructive",
            title: "บันทึกข้อมูลล้มเหลว",
            description: firstErrorMessage,
        });
    };


    const handleUpdateStatus = (status: VerificationStatus) => {
        startStatusTransition(async () => {
            if (!initialApplication.appId) return;
            const result = await updateApplicationStatus(initialApplication.appId, status);
            if (result.success) {
                toast({
                    title: `อัปเดตสถานะสำเร็จ`,
                    description: `ใบสมัครถูกเปลี่ยนสถานะเป็น "${statusText[status]}"`,
                    variant: "default"
                });
                router.refresh(); // Refresh the page to show the latest data
            } else {
                toast({
                    title: "อัปเดตสถานะล้มเหลว",
                    description: result.error,
                    variant: "destructive"
                });
            }
        });
    };


    const handleDownload = async (filename: string, downloadId: string) => {
        if (isDownloading) return;
        setIsDownloading(downloadId);
        try {
            const response = await fetch('/api/download-form', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename, data: initialApplication }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to download ${filename}`);
            }

            const blob = await response.blob();

            // Try to use the File System Access API for "Save As"
            if ('showSaveFilePicker' in window) {
                try {
                    const handle = await (window as any).showSaveFilePicker({
                        suggestedName: filename,
                        types: [{
                            description: 'PDF Document',
                            accept: { 'application/pdf': ['.pdf'] },
                        }],
                    });
                    const writable = await handle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    toast({
                        title: "ดาวน์โหลดสำเร็จ",
                        description: `บันทึกไฟล์ ${filename} เรียบร้อยแล้ว`,
                        variant: "default"
                    });
                    return; // Exit if successful
                } catch (err: any) {
                    if (err.name === 'AbortError') {
                        // User cancelled the save picker, just return
                        return;
                    }
                    // Fallback to default download if other error
                    console.warn("File System Access API failed, falling back to default download", err);
                }
            }

            // Fallback for browsers not supporting showSaveFilePicker or if it failed
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            toast({
                title: "ดาวน์โหลดสำเร็จ",
                description: `กำลังดาวน์โหลดไฟล์ ${filename}`,
                variant: "default"
            });

        } catch (error: any) {
            console.error(`Download failed for ${filename}:`, error);
            toast({
                variant: 'destructive',
                title: `ดาวน์โหลด ${filename} ล้มเหลว`,
                description: (error as Error).message,
            });
        } finally {
            setIsDownloading(null);
        }
    };


    const getOriginalFileForDocId = (docId: string): FileRef | undefined => {
        const docs = initialApplication.docs;
        if (!docs) return undefined;
        switch (docId) {
            case 'doc-insurance': return docs.insurance?.policy;
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


    type DisplayFile = { type: 'existing', ref: FileRef, displayUrl: string } | { type: 'temp', ref: TempFile, displayUrl: string };

    const getDisplayFiles = useMemo<(docId: string) => DisplayFile[]>(
        () => (docId: string) => {
            const displayFiles: DisplayFile[] = [];
            const tempUploadsForDoc = fileChanges.toUpload.filter(f => f.docId === docId);

            for (const tempFile of tempUploadsForDoc) {
                displayFiles.push({ type: 'temp', ref: tempFile, displayUrl: tempFile.objectUrl });
            }

            const allowMultiple = false;

            const addExistingFile = (fileRef: FileRef | undefined) => {
                if (!fileRef || fileChanges.toDelete.includes(fileRef.r2Key)) {
                    return;
                }
                if (!allowMultiple && fileChanges.toUpload.some(t => t.docId === docId)) {
                    return;
                }
                displayFiles.push({ type: 'existing', ref: fileRef, displayUrl: '' });
            };

            const originalFile = getOriginalFileForDocId(docId);
            if (Array.isArray(originalFile)) {
                originalFile.forEach(addExistingFile);
            } else {
                addExistingFile(originalFile);
            }

            return displayFiles;
        },
        [initialApplication.docs, fileChanges]
    );

    const hasChanges = isDirty || fileChanges.toUpload.length > 0 || fileChanges.toDelete.length > 0;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="font-headline text-2xl">
                                {applicantName || "ผู้สมัครไม่มีชื่อ"}
                            </CardTitle>
                            <CardDescription>รหัสใบสมัคร: {initialApplication.appId}</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge
                                variant={statusVariantMap[verificationStatus]}
                                className="capitalize text-base h-8"
                            >
                                {statusText[verificationStatus]}
                            </Badge>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="font-headline">เอกสารที่สร้างโดยระบบ</CardTitle>
                    <CardDescription>ดูตัวอย่างและดาวน์โหลดเอกสารที่สร้างจากข้อมูลที่กรอก</CardDescription>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Button
                        variant="outline"
                        className="w-full justify-start"
                        type="button"
                        onClick={() => handleDownload(`ใบสมัครงาน_${initialApplication.applicant.firstName} ${initialApplication.applicant.lastName}.pdf`, 'application-form')}
                        disabled={!!isDownloading}
                    >
                        {isDownloading === 'application-form' ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="mr-2 h-4 w-4" />
                        )}
                        ใบสมัครงาน.pdf
                    </Button>
                    <Button
                        variant="outline"
                        className="w-full justify-start"
                        type="button"
                        onClick={() => handleDownload(`สัญญาจ้าง_${initialApplication.applicant.firstName} ${initialApplication.applicant.lastName}.pdf`, 'transport-contract')}
                        disabled={!!isDownloading}
                    >
                        {isDownloading === 'transport-contract' ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="mr-2 h-4 w-4" />
                        )}
                        สัญญาจ้างขนส่ง.pdf
                    </Button>
                    <Button
                        variant="outline"
                        className="w-full justify-start"
                        type="button"
                        onClick={() => handleDownload(`สัญญาค้ำประกัน_${initialApplication.applicant.firstName} ${initialApplication.applicant.lastName}.pdf`, 'guarantee-contract')}
                        disabled={!!isDownloading || !initialApplication.guarantor?.fullName}
                    >
                        {isDownloading === 'guarantee-contract' ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="mr-2 h-4 w-4" />
                        )}
                        สัญญาค้ำประกัน.pdf
                    </Button>
                </CardContent>
            </Card>

            <Form {...form}>
                <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="pb-24 space-y-6">
                    <fieldset disabled={readOnly} className="space-y-6 disabled:opacity-100">
                    <Card>
                        <CardHeader>
                            <CardTitle className="font-headline">ข้อมูลผู้สมัคร</CardTitle>
                            <CardDescription>ฟิลด์ทั้งหมดจากหน้า /apply</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <FormField
                                        control={control}
                                        name="applicant.prefix"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>คำนำหน้าชื่อ<span className="text-destructive ml-1">(จำเป็น)</span></FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value || undefined}>
                                                    <FormControl>
                                                        <SelectTrigger>
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
                                        )}
                                    />
                                    <FormField
                                        control={control}
                                        name="applicant.firstName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>ชื่อจริง<span className="text-destructive ml-1">(จำเป็น)</span></FormLabel>
                                                <FormControl>
                                                    <Input
                                                        {...field}
                                                        value={field.value || ''}
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
                                        control={control}
                                        name="applicant.lastName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>นามสกุล<span className="text-destructive ml-1">(จำเป็น)</span></FormLabel>
                                                <FormControl>
                                                    <Input
                                                        {...field}
                                                        value={field.value || ''}
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
                                        control={control}
                                        name="applicant.nickname"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>ชื่อเล่น</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        {...field}
                                                        value={field.value || ''}
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
                                        control={control}
                                        name="applicant.nationalId"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>เลขบัตรประชาชน<span className="text-destructive ml-1">(จำเป็น)</span></FormLabel>
                                                <FormControl>
                                                    <Input
                                                        {...field}
                                                        value={field.value || ''}
                                                        maxLength={13}
                                                        inputMode="numeric"
                                                        placeholder="ex. 1234567890123"
                                                        onChange={(e) =>
                                                            field.onChange(e.target.value.replace(/\D/g, '').slice(0, 13))
                                                        }
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={control}
                                        name="applicant.nationalIdIssueDate"
                                        render={({ field }) => {
                                            const value = field.value ? (field.value instanceof Date ? field.value : new Date(field.value)) : undefined;
                                            return (
                                                <FormItem>
                                                    <FormLabel>วันที่ออกบัตรประชาชน<span className="text-destructive ml-1">(จำเป็น)</span></FormLabel>
                                                    <FormControl>
                                                        <DateWheelPicker
                                                            value={value}
                                                            onChange={(date) => field.onChange(date ?? undefined)}
                                                            fromYear={CURRENT_YEAR - 30}
                                                            toYear={CURRENT_YEAR}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            );
                                        }}
                                    />
                                    <FormField
                                        control={control}
                                        name="applicant.nationalIdExpiryDate"
                                        render={({ field }) => {
                                            const value = field.value ? (field.value instanceof Date ? field.value : new Date(field.value)) : undefined;
                                            return (
                                                <FormItem>
                                                    <FormLabel>วันที่บัตรประชาชนหมดอายุ<span className="text-destructive ml-1">(จำเป็น)</span></FormLabel>
                                                    <FormControl>
                                                        <DateWheelPicker
                                                            value={value}
                                                            onChange={(date) => field.onChange(date ?? undefined)}
                                                            fromYear={CURRENT_YEAR}
                                                            toYear={CURRENT_YEAR + 20}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            );
                                        }}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <FormField
                                        control={control}
                                        name="applicant.dateOfBirth"
                                        render={({ field }) => {
                                            const value = field.value ? (field.value instanceof Date ? field.value : new Date(field.value)) : undefined;
                                            return (
                                                <FormItem>
                                                    <FormLabel>วัน/เดือน/ปีเกิด<span className="text-destructive ml-1">(จำเป็น)</span></FormLabel>
                                                    <FormControl>
                                                        <DateWheelPicker
                                                            value={value}
                                                            onChange={(date) => field.onChange(date ?? undefined)}
                                                            fromYear={CURRENT_YEAR - 80}
                                                            toYear={CURRENT_YEAR}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            );
                                        }}
                                    />
                                    <FormField
                                        control={control}
                                        name="applicant.age"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>อายุ (ปี)</FormLabel>
                                                <FormControl>
                                                    <Input value={field.value?.toString() ?? ''} readOnly />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={control}
                                        name="applicant.race"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>เชื้อชาติ</FormLabel>
                                                <FormControl>
                                                    <SearchableSelect
                                                        options={raceOptions}
                                                        value={
                                                            field.value
                                                                ? field.value
                                                                : isRaceCustom
                                                                    ? otherOption.value
                                                                    : undefined
                                                        }
                                                        onChange={(value) => {
                                                            if (value === undefined) {
                                                                setIsRaceCustom(false);
                                                                field.onChange('');
                                                                return;
                                                            }
                                                            if (value === otherOption.value) {
                                                                setIsRaceCustom(true);
                                                                form.setValue('applicant.race', '', { shouldDirty: true });
                                                                return;
                                                            }
                                                            setIsRaceCustom(false);
                                                            field.onChange(value);
                                                        }}
                                                        placeholder="เลือกเชื้อชาติ..."
                                                        allowClear
                                                    />
                                                </FormControl>
                                                {isRaceCustom && (
                                                    <FormControl className="mt-2">
                                                        <Input
                                                            value={field.value || ''}
                                                            maxLength={40}
                                                            placeholder="ex. ไทย"
                                                            onChange={(event) =>
                                                                field.onChange(event.target.value)
                                                            }
                                                        />
                                                    </FormControl>
                                                )}
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={control}
                                        name="applicant.nationality"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>สัญชาติ</FormLabel>
                                                <FormControl>
                                                    <SearchableSelect
                                                        options={nationalityOptions}
                                                        value={
                                                            field.value
                                                                ? field.value
                                                                : isNationalityCustom
                                                                    ? otherOption.value
                                                                    : undefined
                                                        }
                                                        onChange={(value) => {
                                                            if (value === undefined) {
                                                                setIsNationalityCustom(false);
                                                                field.onChange('');
                                                                return;
                                                            }
                                                            if (value === otherOption.value) {
                                                                setIsNationalityCustom(true);
                                                                form.setValue('applicant.nationality', '', {
                                                                    shouldDirty: true,
                                                                });
                                                                return;
                                                            }
                                                            setIsNationalityCustom(false);
                                                            field.onChange(value);
                                                        }}
                                                        placeholder="เลือกสัญชาติ..."
                                                        allowClear
                                                    />
                                                </FormControl>
                                                {isNationalityCustom && (
                                                    <FormControl className="mt-2">
                                                        <Input
                                                            value={field.value || ''}
                                                            maxLength={40}
                                                            placeholder="ex. ไทย"
                                                            onChange={(event) =>
                                                                field.onChange(event.target.value)
                                                            }
                                                        />
                                                    </FormControl>
                                                )}
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <FormField
                                        control={control}
                                        name="applicant.religion"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>ศาสนา</FormLabel>
                                                <FormControl>
                                                    <SearchableSelect
                                                        options={religionOptions}
                                                        value={
                                                            field.value
                                                                ? field.value
                                                                : isReligionCustom
                                                                    ? otherOption.value
                                                                    : undefined
                                                        }
                                                        onChange={(value) => {
                                                            if (value === undefined) {
                                                                setIsReligionCustom(false);
                                                                field.onChange('');
                                                                return;
                                                            }
                                                            if (value === otherOption.value) {
                                                                setIsReligionCustom(true);
                                                                form.setValue('applicant.religion', '', {
                                                                    shouldDirty: true,
                                                                });
                                                                return;
                                                            }
                                                            setIsReligionCustom(false);
                                                            field.onChange(value);
                                                        }}
                                                        placeholder="เลือกศาสนา..."
                                                        allowClear
                                                    />
                                                </FormControl>
                                                {isReligionCustom && (
                                                    <FormControl className="mt-2">
                                                        <Input
                                                            value={field.value || ''}
                                                            maxLength={40}
                                                            placeholder="ex. พุทธ"
                                                            onChange={(event) =>
                                                                field.onChange(event.target.value)
                                                            }
                                                        />
                                                    </FormControl>
                                                )}
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={control}
                                        name="applicant.height"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>ส่วนสูง (ซม.)<span className="text-destructive ml-1">(จำเป็น)</span></FormLabel>
                                                <FormControl>
                                                    <Input
                                                        {...field}
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
                                        control={control}
                                        name="applicant.weight"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>น้ำหนัก (กก.)<span className="text-destructive ml-1">(จำเป็น)</span></FormLabel>
                                                <FormControl>
                                                    <Input
                                                        {...field}
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

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                        control={control}
                                        name="applicant.gender"
                                        render={({ field }) => (
                                            <FormItem className="space-y-3">
                                                <FormLabel>เพศ<span className="text-destructive ml-1">(จำเป็น)</span></FormLabel>
                                                <FormControl>
                                                    <RadioGroup
                                                        onValueChange={field.onChange}
                                                        value={field.value || undefined}
                                                        className="flex items-center space-x-4"
                                                    >
                                                        <FormItem className="flex items-center space-x-2 space-y-0">
                                                            <FormControl>
                                                                <RadioGroupItem value="male" />
                                                            </FormControl>
                                                            <FormLabel className="font-normal">ชาย</FormLabel>
                                                        </FormItem>
                                                        <FormItem className="flex items-center space-x-2 space-y-0">
                                                            <FormControl>
                                                                <RadioGroupItem value="female" />
                                                            </FormControl>
                                                            <FormLabel className="font-normal">หญิง</FormLabel>
                                                        </FormItem>
                                                    </RadioGroup>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={control}
                                        name="applicant.maritalStatus"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>สถานภาพ<span className="text-destructive ml-1">(จำเป็น)</span></FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value || undefined}>
                                                    <FormControl>
                                                        <SelectTrigger>
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
                            </div>

                            <div className="space-y-4 border-t pt-6">
                                <h4 className="text-md font-semibold">ที่อยู่ปัจจุบัน</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <FormField control={control} name="applicant.currentAddress.houseNo" render={({ field }) => (
                                        <FormItem><FormLabel>บ้านเลขที่</FormLabel><FormControl><Input {...field} value={field.value || ''} placeholder="ex. 123/45" /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={control} name="applicant.currentAddress.moo" render={({ field }) => (
                                        <FormItem><FormLabel>หมู่ที่</FormLabel><FormControl><Input {...field} value={field.value || ''} placeholder="ex. 1" /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={control} name="applicant.currentAddress.street" render={({ field }) => (
                                        <FormItem><FormLabel>ถนน</FormLabel><FormControl><Input {...field} value={field.value || ''} placeholder="ex. วิภาวดีรังสิต" /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={control} name="applicant.currentAddress.subDistrict" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>ตำบล/แขวง<span className="text-destructive ml-1">(จำเป็น)</span></FormLabel>
                                            <FormControl>
                                                <SearchableSelect
                                                    options={applicantSubDistrictOptions}
                                                    value={
                                                        field.value
                                                            ? field.value
                                                            : isCurrentSubDistrictCustom
                                                                ? otherOption.value
                                                                : undefined
                                                    }
                                                    onChange={(value) => {
                                                        if (value === undefined) {
                                                            setIsCurrentSubDistrictCustom(false);
                                                            field.onChange('');
                                                            return;
                                                        }
                                                        if (value === otherOption.value) {
                                                            setIsCurrentSubDistrictCustom(true);
                                                            form.setValue('applicant.currentAddress.subDistrict', '', {
                                                                shouldDirty: true,
                                                            });
                                                            return;
                                                        }
                                                        setIsCurrentSubDistrictCustom(false);
                                                        field.onChange(value);
                                                    }}
                                                    placeholder="เลือกตำบล/แขวง..."
                                                    allowClear
                                                    disabled={!watchCurrentProvince || !watchCurrentDistrict}
                                                />
                                            </FormControl>
                                            {isCurrentSubDistrictCustom && (
                                                <FormControl className="mt-2">
                                                    <Input
                                                        value={field.value || ''}
                                                        placeholder="ex. จอมพล"
                                                        onChange={(event) => field.onChange(event.target.value)}
                                                    />
                                                </FormControl>
                                            )}
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={control} name="applicant.currentAddress.district" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>อำเภอ/เขต<span className="text-destructive ml-1">(จำเป็น)</span></FormLabel>
                                            <FormControl>
                                                <SearchableSelect
                                                    options={applicantDistrictOptions}
                                                    value={
                                                        field.value
                                                            ? field.value
                                                            : isCurrentDistrictCustom
                                                                ? otherOption.value
                                                                : undefined
                                                    }
                                                    onChange={(value) => {
                                                        if (value === undefined) {
                                                            setIsCurrentDistrictCustom(false);
                                                            field.onChange('');
                                                            return;
                                                        }
                                                        if (value === otherOption.value) {
                                                            setIsCurrentDistrictCustom(true);
                                                            form.setValue('applicant.currentAddress.district', '', {
                                                                shouldDirty: true,
                                                            });
                                                            return;
                                                        }
                                                        setIsCurrentDistrictCustom(false);
                                                        field.onChange(value);
                                                    }}
                                                    placeholder="เลือกอำเภอ/เขต..."
                                                    allowClear
                                                    disabled={!watchCurrentProvince}
                                                />
                                            </FormControl>
                                            {isCurrentDistrictCustom && (
                                                <FormControl className="mt-2">
                                                    <Input
                                                        value={field.value || ''}
                                                        placeholder="ex. จตุจักร"
                                                        onChange={(event) => field.onChange(event.target.value)}
                                                    />
                                                </FormControl>
                                            )}
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={control} name="applicant.currentAddress.province" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>จังหวัด<span className="text-destructive ml-1">(จำเป็น)</span></FormLabel>
                                            <FormControl>
                                                <SearchableSelect
                                                    options={applicantProvinceOptions}
                                                    value={
                                                        field.value
                                                            ? field.value
                                                            : isCurrentProvinceCustom
                                                                ? otherOption.value
                                                                : undefined
                                                    }
                                                    onChange={(value) => {
                                                        if (value === undefined) {
                                                            setIsCurrentDistrictCustom(false);
                                                            setIsCurrentSubDistrictCustom(false);
                                                            form.setValue('applicant.currentAddress.district', '', {
                                                                shouldDirty: true,
                                                            });
                                                            form.setValue('applicant.currentAddress.subDistrict', '', {
                                                                shouldDirty: true,
                                                            });
                                                            setIsCurrentProvinceCustom(false);
                                                            field.onChange('');
                                                            return;
                                                        }
                                                        if (value === otherOption.value) {
                                                            setIsCurrentDistrictCustom(false);
                                                            setIsCurrentSubDistrictCustom(false);
                                                            form.setValue('applicant.currentAddress.district', '', {
                                                                shouldDirty: true,
                                                            });
                                                            form.setValue('applicant.currentAddress.subDistrict', '', {
                                                                shouldDirty: true,
                                                            });
                                                            setIsCurrentProvinceCustom(true);
                                                            form.setValue('applicant.currentAddress.province', '', {
                                                                shouldDirty: true,
                                                            });
                                                            return;
                                                        }
                                                        setIsCurrentDistrictCustom(false);
                                                        setIsCurrentSubDistrictCustom(false);
                                                        form.setValue('applicant.currentAddress.district', '', {
                                                            shouldDirty: true,
                                                        });
                                                        form.setValue('applicant.currentAddress.subDistrict', '', {
                                                            shouldDirty: true,
                                                        });
                                                        setIsCurrentProvinceCustom(false);
                                                        field.onChange(value);
                                                    }}
                                                    placeholder="เลือกจังหวัด..."
                                                    allowClear
                                                />
                                            </FormControl>
                                            {isCurrentProvinceCustom && (
                                                <FormControl className="mt-2">
                                                    <Input
                                                        value={field.value || ''}
                                                        placeholder="ex. กรุงเทพมหานคร"
                                                        onChange={(event) => field.onChange(event.target.value)}
                                                    />
                                                </FormControl>
                                            )}
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={control} name="applicant.currentAddress.postalCode" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>รหัสไปรษณีย์<span className="text-destructive ml-1">(จำเป็น)</span></FormLabel>
                                            <FormControl>
                                                <Input
                                                    {...field}
                                                    value={field.value || ''}
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
                                    )} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <FormField control={control} name="applicant.homePhone" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>โทรศัพท์ (บ้าน)</FormLabel>
                                            <FormControl>
                                                <Input
                                                    {...field}
                                                    value={field.value || ''}
                                                    inputMode="tel"
                                                    maxLength={10}
                                                    placeholder="ex. 021234567"
                                                    onChange={(event) =>
                                                        field.onChange(event.target.value.replace(/\D/g, '').slice(0, 10))
                                                    }
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={control} name="applicant.mobilePhone" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>มือถือ<span className="text-destructive ml-1">(จำเป็น)</span></FormLabel>
                                            <FormControl>
                                                <Input
                                                    {...field}
                                                    value={field.value || ''}
                                                    inputMode="tel"
                                                    maxLength={10}
                                                    placeholder="ex. 0812345678"
                                                    onChange={(event) =>
                                                        field.onChange(event.target.value.replace(/\D/g, '').slice(0, 10))
                                                    }
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={control} name="applicant.email" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>อีเมล</FormLabel>
                                            <FormControl>
                                                <Input
                                                    {...field}
                                                    value={field.value || ''}
                                                    type="email"
                                                    placeholder="ex. email@example.com"
                                                    onChange={(event) => field.onChange(event.target.value)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </div>
                            </div>

                            <div className="space-y-4 border-t pt-6">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-md font-semibold">ที่อยู่ตามทะเบียนบ้าน</h4>
                                    <FormField
                                        control={control}
                                        name="applicant.isPermanentAddressSame"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                                <FormControl>
                                                    <Checkbox
                                                        checked={!!field.value}
                                                        onCheckedChange={(checked) => field.onChange(!!checked)}
                                                    />
                                                </FormControl>
                                                <div className="space-y-1 leading-none">
                                                    <FormLabel>ใช้ที่อยู่เดียวกับที่อยู่ปัจจุบัน</FormLabel>
                                                </div>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                {!watchIsPermanentAddressSame && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <FormField control={control} name="applicant.permanentAddress.houseNo" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>บ้านเลขที่</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        {...field}
                                                        value={field.value || ''}
                                                        placeholder="ex. 123/45"
                                                        onChange={(event) => field.onChange(event.target.value)}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={control} name="applicant.permanentAddress.moo" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>หมู่ที่</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        {...field}
                                                        value={field.value || ''}
                                                        placeholder="ex. 1"
                                                        onChange={(event) => field.onChange(event.target.value)}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={control} name="applicant.permanentAddress.street" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>ถนน</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        {...field}
                                                        value={field.value || ''}
                                                        placeholder="ex. วิภาวดีรังสิต"
                                                        onChange={(event) => field.onChange(event.target.value)}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={control} name="applicant.permanentAddress.subDistrict" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>ตำบล/แขวง<span className="text-destructive ml-1">(จำเป็น)</span></FormLabel>
                                                <FormControl>
                                                    <SearchableSelect
                                                        options={permanentSubDistrictOptions}
                                                        value={
                                                            field.value
                                                                ? field.value
                                                                : isPermanentSubDistrictCustom
                                                                    ? otherOption.value
                                                                    : undefined
                                                        }
                                                        onChange={(value) => {
                                                            if (value === undefined) {
                                                                setIsPermanentSubDistrictCustom(false);
                                                                field.onChange('');
                                                                return;
                                                            }
                                                            if (value === otherOption.value) {
                                                                setIsPermanentSubDistrictCustom(true);
                                                                form.setValue('applicant.permanentAddress.subDistrict', '', {
                                                                    shouldDirty: true,
                                                                });
                                                                return;
                                                            }
                                                            setIsPermanentSubDistrictCustom(false);
                                                            field.onChange(value);
                                                        }}
                                                        placeholder="เลือกตำบล/แขวง..."
                                                        allowClear
                                                        disabled={!watchPermanentProvince || !watchPermanentDistrict}
                                                    />
                                                </FormControl>
                                                {isPermanentSubDistrictCustom && (
                                                    <FormControl className="mt-2">
                                                        <Input
                                                            value={field.value || ''}
                                                            placeholder="ex. จอมพล"
                                                            onChange={(event) => field.onChange(event.target.value)}
                                                        />
                                                    </FormControl>
                                                )}
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={control} name="applicant.permanentAddress.district" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>อำเภอ/เขต<span className="text-destructive ml-1">(จำเป็น)</span></FormLabel>
                                                <FormControl>
                                                    <SearchableSelect
                                                        options={permanentDistrictOptions}
                                                        value={
                                                            field.value
                                                                ? field.value
                                                                : isPermanentDistrictCustom
                                                                    ? otherOption.value
                                                                    : undefined
                                                        }
                                                        onChange={(value) => {
                                                            if (value === undefined) {
                                                                setIsPermanentDistrictCustom(false);
                                                                field.onChange('');
                                                                return;
                                                            }
                                                            if (value === otherOption.value) {
                                                                setIsPermanentDistrictCustom(true);
                                                                form.setValue('applicant.permanentAddress.district', '', {
                                                                    shouldDirty: true,
                                                                });
                                                                return;
                                                            }
                                                            setIsPermanentDistrictCustom(false);
                                                            field.onChange(value);
                                                        }}
                                                        placeholder="เลือกอำเภอ/เขต..."
                                                        allowClear
                                                        disabled={!watchPermanentProvince}
                                                    />
                                                </FormControl>
                                                {isPermanentDistrictCustom && (
                                                    <FormControl className="mt-2">
                                                        <Input
                                                            value={field.value || ''}
                                                            placeholder="ex. จตุจักร"
                                                            onChange={(event) => field.onChange(event.target.value)}
                                                        />
                                                    </FormControl>
                                                )}
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={control} name="applicant.permanentAddress.province" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>จังหวัด<span className="text-destructive ml-1">(จำเป็น)</span></FormLabel>
                                                <FormControl>
                                                    <SearchableSelect
                                                        options={permanentProvinceOptions}
                                                        value={
                                                            field.value
                                                                ? field.value
                                                                : isPermanentProvinceCustom
                                                                    ? otherOption.value
                                                                    : undefined
                                                        }
                                                        onChange={(value) => {
                                                            if (value === undefined) {
                                                                setIsPermanentDistrictCustom(false);
                                                                setIsPermanentSubDistrictCustom(false);
                                                                form.setValue('applicant.permanentAddress.district', '', {
                                                                    shouldDirty: true,
                                                                });
                                                                form.setValue('applicant.permanentAddress.subDistrict', '', {
                                                                    shouldDirty: true,
                                                                });
                                                                setIsPermanentProvinceCustom(false);
                                                                field.onChange('');
                                                                return;
                                                            }
                                                            if (value === otherOption.value) {
                                                                setIsPermanentDistrictCustom(false);
                                                                setIsPermanentSubDistrictCustom(false);
                                                                form.setValue('applicant.permanentAddress.district', '', {
                                                                    shouldDirty: true,
                                                                });
                                                                form.setValue('applicant.permanentAddress.subDistrict', '', {
                                                                    shouldDirty: true,
                                                                });
                                                                setIsPermanentProvinceCustom(true);
                                                                form.setValue('applicant.permanentAddress.province', '', {
                                                                    shouldDirty: true,
                                                                });
                                                                return;
                                                            }
                                                            setIsPermanentDistrictCustom(false);
                                                            setIsPermanentSubDistrictCustom(false);
                                                            form.setValue('applicant.permanentAddress.district', '', {
                                                                shouldDirty: true,
                                                            });
                                                            form.setValue('applicant.permanentAddress.subDistrict', '', {
                                                                shouldDirty: true,
                                                            });
                                                            setIsPermanentProvinceCustom(false);
                                                            field.onChange(value);
                                                        }}
                                                        placeholder="เลือกจังหวัด..."
                                                        allowClear
                                                    />
                                                </FormControl>
                                                {isPermanentProvinceCustom && (
                                                    <FormControl className="mt-2">
                                                        <Input
                                                            value={field.value || ''}
                                                            placeholder="ex. กรุงเทพมหานคร"
                                                            onChange={(event) => field.onChange(event.target.value)}
                                                        />
                                                    </FormControl>
                                                )}
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                        <FormField control={control} name="applicant.permanentAddress.postalCode" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>รหัสไปรษณีย์<span className="text-destructive ml-1">(จำเป็น)</span></FormLabel>
                                                <FormControl>
                                                    <Input
                                                        {...field}
                                                        value={field.value || ''}
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
                                        )} />
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4 border-t pt-6">
                                <h4 className="text-md font-semibold">ข้อมูลอื่นๆ</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                        control={control}
                                        name="applicant.residenceType"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>ประเภทที่พักอาศัย<span className="text-destructive ml-1">(จำเป็น)</span></FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value || undefined}>
                                                    <FormControl>
                                                        <SelectTrigger>
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
                                        control={control}
                                        name="applicant.militaryStatus"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>ภาวะทางทหาร<span className="text-destructive ml-1">(จำเป็น)</span></FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value || undefined}>
                                                    <FormControl>
                                                        <SelectTrigger>
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
                                    control={control}
                                    name="applicationDetails.position"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>ตำแหน่งที่ต้องการสมัคร</FormLabel>
                                            <FormControl>
                                                <SearchableSelect
                                                    options={jobPositionOptions}
                                                    value={field.value || undefined}
                                                    onChange={(value) =>
                                                        field.onChange(value ?? '')
                                                    }
                                                    placeholder="เลือกตำแหน่ง..."
                                                    allowClear
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={control}
                                    name="applicationDetails.applicationDate"
                                    render={({ field }) => {
                                        const value = field.value ? (field.value instanceof Date ? field.value : new Date(field.value)) : undefined;
                                        return (
                                            <FormItem>
                                                <FormLabel>วันที่สมัคร<span className="text-destructive ml-1">(จำเป็น)</span></FormLabel>
                                                <FormControl>
                                                    <DateWheelPicker
                                                        value={value}
                                                        onChange={(date) => field.onChange(date ?? undefined)}
                                                        fromYear={CURRENT_YEAR - 1}
                                                        toYear={CURRENT_YEAR + 1}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        );
                                    }}
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={control}
                                    name="applicationDetails.criminalRecord"
                                    render={({ field }) => (
                                        <FormItem className="space-y-3">
                                            <FormLabel>เคยมีประวัติอาชญากรรมหรือไม่<span className="text-destructive ml-1">(จำเป็น)</span></FormLabel>
                                            <FormControl>
                                                <RadioGroup
                                                    onValueChange={field.onChange}
                                                    value={field.value || undefined}
                                                    className="flex items-center gap-4"
                                                >
                                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                                        <FormControl>
                                                            <RadioGroupItem value="no" />
                                                        </FormControl>
                                                        <FormLabel className="font-normal">ไม่เคย</FormLabel>
                                                    </FormItem>
                                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                                        <FormControl>
                                                            <RadioGroupItem value="yes" />
                                                        </FormControl>
                                                        <FormLabel className="font-normal">เคย</FormLabel>
                                                    </FormItem>
                                                </RadioGroup>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            {requiresCriminalDetails && (
                                <FormField
                                    control={control}
                                    name="applicationDetails.criminalRecordDetails"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>รายละเอียดประวัติอาชญากรรม<span className="text-destructive ml-1">(จำเป็น)</span></FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    {...field}
                                                    value={field.value || ''}
                                                    maxLength={500}
                                                    rows={4}
                                                    placeholder="ex. รายละเอียดคดี..."
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
                                        control={control}
                                        name="applicationDetails.emergencyContact.firstName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>ชื่อ</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        {...field}
                                                        value={field.value || ''}
                                                        maxLength={40}
                                                        placeholder="ex. สมหญิง"
                                                        onChange={(event) => field.onChange(event.target.value)}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={control}
                                        name="applicationDetails.emergencyContact.lastName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>นามสกุล</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        {...field}
                                                        value={field.value || ''}
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
                                        control={control}
                                        name="applicationDetails.emergencyContact.relation"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>ความเกี่ยวข้อง</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        {...field}
                                                        value={field.value || ''}
                                                        maxLength={40}
                                                        placeholder="ex. ภรรยา"
                                                        onChange={(event) => field.onChange(event.target.value)}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={control}
                                        name="applicationDetails.emergencyContact.occupation"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>อาชีพ</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        {...field}
                                                        value={field.value || ''}
                                                        maxLength={80}
                                                        placeholder="ex. ค้าขาย"
                                                        onChange={(event) => field.onChange(event.target.value)}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={control}
                                        name="applicationDetails.emergencyContact.mobilePhone"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>มือถือ</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        {...field}
                                                        value={field.value || ''}
                                                        inputMode="tel"
                                                        maxLength={10}
                                                        placeholder="ex. 0898765432"
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
                                control={control}
                                name="vehicle.type"
                                render={({ field }) => (
                                    <FormItem className="space-y-3">
                                        <FormLabel>ประเภทพาหนะ<span className="text-destructive ml-1">(จำเป็น)</span></FormLabel>
                                        <FormControl>
                                            <RadioGroup
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
                                    control={control}
                                    name="vehicle.brand"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>ยี่ห้อรถ<span className="text-destructive ml-1">(จำเป็น)</span></FormLabel>
                                            <FormControl>
                                                <SearchableSelect
                                                    options={vehicleBrandOptions}
                                                    value={field.value ?? undefined}
                                                    onChange={(value) => field.onChange(value)}
                                                    placeholder={watchVehicleType ? "เลือกยี่ห้อ..." : "เลือกประเภทก่อน"}
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
                                        control={control}
                                        name="vehicle.brandOther"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>ระบุยี่ห้อ<span className="text-destructive ml-1">(จำเป็น)</span></FormLabel>
                                                <FormControl>
                                                    <Input
                                                        {...field}
                                                        value={field.value || ''}
                                                        maxLength={80}
                                                        placeholder="ex. BMW"
                                                        onChange={(event) => field.onChange(event.target.value)}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}

                                <FormField
                                    control={control}
                                    name="vehicle.model"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                รุ่นรถ{watchVehicleBrand !== 'other' ? <span className="text-destructive ml-1">(จำเป็น)</span> : null}
                                            </FormLabel>
                                            <FormControl>
                                                <SearchableSelect
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
                                        control={control}
                                        name="vehicle.modelOther"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>ระบุรุ่น<span className="text-destructive ml-1">(จำเป็น)</span></FormLabel>
                                                <FormControl>
                                                    <Input
                                                        {...field}
                                                        value={field.value || ''}
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
                                    control={control}
                                    name="vehicle.year"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>ปี (ค.ศ.)</FormLabel>
                                            <FormControl>
                                                <Input
                                                    {...field}
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
                                    control={control}
                                    name="vehicle.plateNo"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>ป้ายทะเบียน</FormLabel>
                                            <FormControl>
                                                <Input
                                                    {...field}
                                                    value={field.value || ''}
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
                                    control={control}
                                    name="vehicle.color"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>สี</FormLabel>
                                            <Select value={field.value || undefined} onValueChange={field.onChange}>
                                                <FormControl>
                                                    <SelectTrigger><SelectValue placeholder="เลือกสี..." /></SelectTrigger>
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
                                        control={control}
                                        name="vehicle.colorOther"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>ระบุสี</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        {...field}
                                                        value={field.value || ''}
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
                        <CardHeader><CardTitle className="font-headline">ข้อมูลผู้ค้ำประกัน (ถ้ามี)</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <FormField control={control} name="guarantor.firstName" render={({ field }) => (
                                    <FormItem><FormLabel>ชื่อจริง (ผู้ค้ำ)</FormLabel><FormControl><Input {...field} value={field.value || ''} placeholder="ex. สมหญิง" /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={control} name="guarantor.lastName" render={({ field }) => (
                                    <FormItem><FormLabel>นามสกุล (ผู้ค้ำ)</FormLabel><FormControl><Input {...field} value={field.value || ''} placeholder="ex. ใจดี" /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={control} name="guarantor.nationalId" render={({ field }) => (
                                    <FormItem><FormLabel>เลขบัตรประชาชน (ผู้ค้ำ)</FormLabel><FormControl><Input {...field} value={field.value || ''} maxLength={13} placeholder="ex. 1234567890123" onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ''))} /></FormControl><FormMessage /></FormItem>
                                )} />
                            </div>
                            <div className="space-y-4">
                                <h4 className="text-sm font-semibold">ที่อยู่ผู้ค้ำประกัน</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <FormField control={control} name="guarantor.address.houseNo" render={({ field }) => (
                                        <FormItem><FormLabel>บ้านเลขที่</FormLabel><FormControl><Input {...field} value={field.value || ''} placeholder="ex. 123/45" /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={control} name="guarantor.address.moo" render={({ field }) => (
                                        <FormItem><FormLabel>หมู่ที่</FormLabel><FormControl><Input {...field} value={field.value || ''} placeholder="ex. 1" /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={control} name="guarantor.address.street" render={({ field }) => (
                                        <FormItem><FormLabel>ถนน</FormLabel><FormControl><Input {...field} value={field.value || ''} placeholder="ex. วิภาวดีรังสิต" /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={control} name="guarantor.address.subDistrict" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>ตำบล/แขวง<span className="text-destructive ml-1">(จำเป็น)</span></FormLabel>
                                            <FormControl>
                                                <SearchableSelect
                                                    options={guarantorSubDistrictOptions}
                                                    value={
                                                        field.value
                                                            ? field.value
                                                            : isGuarantorSubDistrictCustom
                                                                ? otherOption.value
                                                                : undefined
                                                    }
                                                    onChange={(value) => {
                                                        if (value === undefined) {
                                                            setIsGuarantorSubDistrictCustom(false);
                                                            field.onChange('');
                                                            return;
                                                        }
                                                        if (value === otherOption.value) {
                                                            setIsGuarantorSubDistrictCustom(true);
                                                            form.setValue('guarantor.address.subDistrict', '', {
                                                                shouldDirty: true,
                                                            });
                                                            return;
                                                        }
                                                        setIsGuarantorSubDistrictCustom(false);
                                                        field.onChange(value);
                                                    }}
                                                    placeholder="เลือกตำบล/แขวง..."
                                                    allowClear
                                                    disabled={!watchGuarantorProvince || !watchGuarantorDistrict}
                                                />
                                            </FormControl>
                                            {isGuarantorSubDistrictCustom && (
                                                <FormControl className="mt-2">
                                                    <Input
                                                        value={field.value || ''}
                                                        placeholder="ex. จอมพล"
                                                        onChange={(event) => field.onChange(event.target.value)}
                                                    />
                                                </FormControl>
                                            )}
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={control} name="guarantor.address.district" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>อำเภอ/เขต<span className="text-destructive ml-1">(จำเป็น)</span></FormLabel>
                                            <FormControl>
                                                <SearchableSelect
                                                    options={guarantorDistrictOptions}
                                                    value={
                                                        field.value
                                                            ? field.value
                                                            : isGuarantorDistrictCustom
                                                                ? otherOption.value
                                                                : undefined
                                                    }
                                                    onChange={(value) => {
                                                        if (value === undefined) {
                                                            setIsGuarantorDistrictCustom(false);
                                                            field.onChange('');
                                                            return;
                                                        }
                                                        if (value === otherOption.value) {
                                                            setIsGuarantorDistrictCustom(true);
                                                            form.setValue('guarantor.address.district', '', {
                                                                shouldDirty: true,
                                                            });
                                                            return;
                                                        }
                                                        setIsGuarantorDistrictCustom(false);
                                                        field.onChange(value);
                                                    }}
                                                    placeholder="เลือกอำเภอ/เขต..."
                                                    allowClear
                                                    disabled={!watchGuarantorProvince}
                                                />
                                            </FormControl>
                                            {isGuarantorDistrictCustom && (
                                                <FormControl className="mt-2">
                                                    <Input
                                                        value={field.value || ''}
                                                        placeholder="ex. จตุจักร"
                                                        onChange={(event) => field.onChange(event.target.value)}
                                                    />
                                                </FormControl>
                                            )}
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={control} name="guarantor.address.province" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>จังหวัด<span className="text-destructive ml-1">(จำเป็น)</span></FormLabel>
                                            <FormControl>
                                                <SearchableSelect
                                                    options={guarantorProvinceOptions}
                                                    value={
                                                        field.value
                                                            ? field.value
                                                            : isGuarantorProvinceCustom
                                                                ? otherOption.value
                                                                : undefined
                                                    }
                                                    onChange={(value) => {
                                                        if (value === undefined) {
                                                            setIsGuarantorDistrictCustom(false);
                                                            setIsGuarantorSubDistrictCustom(false);
                                                            form.setValue('guarantor.address.district', '', {
                                                                shouldDirty: true,
                                                            });
                                                            form.setValue('guarantor.address.subDistrict', '', {
                                                                shouldDirty: true,
                                                            });
                                                            setIsGuarantorProvinceCustom(false);
                                                            field.onChange('');
                                                            return;
                                                        }
                                                        if (value === otherOption.value) {
                                                            setIsGuarantorDistrictCustom(false);
                                                            setIsGuarantorSubDistrictCustom(false);
                                                            form.setValue('guarantor.address.district', '', {
                                                                shouldDirty: true,
                                                            });
                                                            form.setValue('guarantor.address.subDistrict', '', {
                                                                shouldDirty: true,
                                                            });
                                                            setIsGuarantorProvinceCustom(true);
                                                            form.setValue('guarantor.address.province', '', {
                                                                shouldDirty: true,
                                                            });
                                                            return;
                                                        }
                                                        setIsGuarantorDistrictCustom(false);
                                                        setIsGuarantorSubDistrictCustom(false);
                                                        form.setValue('guarantor.address.district', '', {
                                                            shouldDirty: true,
                                                        });
                                                        form.setValue('guarantor.address.subDistrict', '', {
                                                            shouldDirty: true,
                                                        });
                                                        setIsGuarantorProvinceCustom(false);
                                                        field.onChange(value);
                                                    }}
                                                    placeholder="เลือกจังหวัด..."
                                                    allowClear
                                                />
                                            </FormControl>
                                            {isGuarantorProvinceCustom && (
                                                <FormControl className="mt-2">
                                                    <Input
                                                        value={field.value || ''}
                                                        placeholder="ex. กรุงเทพมหานคร"
                                                        onChange={(event) => field.onChange(event.target.value)}
                                                    />
                                                </FormControl>
                                            )}
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField control={control} name="guarantor.address.postalCode" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>รหัสไปรษณีย์<span className="text-destructive ml-1">(จำเป็น)</span></FormLabel>
                                            <FormControl>
                                                <Input
                                                    {...field}
                                                    value={field.value || ''}
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
                                    )} />
                                </div>
                            </div>

                            {/* Guarantor Signature */}
                            <div className="space-y-4 pt-6 border-t mt-4">
                                <h4 className="text-sm font-semibold">ลายมือชื่อผู้ค้ำประกัน</h4>
                                <FormField
                                    control={form.control}
                                    name="docs.guarantorSignature"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>ลายเซ็นผู้ค้ำ</FormLabel>
                                            <FormControl>
                                                <SignatureInput
                                                    value={typeof field.value === 'string' ? field.value : undefined}
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
                            <CardTitle className="font-headline">ตรวจสอบเอกสาร</CardTitle>
                            <CardDescription>เอกสารที่ผู้สมัครอัปโหลด</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {requiredDocumentsSchema.map((reqDoc) => (
                                <DocumentGroup
                                    key={reqDoc.id}
                                    docSchema={reqDoc}
                                    files={getDisplayFiles(reqDoc.id)}
                                    onFileUpload={handleFileUpload}
                                    onFileDelete={handleFileDelete}
                                />
                            ))}

                            <div className="pt-6 border-t mt-4">
                                <h4 className="text-sm font-semibold mb-4">ลายมือชื่อผู้สมัคร</h4>
                                <FormField
                                    control={form.control}
                                    name="docs.signature"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>ลายเซ็นผู้สมัคร</FormLabel>
                                            <FormControl>
                                                <SignatureInput
                                                    value={typeof field.value === 'string' ? field.value : undefined}
                                                    onChange={field.onChange}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </CardContent>
                        {!readOnly && (
                            <CardFooter className="flex-col items-start gap-4">
                                <div className="w-full space-y-4">
                                    <Separator />
                                    <div className="flex justify-between items-center w-full">
                                        <h4 className="font-semibold">การดำเนินการ</h4>
                                        <div className="flex gap-2">
                                            {initialApplication.status?.verification === 'pending' && (
                                                <>
                                                    <Button variant="default" onClick={() => handleUpdateStatus('approved')} disabled={isStatusPending}>
                                                        {isStatusPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                                        อนุมัติใบสมัคร
                                                    </Button>
                                                    <Button variant="destructive" onClick={() => handleUpdateStatus('rejected')} disabled={isStatusPending}>
                                                        {isStatusPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                                                        ปฏิเสธใบสมัคร
                                                    </Button>
                                                </>
                                            )}
                                            {initialApplication.status?.verification === 'approved' && (
                                                <Button variant="secondary" onClick={() => handleUpdateStatus('terminated')} disabled={isStatusPending}>
                                                    {isStatusPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserX className="mr-2 h-4 w-4" />}
                                                    เลิกจ้าง
                                                </Button>
                                            )}
                                            {(initialApplication.status?.verification === 'rejected' || initialApplication.status?.verification === 'terminated') && (
                                                <Button variant="outline" onClick={() => handleUpdateStatus('pending')} disabled={isStatusPending}>
                                                    {isStatusPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileClock className="mr-2 h-4 w-4" />}
                                                    พิจารณาใหม่
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardFooter>
                        )}
                    </Card>

                    </fieldset>

                    {!readOnly && hasChanges && (
                        <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t">
                            <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                                <div className="flex items-center justify-between h-20">
                                    <p className="text-lg font-semibold">ตรวจพบการเปลี่ยนแปลง</p>
                                    <div className="flex items-center gap-4">
                                        <Button variant="ghost" type="button" onClick={handleCancel} disabled={isSubmitting}>
                                            <X className="mr-2 h-4 w-4" />
                                            ยกเลิก
                                        </Button>
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
                                </div>
                            </div>
                        </div>
                    )}
                </form>
            </Form >
        </div >
    );
}
