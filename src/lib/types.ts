import { z } from 'zod';
import { vehicleCatalog } from './vehicle-data';

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(['admin', 'employee', 'god']),
  phone: z.string().optional(),
  avatarUrl: z.string().optional(),
  password: z.string().optional(),
  status: z.enum(['active', 'archived']).default('active'),
  hubId: z.string().nullable().optional(),
});
export type User = z.infer<typeof UserSchema>;

export type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'terminated';

// Minimal summary for index.json
export type AppRow = {
  appId: string;
  fullName: string;
  email?: string;
  phone?: string;
  createdAt: string; // ISO
  status: VerificationStatus;
  hubId?: string | null;
  hubName?: string | null;
  terminatedAt?: string | null;
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

export const RequiredAddressSchema = AddressSchema.extend({
  houseNo: z.string({ required_error: 'กรอกบ้านเลขที่' }).trim().min(1, 'กรอกบ้านเลขที่'),
  subDistrict: z.string({ required_error: 'กรอกตำบล/แขวง' }).trim().min(1, 'กรอกตำบล/แขวง'),
  district: z.string({ required_error: 'กรอกอำเภอ/เขต' }).trim().min(1, 'กรอกอำเภอ/เขต'),
  province: z.string({ required_error: 'กรอกจังหวัด' }).trim().min(1, 'กรอกจังหวัด'),
  postalCode: z
    .string({ required_error: 'กรอกรหัสไปรษณีย์' })
    .trim()
    .regex(/^\d{5}$/, 'รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก'),
});

const requiredTrimmedString = (label: string, max = 40) =>
  z
    .string({ required_error: `กรุณากรอก${label}` })
    .trim()
    .min(1, `กรุณากรอก${label}`)
    .max(max, `${label}ต้องไม่เกิน ${max} ตัวอักษร`);

const optionalTrimmedString = (max: number) =>
  z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
    z.string().trim().max(max).optional()
  );

const numericStringToNumber = (label: string) =>
  z.preprocess(
    (val) => {
      if (typeof val === 'number') {
        return val;
      }
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed === '') return undefined;
        if (!/^\d+$/.test(trimmed)) {
          return trimmed;
        }
        return Number(trimmed);
      }
      return val;
    },
    z
      .number({
        required_error: `กรุณากรอก${label}`,
        invalid_type_error: `${label}ต้องเป็นตัวเลขเท่านั้น`,
      })
      .int()
      .min(0, `${label}ต้องไม่น้อยกว่า 0`)
      .max(999, `${label}ต้องไม่เกิน 3 หลัก`)
  );

const today = new Date();

const coerceRequiredPastDate = (label: string, allowFuture = false) =>
  z
    .coerce
    .date({
      invalid_type_error: `รูปแบบ${label}ไม่ถูกต้อง`,
      required_error: `กรุณาเลือก${label}`,
    })
    .refine(
      (date) => (allowFuture ? true : date <= today),
      { message: `${label}ต้องไม่อยู่ในอนาคต` }
    );

const thaiNationalIdSchema = z
  .string({ required_error: 'กรุณากรอกเลขที่บัตรประชาชน' })
  .trim()
  .regex(/^\d{13}$/, 'เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก');

const phoneNumberSchema = z
  .string({ required_error: 'กรุณากรอกเบอร์มือถือ' })
  .trim()
  .regex(/^0\d{8,9}$/, 'เบอร์มือถือควรเป็นตัวเลขขึ้นต้นด้วย 0 จำนวน 9-10 หลัก');

const genderEnum = z.enum(['male', 'female']);
const maritalStatusEnum = z.enum(['single', 'married', 'widowed', 'divorced']);
const residenceTypeEnum = z.enum(['own', 'rent', 'dorm']);
const militaryStatusEnum = z.enum(['exempt', 'discharged', 'not-drafted']);
const vehicleTypeEnum = z.enum(['four-wheel', 'two-wheel']);

// Zod schema for the full manifest
export const ManifestSchema = z.object({
  appId: z.string().optional(),
  createdAt: z.string().optional(), // ISO date string
  applicant: z
    .object({
      prefix: requiredTrimmedString('คำนำหน้า'),
      firstName: requiredTrimmedString('ชื่อ', 40),
      lastName: requiredTrimmedString('นามสกุล', 40),
      nickname: optionalTrimmedString(40),
      nationalId: thaiNationalIdSchema,
      nationalIdIssueDate: coerceRequiredPastDate('วันที่ออกบัตร'),
      nationalIdExpiryDate: z
        .coerce
        .date({
          invalid_type_error: 'รูปแบบวันที่หมดอายุไม่ถูกต้อง',
          required_error: 'กรุณาเลือกวันที่บัตรหมดอายุ',
        }),
      dateOfBirth: coerceRequiredPastDate('วันเดือนปีเกิด'),
      age: z.number({ required_error: 'กรุณาระบุอายุ' }).int().min(0).max(130),
      race: requiredTrimmedString('เชื้อชาติ', 40),
      nationality: requiredTrimmedString('สัญชาติ', 40),
      religion: requiredTrimmedString('ศาสนา', 40),
      height: numericStringToNumber('ส่วนสูง (ซม.)'),
      weight: numericStringToNumber('น้ำหนัก (กก.)'),
      gender: genderEnum,
      maritalStatus: maritalStatusEnum,
      currentAddress: RequiredAddressSchema,
      permanentAddress: RequiredAddressSchema.optional(),
      isPermanentAddressSame: z.boolean().default(false),
      homePhone: optionalTrimmedString(15),
      mobilePhone: phoneNumberSchema,
      email: z
        .string({ required_error: 'กรุณากรอกอีเมล' })
        .trim()
        .min(1, 'กรุณากรอกอีเมล')
        .email('อีเมลไม่ถูกต้อง'),
      residenceType: residenceTypeEnum,
      militaryStatus: militaryStatusEnum,
    })
    .superRefine((data, ctx) => {
      if (!data.isPermanentAddressSame && !data.permanentAddress) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['permanentAddress'],
          message: 'กรุณากรอกที่อยู่ตามทะเบียนบ้าน',
        });
      }
    }),
  applicationDetails: z
    .object({
      position: optionalTrimmedString(80),
      criminalRecord: z.enum(['yes', 'no']),
      criminalRecordDetails: optionalTrimmedString(500),
      emergencyContact: z
        .object({
          firstName: requiredTrimmedString('ชื่อผู้ติดต่อ', 40),
          lastName: requiredTrimmedString('นามสกุลผู้ติดต่อ', 40),
          occupation: requiredTrimmedString('อาชีพ', 80),
          relation: requiredTrimmedString('ความเกี่ยวข้อง', 40),
          relationOther: optionalTrimmedString(40),
          phone: optionalTrimmedString(15),
          mobilePhone: phoneNumberSchema,
        }).superRefine((data, ctx) => {
          if (data.relation === 'อื่นๆ' && (!data.relationOther || data.relationOther.trim() === '')) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['relationOther'],
              message: 'กรุณาระบุความเกี่ยวข้อง',
            });
          }
        }),
      applicationDate: z
        .coerce
        .date({
          invalid_type_error: 'รูปแบบวันที่สมัครไม่ถูกต้อง',
          required_error: 'กรุณาเลือกวันที่สมัคร',
        }),
    })
    .superRefine((data, ctx) => {
      if (data.criminalRecord === 'yes' && !data.criminalRecordDetails) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['criminalRecordDetails'],
          message: 'กรุณาระบุรายละเอียดประวัติอาชญากรรม',
        });
      }
    }),
  contractDetails: z.object({
    contractDate: z.date().optional(),
    contactAddress: AddressSchema.optional(),
    isContactAddressSame: z.boolean().optional(),
    phone: z.string().optional(),
    fax: z.string().optional(),
    vehiclePlateNo: z.string().optional(),
  }).optional(),
  guarantor: z.object({
    contractDate: z.coerce.date().optional(),
    firstName: requiredTrimmedString('ชื่อผู้ค้ำประกัน', 40),
    lastName: requiredTrimmedString('นามสกุลผู้ค้ำประกัน', 40),
    age: z.number({ required_error: 'กรุณาระบุอายุ' }).int().min(0).max(130),
    race: requiredTrimmedString('เชื้อชาติ', 40),
    nationality: requiredTrimmedString('สัญชาติ', 40),
    address: RequiredAddressSchema,
    isAddressSameAsApplicantCurrent: z.boolean().default(false),
    nationalId: thaiNationalIdSchema,
    phone: phoneNumberSchema,
    occupation: requiredTrimmedString('อาชีพผู้ค้ำประกัน', 80),
    applicantStartDate: z.coerce.date().optional(),
  }),
  vehicle: z
    .object({
      type: vehicleTypeEnum.optional(),
      brand: optionalTrimmedString(80),
      brandOther: optionalTrimmedString(80),
      model: optionalTrimmedString(80),
      modelOther: optionalTrimmedString(80),
      plateNo: optionalTrimmedString(20),
      color: optionalTrimmedString(40),
      colorOther: optionalTrimmedString(40),
      year: z
        .preprocess(
          (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
          z.coerce.number().int().min(1990).max(today.getFullYear() + 1).optional()
        ),
    })
    .superRefine((data, ctx) => {
      if (!data.type) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['type'],
          message: 'กรุณาเลือกประเภทพาหนะ',
        });
        return;
      }

      const brands = vehicleCatalog[data.type]?.map((brand) => brand.value) ?? [];
      if (!data.brand || !brands.includes(data.brand)) {
        if (data.brand === 'other') {
          if (!data.brandOther) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['brandOther'],
              message: 'กรุณาระบุยี่ห้อ',
            });
          }
          if (!data.modelOther) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['modelOther'],
              message: 'กรุณาระบุรุ่น',
            });
          }
        } else {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['brand'],
            message: 'กรุณาเลือกยี่ห้อจากรายการ',
          });
        }
      } else if (data.brand !== 'other') {
        const models = vehicleCatalog[data.type]?.find((b) => b.value === data.brand)?.models ?? [];
        const modelValues = models.map((m) => m.value);
        if (!data.model || !modelValues.includes(data.model)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['model'],
            message: 'กรุณาเลือกรุ่นจากรายการ',
          });
        }
      }
    }),
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
    signature: FileRefSchema.optional(),
    guarantorSignature: FileRefSchema.optional(),
  }).partial().optional(),
  status: z.object({
    completeness: z.enum(['incomplete', 'complete']),
    verification: z.enum(['pending', 'approved', 'rejected', 'terminated']),
    notes: z.string().optional(),
    terminatedAt: z.string().optional(),
  }).optional(),
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

// ============================================
// Relaxed schema for EDITING (all fields optional)
// ============================================

// Optional address fields (no required validation)
const OptionalAddressSchema = z.object({
  houseNo: z.string().optional(),
  moo: z.string().optional(),
  street: z.string().optional(),
  subDistrict: z.string().optional(),
  district: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
    z.string().regex(/^\d{5}$/, 'รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก').optional()
  ),
});

// Optional date (coerces but allows undefined)
const optionalDate = z.preprocess(
  (val) => {
    if (!val || val === '') return undefined;
    if (val instanceof Date) return val;
    const date = new Date(val as string);
    return Number.isNaN(date.getTime()) ? undefined : date;
  },
  z.date().optional()
);

// Optional number (allows empty string)
const optionalNumber = z.preprocess(
  (val) => {
    if (val === undefined || val === null || val === '') return undefined;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed === '' || !/^\d+$/.test(trimmed)) return undefined;
      return Number(trimmed);
    }
    return undefined;
  },
  z.number().int().min(0).max(999).optional()
);

// Relaxed schema for editing - allows saving with incomplete data
export const EditManifestSchema = z.object({
  appId: z.string().optional(),
  createdAt: z.string().optional(),
  applicant: z.object({
    prefix: optionalTrimmedString(40),
    firstName: optionalTrimmedString(40),
    lastName: optionalTrimmedString(40),
    nickname: optionalTrimmedString(40),
    nationalId: z.preprocess(
      (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
      z.string().regex(/^\d{13}$/, 'เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก').optional()
    ),
    nationalIdIssueDate: optionalDate,
    nationalIdExpiryDate: optionalDate,
    dateOfBirth: optionalDate,
    age: z.number().int().min(0).max(130).optional(),
    race: optionalTrimmedString(40),
    nationality: optionalTrimmedString(40),
    religion: optionalTrimmedString(40),
    height: optionalNumber,
    weight: optionalNumber,
    gender: z.enum(['male', 'female']).optional(),
    maritalStatus: z.enum(['single', 'married', 'widowed', 'divorced']).optional(),
    currentAddress: OptionalAddressSchema.optional(),
    permanentAddress: OptionalAddressSchema.optional(),
    isPermanentAddressSame: z.boolean().optional().default(false),
    homePhone: optionalTrimmedString(15),
    mobilePhone: z.preprocess(
      (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
      z.string().regex(/^0\d{8,9}$/, 'เบอร์มือถือควรเป็นตัวเลขขึ้นต้นด้วย 0 จำนวน 9-10 หลัก').optional()
    ),
    email: z.string().email('อีเมลไม่ถูกต้อง').optional().or(z.literal('')),
    residenceType: z.enum(['own', 'rent', 'dorm']).optional(),
    militaryStatus: z.enum(['exempt', 'discharged', 'not-drafted']).optional(),
  }).optional(),
  applicationDetails: z.object({
    position: optionalTrimmedString(80),
    criminalRecord: z.enum(['yes', 'no']).optional(),
    criminalRecordDetails: optionalTrimmedString(500),
    emergencyContact: z.object({
      firstName: optionalTrimmedString(40),
      lastName: optionalTrimmedString(40),
      occupation: optionalTrimmedString(80),
      relation: optionalTrimmedString(40),
      relationOther: optionalTrimmedString(40),
      phone: optionalTrimmedString(15),
      mobilePhone: optionalTrimmedString(10),
    }).optional(),
    applicationDate: optionalDate,
  }).optional(),
  contractDetails: z.object({
    contractDate: optionalDate,
    contactAddress: OptionalAddressSchema.optional(),
    isContactAddressSame: z.boolean().optional(),
    phone: z.string().optional(),
    fax: z.string().optional(),
    vehiclePlateNo: z.string().optional(),
  }).optional(),
  guarantor: z.object({
    contractDate: optionalDate,
    firstName: optionalTrimmedString(40),
    lastName: optionalTrimmedString(40),
    age: z.number().int().min(0).max(130).optional(),
    race: optionalTrimmedString(40),
    nationality: optionalTrimmedString(40),
    address: OptionalAddressSchema.optional(),
    isAddressSameAsApplicantCurrent: z.boolean().optional(),
    nationalId: optionalTrimmedString(13),
    phone: optionalTrimmedString(15),
    occupation: optionalTrimmedString(80),
    applicantStartDate: optionalDate,
  }).optional(),
  vehicle: z.object({
    type: z.enum(['four-wheel', 'two-wheel']).optional(),
    brand: optionalTrimmedString(80),
    brandOther: optionalTrimmedString(80),
    model: optionalTrimmedString(80),
    modelOther: optionalTrimmedString(80),
    plateNo: optionalTrimmedString(20),
    color: optionalTrimmedString(40),
    colorOther: optionalTrimmedString(40),
    year: z.preprocess(
      (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
      z.coerce.number().int().min(1990).max(today.getFullYear() + 1).optional()
    ),
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
    signature: FileRefSchema.optional(),
    guarantorSignature: FileRefSchema.optional(),
  }).partial().optional(),
  status: z.object({
    completeness: z.enum(['incomplete', 'complete']).optional(),
    verification: z.enum(['pending', 'approved', 'rejected', 'terminated']).optional(),
    notes: z.string().optional(),
    terminatedAt: z.string().optional(),
  }).optional(),
});

export type EditManifest = z.infer<typeof EditManifestSchema>;
