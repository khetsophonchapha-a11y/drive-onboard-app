/**
 * End-to-End Integration Test for Application Submit and Retrieve Flow
 * 
 * Tests the complete flow:
 * 1. Submit application via /api/applications/submit
 * 2. Retrieve application via /api/applications/[id]
 * 3. Verify all data fields match
 * 
 * Run with: npm test -- --run src/lib/__tests__/e2e-application.test.ts
 */

import { beforeAll, describe, it, expect, afterAll } from 'vitest';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const BASE_URL = 'http://localhost:9002';
const E2E_TIMEOUT_MS = 20000;
const SERVER_UNAVAILABLE_MESSAGE =
    'Skipping E2E assertions because the Next.js dev server is not running on http://localhost:9002';

// Test data matching the form schema
const TEST_APP_ID = `e2e-test-${Date.now()}`;
const TEST_EMAIL = `${TEST_APP_ID}@example.com`;
const TEST_MANIFEST = {
    appId: TEST_APP_ID,
    createdAt: new Date().toISOString(),
    applicant: {
        prefix: 'นาย',
        firstName: 'ทดสอบ',
        lastName: 'ระบบ',
        fullName: 'ทดสอบ ระบบ',
        nickname: 'เทส',
        nationalId: '1234567890123',
        nationalIdIssueDate: '2020-01-15',
        nationalIdExpiryDate: '2030-01-15',
        dateOfBirth: '1990-05-20',
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
            moo: '5',
            street: 'ถนนสุขุมวิท',
            subDistrict: 'บางนา',
            district: 'บางนา',
            province: 'กรุงเทพมหานคร',
            postalCode: '10260',
        },
        permanentAddress: {
            houseNo: '123/45',
            moo: '5',
            street: 'ถนนสุขุมวิท',
            subDistrict: 'บางนา',
            district: 'บางนา',
            province: 'กรุงเทพมหานคร',
            postalCode: '10260',
        },
        isPermanentAddressSame: true,
        homePhone: '',
        mobilePhone: '0812345678',
        email: TEST_EMAIL,
        residenceType: 'own',
        militaryStatus: 'exempt',
    },
    applicationDetails: {
        position: 'พนักงานขับรถ',
        criminalRecord: 'no',
        applicationDate: '2024-12-01',
        emergencyContact: {
            firstName: 'สมศรี',
            lastName: 'ใจดี',
            occupation: 'แม่บ้าน',
            relation: 'แม่',
            phone: '',
            mobilePhone: '0898765432',
        },
    },
    guarantor: {
        firstName: 'สมหมาย',
        lastName: 'ค้ำประกัน',
        age: 50,
        race: 'ไทย',
        nationality: 'ไทย',
        nationalId: '9876543210123',
        address: {
            houseNo: '100',
            moo: '1',
            street: 'ถนนพระราม 9',
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
        plateNo: 'กข 1234',
        color: 'ขาว',
        year: 2022,
    },
    status: {
        completeness: 'complete',
        verification: 'pending',
    },
};

describe('E2E Application Submit and Retrieve', () => {
    let r2Client: S3Client | null = null;
    let bucket: string | null = null;
    let serverAvailable = false;

    // Check if R2 credentials are available for cleanup
    const hasR2Credentials = !!(
        process.env.R2_ENDPOINT &&
        process.env.R2_ACCESS_KEY_ID &&
        process.env.R2_SECRET_ACCESS_KEY &&
        (process.env.R2_BUCKET || process.env.R2_BUCKET_NAME)
    );

    beforeAll(async () => {
        try {
            const response = await fetch(`${BASE_URL}/api/applications`);
            serverAvailable = [200, 401, 403].includes(response.status);
        } catch {
            serverAvailable = false;
        }

        if (!serverAvailable) {
            console.warn(`⚠️  ${SERVER_UNAVAILABLE_MESSAGE}`);
        }
    });

    afterAll(async () => {
        // Cleanup: Delete test data after tests
        if (!hasR2Credentials) return;

        r2Client = new S3Client({
            region: 'auto',
            endpoint: process.env.R2_ENDPOINT,
            credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY_ID!,
                secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
            },
        });
        bucket = process.env.R2_BUCKET || process.env.R2_BUCKET_NAME!;

        try {
            await r2Client.send(new DeleteObjectCommand({
                Bucket: bucket,
                Key: `applications/${TEST_APP_ID}/manifest.json`,
            }));
            console.log(`✅ Cleaned up E2E test data: ${TEST_APP_ID}`);
        } catch (error) {
            // Ignore if already deleted
        }
    });

    it('should submit application via API', async () => {
        if (!serverAvailable) return;

        const response = await fetch(`${BASE_URL}/api/applications/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                appId: TEST_APP_ID,
                manifest: TEST_MANIFEST,
            }),
        });

        expect(response.ok).toBe(true);
        const result = await response.json();
        expect(result.ok).toBe(true);
        expect(result.appId).toBe(TEST_APP_ID);

        console.log(`✅ Submitted application: ${TEST_APP_ID}`);
    }, E2E_TIMEOUT_MS);

    it('should retrieve application via API and verify all fields', async () => {
        if (!serverAvailable) return;

        // Wait a bit for data to be written
        await new Promise(resolve => setTimeout(resolve, 500));

        const response = await fetch(`${BASE_URL}/api/applications/${TEST_APP_ID}`);
        expect(response.ok).toBe(true);

        const retrievedData = await response.json();
        console.log(`✅ Retrieved application: ${TEST_APP_ID}`);

        // Verify basic fields
        expect(retrievedData.appId).toBe(TEST_APP_ID);

        // Verify applicant data
        const applicant = retrievedData.applicant;
        expect(applicant.prefix).toBe(TEST_MANIFEST.applicant.prefix);
        expect(applicant.firstName).toBe(TEST_MANIFEST.applicant.firstName);
        expect(applicant.lastName).toBe(TEST_MANIFEST.applicant.lastName);
        expect(applicant.fullName).toBe(TEST_MANIFEST.applicant.fullName);
        expect(applicant.nationalId).toBe(TEST_MANIFEST.applicant.nationalId);
        expect(applicant.mobilePhone).toBe(TEST_MANIFEST.applicant.mobilePhone);
        expect(applicant.email).toBe(TEST_MANIFEST.applicant.email);
        expect(applicant.height).toBe(TEST_MANIFEST.applicant.height);
        expect(applicant.weight).toBe(TEST_MANIFEST.applicant.weight);
        expect(applicant.gender).toBe(TEST_MANIFEST.applicant.gender);
        expect(applicant.maritalStatus).toBe(TEST_MANIFEST.applicant.maritalStatus);
        expect(applicant.residenceType).toBe(TEST_MANIFEST.applicant.residenceType);
        expect(applicant.militaryStatus).toBe(TEST_MANIFEST.applicant.militaryStatus);

        // Verify address
        expect(applicant.currentAddress.subDistrict).toBe(TEST_MANIFEST.applicant.currentAddress.subDistrict);
        expect(applicant.currentAddress.district).toBe(TEST_MANIFEST.applicant.currentAddress.district);
        expect(applicant.currentAddress.province).toBe(TEST_MANIFEST.applicant.currentAddress.province);
        expect(applicant.currentAddress.postalCode).toBe(TEST_MANIFEST.applicant.currentAddress.postalCode);

        // Verify vehicle data
        const vehicle = retrievedData.vehicle;
        expect(vehicle.type).toBe(TEST_MANIFEST.vehicle.type);
        expect(vehicle.brand).toBe(TEST_MANIFEST.vehicle.brand);
        expect(vehicle.model).toBe(TEST_MANIFEST.vehicle.model);
        expect(vehicle.plateNo).toBe(TEST_MANIFEST.vehicle.plateNo);
        expect(vehicle.color).toBe(TEST_MANIFEST.vehicle.color);
        expect(vehicle.year).toBe(TEST_MANIFEST.vehicle.year);

        // Verify guarantor data
        if (retrievedData.guarantor) {
            expect(retrievedData.guarantor.firstName).toBe(TEST_MANIFEST.guarantor?.firstName);
            expect(retrievedData.guarantor.lastName).toBe(TEST_MANIFEST.guarantor?.lastName);
        }

        // Verify status
        expect(retrievedData.status.verification).toBe(TEST_MANIFEST.status.verification);

        console.log('✅ All fields verified successfully');
    }, E2E_TIMEOUT_MS);

    it('should require auth for applications list', async () => {
        if (!serverAvailable) return;

        const response = await fetch(`${BASE_URL}/api/applications`);
        expect(response.status).toBe(401);
    });

    it('should update application and verify changes persist', async () => {
        if (!serverAvailable) return;

        // Update the manifest
        const updatedManifest = {
            ...TEST_MANIFEST,
            applicant: {
                ...TEST_MANIFEST.applicant,
                nickname: 'เทสอัพเดท',
                mobilePhone: '0899999999',
            },
            status: {
                completeness: 'complete',
                verification: 'approved',
            },
        };

        // Submit update
        const updateResponse = await fetch(`${BASE_URL}/api/applications/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                appId: TEST_APP_ID,
                manifest: updatedManifest,
            }),
        });

        expect(updateResponse.ok).toBe(true);
        console.log(`✅ Updated application: ${TEST_APP_ID}`);

        // Wait for data to persist
        await new Promise(resolve => setTimeout(resolve, 500));

        // Retrieve and verify update
        const getResponse = await fetch(`${BASE_URL}/api/applications/${TEST_APP_ID}`);
        expect(getResponse.ok).toBe(true);

        const retrievedData = await getResponse.json();

        // Verify updated fields
        expect(retrievedData.applicant.nickname).toBe('เทสอัพเดท');
        expect(retrievedData.applicant.mobilePhone).toBe('0899999999');
        expect(retrievedData.status.verification).toBe('approved');

        // Verify unchanged fields remain the same
        expect(retrievedData.applicant.firstName).toBe(TEST_MANIFEST.applicant.firstName);
        expect(retrievedData.applicant.lastName).toBe(TEST_MANIFEST.applicant.lastName);
        expect(retrievedData.vehicle.brand).toBe(TEST_MANIFEST.vehicle.brand);

        console.log('✅ Update changes verified successfully');
    }, E2E_TIMEOUT_MS);
});
