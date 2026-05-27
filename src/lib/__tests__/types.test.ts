import { describe, expect, it } from 'vitest';
import { FileRefSchema, ManifestSchema } from '../types';

const validManifest = {
    applicant: {
        prefix: 'นาย',
        firstName: 'สมชาย',
        lastName: 'ใจดี',
        nickname: 'ชาย',
        nationalId: '1234567890123',
        nationalIdIssueDate: new Date('2020-01-01'),
        nationalIdExpiryDate: new Date('2030-01-01'),
        dateOfBirth: new Date('1990-01-01'),
        age: 34,
        race: 'ไทย',
        nationality: 'ไทย',
        religion: 'พุทธ',
        height: 175,
        weight: 70,
        gender: 'male',
        maritalStatus: 'single',
        currentAddress: {
            houseNo: '123/45',
            subDistrict: 'บางนาใต้',
            district: 'บางนา',
            province: 'กรุงเทพมหานคร',
            postalCode: '10260',
        },
        isPermanentAddressSame: true,
        mobilePhone: '0812345678',
        email: 'somchai@example.com',
        residenceType: 'own',
        militaryStatus: 'exempt',
    },
    applicationDetails: {
        criminalRecord: 'no',
        emergencyContact: {
            firstName: 'สมศรี',
            lastName: 'ใจดี',
            occupation: 'แม่บ้าน',
            relation: 'แม่',
            mobilePhone: '0898765432',
        },
        applicationDate: new Date('2024-01-01'),
    },
    guarantor: {
        firstName: 'สมหมาย',
        lastName: 'ค้ำประกัน',
        age: 50,
        race: 'ไทย',
        nationality: 'ไทย',
        nationalId: '9876543210123',
        phone: '0888888888',
        occupation: 'พนักงานบริษัท',
        address: {
            houseNo: '100',
            subDistrict: 'ห้วยขวาง',
            district: 'ห้วยขวาง',
            province: 'กรุงเทพมหานคร',
            postalCode: '10310',
        },
    },
    vehicle: {
        type: 'four-wheel',
        brand: 'Toyota',
        model: 'Hilux Revo',
    },
};

describe('FileRefSchema', () => {
    it('should validate a valid FileRef', () => {
        const validFileRef = {
            r2Key: 'applications/123/doc.pdf',
            mime: 'application/pdf',
            size: 1024,
            md5: 'abc123',
        };
        expect(() => FileRefSchema.parse(validFileRef)).not.toThrow();
    });

    it('should allow optional md5', () => {
        const fileRefWithoutMd5 = {
            r2Key: 'applications/123/doc.pdf',
            mime: 'application/pdf',
            size: 1024,
        };
        expect(() => FileRefSchema.parse(fileRefWithoutMd5)).not.toThrow();
    });

    it('should reject missing required fields', () => {
        const invalidFileRef = {
            r2Key: 'applications/123/doc.pdf',
        };
        expect(() => FileRefSchema.parse(invalidFileRef)).toThrow();
    });
});

describe('ManifestSchema - Applicant Validation', () => {
    it('should validate a complete valid manifest', () => {
        expect(() => ManifestSchema.parse(validManifest)).not.toThrow();
    });

    it('should reject invalid national ID (not 13 digits)', () => {
        const manifest = {
            ...validManifest,
            applicant: {
                ...validManifest.applicant,
                nationalId: '123456',
            },
        };

        const result = ManifestSchema.safeParse(manifest);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((issue) => issue.path.includes('nationalId'))).toBe(true);
        }
    });

    it('should reject non-numeric national ID', () => {
        const manifest = {
            ...validManifest,
            applicant: {
                ...validManifest.applicant,
                nationalId: '12345678901ab',
            },
        };

        const result = ManifestSchema.safeParse(manifest);
        expect(result.success).toBe(false);
    });

    it('should reject invalid phone number (not starting with 0)', () => {
        const manifest = {
            ...validManifest,
            applicant: {
                ...validManifest.applicant,
                mobilePhone: '1234567890',
            },
        };

        const result = ManifestSchema.safeParse(manifest);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((issue) => issue.path.includes('mobilePhone'))).toBe(true);
        }
    });

    it('should reject phone number with wrong length', () => {
        const manifest = {
            ...validManifest,
            applicant: {
                ...validManifest.applicant,
                mobilePhone: '0123',
            },
        };

        const result = ManifestSchema.safeParse(manifest);
        expect(result.success).toBe(false);
    });

    it('should reject invalid postal code (not 5 digits)', () => {
        const manifest = {
            ...validManifest,
            applicant: {
                ...validManifest.applicant,
                currentAddress: {
                    ...validManifest.applicant.currentAddress,
                    postalCode: '1026',
                },
            },
        };

        const result = ManifestSchema.safeParse(manifest);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((issue) => issue.path.includes('postalCode'))).toBe(true);
        }
    });

    it('should require permanent address when isPermanentAddressSame is false', () => {
        const manifest = {
            ...validManifest,
            applicant: {
                ...validManifest.applicant,
                isPermanentAddressSame: false,
                permanentAddress: undefined,
            },
        };

        const result = ManifestSchema.safeParse(manifest);
        expect(result.success).toBe(false);
    });

    it('should accept when isPermanentAddressSame is false with valid permanent address', () => {
        const manifest = {
            ...validManifest,
            applicant: {
                ...validManifest.applicant,
                isPermanentAddressSame: false,
                permanentAddress: {
                    houseNo: '456/78',
                    subDistrict: 'ดินแดง',
                    district: 'ดินแดง',
                    province: 'กรุงเทพมหานคร',
                    postalCode: '10400',
                },
            },
        };

        expect(() => ManifestSchema.parse(manifest)).not.toThrow();
    });
});

describe('ManifestSchema - Application Details Validation', () => {
    it('should require criminal record details when criminalRecord is yes', () => {
        const manifest = {
            ...validManifest,
            applicationDetails: {
                ...validManifest.applicationDetails,
                criminalRecord: 'yes',
                criminalRecordDetails: undefined,
            },
        };

        const result = ManifestSchema.safeParse(manifest);
        expect(result.success).toBe(false);
    });

    it('should accept criminal record details when criminalRecord is yes', () => {
        const manifest = {
            ...validManifest,
            applicationDetails: {
                ...validManifest.applicationDetails,
                criminalRecord: 'yes',
                criminalRecordDetails: 'รายละเอียดประวัติอาชญากรรม',
            },
        };

        expect(() => ManifestSchema.parse(manifest)).not.toThrow();
    });
});

describe('ManifestSchema - Vehicle Validation', () => {
    it('should require vehicle type', () => {
        const manifest = {
            ...validManifest,
            vehicle: {
                brand: 'Toyota',
                model: 'Hilux Revo',
            },
        };

        const result = ManifestSchema.safeParse(manifest);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((issue) => issue.path.includes('type'))).toBe(true);
        }
    });

    it('should accept other brand with brandOther and modelOther', () => {
        const manifest = {
            ...validManifest,
            vehicle: {
                type: 'four-wheel',
                brand: 'other',
                brandOther: 'Custom Brand',
                modelOther: 'Custom Model',
            },
        };

        expect(() => ManifestSchema.parse(manifest)).not.toThrow();
    });

    it('should require model when brand is not other', () => {
        const manifest = {
            ...validManifest,
            vehicle: {
                type: 'four-wheel',
                brand: 'Toyota',
            },
        };

        const result = ManifestSchema.safeParse(manifest);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((issue) => issue.path.includes('model'))).toBe(true);
        }
    });

    it('should accept Toyota Hilux Vigo as a valid vehicle model', () => {
        const manifest = {
            ...validManifest,
            vehicle: {
                type: 'four-wheel',
                brand: 'Toyota',
                model: 'Hilux Vigo',
            },
        };

        expect(() => ManifestSchema.parse(manifest)).not.toThrow();
    });
});
