
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
    fullName: z.string().min(1, 'ต้องกรอกชื่อ'),
    phone: z.string().min(1, 'ต้องกรอกเบอร์โทร'),
    address: z.string().optional(),
    nationalId: z.string().optional(),
  }),
  vehicle: z.object({
    brand: z.string().optional(),
    model: z.string().optional(),
    plateNo: z.string().optional(),
    color: z.string().optional(),
    year: z.number().optional(),
  }).optional(),
  guarantor: z.object({
    fullName: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
  }).optional(),
  docs: z.object({
    citizenIdCopy: FileRefSchema.optional(),
    driverLicenseCopy: FileRefSchema.optional(),
    houseRegCopy: FileRefSchema.optional(),
    carRegCopy: FileRefSchema.optional(),
    carPhotos: z.array(FileRefSchema).optional(),
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

export type Manifest = z.infer<typeof ManifestSchema>;

    