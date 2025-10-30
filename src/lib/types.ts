
import { z } from 'zod';

export type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'terminated';

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

const AddressSchema = z.object({
    houseNo: z.string().optional(),
    moo: z.string().optional(),
    street: z.string().optional(),
    subDistrict: z.string().optional(),
    district: z.string().optional(),
    province: z.string().optional(),
    postalCode: z.string().optional(),
});

// Zod schema for the full manifest
export const ManifestSchema = z.object({
  appId: z.string(),
  createdAt: z.string(), // ISO date string
  applicant: z.object({
    prefix: z.string().optional(),
    firstName: z.string().max(50, 'ชื่อจริงต้องไม่เกิน 50 ตัวอักษร').optional(),
    lastName: z.string().max(50, 'นามสกุลต้องไม่เกิน 50 ตัวอักษร').optional(),
    nickname: z.string().optional(),
    nationalId: z.string().regex(/^[0-9]*$/, 'เลขบัตรประชาชนต้องเป็นตัวเลขเท่านั้น').refine(val => val === '' || val.length === 13, { message: 'เลขบัตรประชาชนต้องมี 13 หลัก' }).optional(),
    nationalIdIssueDate: z.date().optional(),
    nationalIdExpiryDate: z.date().optional(),
    dateOfBirth: z.date().optional(),
    age: z.coerce.number().optional(),
    race: z.string().optional(),
    nationality: z.string().optional(),
    religion: z.string().optional(),
    height: z.coerce.number().optional(),
    weight: z.coerce.number().optional(),
    gender: z.enum(['male', 'female']).optional(),
    maritalStatus: z.enum(['single', 'married', 'widowed', 'divorced']).optional(),
    currentAddress: AddressSchema.optional(),
    permanentAddress: AddressSchema.optional(),
    isPermanentAddressSame: z.boolean().optional(),
    homePhone: z.string().optional(),
    mobilePhone: z.string().regex(/^[0-9]*$/, 'เบอร์โทรต้องเป็นตัวเลขเท่านั้น').refine(val => val === '' || val.length === 10, { message: 'เบอร์โทรต้องมี 10 หลัก' }).optional(),
    email: z.string().email('อีเมลไม่ถูกต้อง').optional().or(z.literal('')),
    residenceType: z.enum(['own', 'rent', 'dorm']).optional(),
    militaryStatus: z.enum(['exempt', 'discharged', 'not-drafted']).optional(),
  }),
  applicationDetails: z.object({
    position: z.string().optional(),
    criminalRecord: z.enum(['yes', 'no']).optional(),
    emergencyContact: z.object({
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        occupation: z.string().optional(),
        relation: z.string().optional(),
        phone: z.string().optional(),
        mobilePhone: z.string().optional(),
    }).optional(),
    applicationDate: z.date().optional(),
  }).optional(),
  contractDetails: z.object({
    contractDate: z.date().optional(),
    contactAddress: AddressSchema.optional(),
    isContactAddressSame: z.boolean().optional(),
    phone: z.string().optional(),
    fax: z.string().optional(),
    vehiclePlateNo: z.string().optional(),
  }).optional(),
  guarantor: z.object({
    contractDate: z.date().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    age: z.coerce.number().optional(),
    race: z.string().optional(),
    nationality: z.string().optional(),
    address: AddressSchema.optional(),
    nationalId: z.string().optional(),
    applicantStartDate: z.date().optional(),
  }).optional(),
  vehicle: z.object({
    brand: z.string().optional(),
    brandOther: z.string().optional(),
    model: z.string().optional(),
    modelOther: z.string().optional(),
    plateNo: z.string().optional(),
    color: z.string().optional(),
    colorOther: z.string().optional(),
    year: z.coerce.number().optional(),
  }).optional(),
  docs: z.object({
    applicationForm: FileRefSchema.optional(),
    transportContract: FileRefSchema.optional(),
    guaranteeContract: FileRefSchema.optional(),
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
  }).partial().optional(),
  status: z.object({
    completeness: z.enum(['incomplete', 'complete']),
    verification: z.enum(['pending', 'approved', 'rejected', 'terminated']),
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
