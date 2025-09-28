
import { z } from 'zod';

export type VerificationStatus = 'pending' | 'approved' | 'rejected';

// Minimal summary for index.json
export type AppRow = {
  appId: string;
  fullName: string;
  phone?: string;
  createdAt: string; // ISO
  status: VerificationStatus;
};


// Zod schema for FileRef
export const FileRefSchema = z.object({
  r2Key: z.string(),
  mime: z.string(),
  size: z.number(),
  md5: z.string().optional(),
});
export type FileRef = z.infer<typeof FileRefSchema>;

// Zod schema for the full manifest
export const ManifestSchema = z.object({
  appId: z.string(),
  createdAt: z.string(), // ISO date string
  applicant: z.object({
    firstName: z.string().min(1, 'ต้องกรอกชื่อจริง').max(50, 'ชื่อจริงต้องไม่เกิน 50 ตัวอักษร'),
    lastName: z.string().min(1, 'ต้องกรอกนามสกุล').max(50, 'นามสกุลต้องไม่เกิน 50 ตัวอักษร'),
    phone: z.string().min(10, 'เบอร์โทรต้องมี 10 หลัก').max(10, 'เบอร์โทรต้องมี 10 หลัก').regex(/^[0-9]+$/, 'เบอร์โทรต้องเป็นตัวเลขเท่านั้น'),
    address: z.string().max(200, 'ที่อยู่ต้องไม่เกิน 200 ตัวอักษร').optional(),
    nationalId: z.string().length(13, 'เลขบัตรประชาชนต้องมี 13 หลัก').regex(/^[0-9]+$/, 'เลขบัตรประชาชนต้องเป็นตัวเลขเท่านั้น'),
  }),
  vehicle: z.object({
    brand: z.string().optional(),
    model: z.string().optional(),
    plateNo: z.string().optional(),
    color: z.string().optional(),
    year: z.number().optional(),
  }).optional(),
  guarantor: z.object({
    firstName: z.string().max(50, 'ชื่อจริงผู้ค้ำต้องไม่เกิน 50 ตัวอักษร').optional(),
    lastName: z.string().max(50, 'นามสกุลผู้ค้ำต้องไม่เกิน 50 ตัวอักษร').optional(),
    phone: z.string().max(10, 'เบอร์โทรผู้ค้ำต้องมี 10 หลัก').regex(/^[0-9]*$/, 'เบอร์โทรผู้ค้ำต้องเป็นตัวเลขเท่านั้น').optional(),
    address: z.string().max(200, 'ที่อยู่ผู้ค้ำต้องไม่เกิน 200 ตัวอักษร').optional(),
  }).optional(),
  docs: z.object({
    citizenIdCopy: FileRefSchema.optional(),
    driverLicenseCopy: FileRefSchema.optional(),
    houseRegCopy: FileRefSchema.optional(),
    carRegCopy: FileRefSchema.optional(),
    carPhoto: FileRefSchema.optional(),
    kbankBookFirstPage: FileRefSchema.optional(),
    taxAndPRB: FileRefSchema.optional(),
    insurance: z.object({
      type: z.enum(['1', '2', '3']).optional(),
      policy: FileRefSchema.optional(),
    }).optional(),
    guarantorCitizenIdCopy: FileRefSchema.optional(),
    guarantorHouseRegCopy: FileRefSchema.optional(),
  }).partial(), // Use .partial() to allow updating only some doc fields
  status: z.object({
    completeness: z.enum(['incomplete', 'complete']),
    verification: z.enum(['pending', 'approved', 'rejected']),
    notes: z.string().optional(),
  }),
});

// Re-add `fullName` for derived data, but it's not part of the editable schema
export type Manifest = z.infer<typeof ManifestSchema> & {
    applicant: {
        fullName: string;
    },
    guarantor?: {
        fullName?: string;
    }
};

    
