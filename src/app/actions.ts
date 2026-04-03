'use server'

// import { r2 } from '@/app/api/r2/_client';
import type { Manifest, VerificationStatus } from '@/lib/types';
import { revalidateTag } from 'next/cache';
import { getDb } from '@/lib/db';
import { applications } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { createUser, fetchUserByEmail } from '@/lib/d1-users';

export async function getImageAsDataUri(url: string): Promise<string> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        const blob = await response.blob();
        const buffer = Buffer.from(await blob.arrayBuffer());
        const dataUri = `data:${blob.type};base64,${buffer.toString('base64')}`;
        return dataUri;
    } catch (error) {
        console.error("Error converting image to data URI:", error);
        // In a real app, you might want to return a placeholder or handle this more gracefully
        return '';
    }
}


export async function updateApplicationStatus(appId: string, status: VerificationStatus): Promise<{ success: boolean; error?: string }> {
    try {
        const db = await getDb();
        const existingApp = await db.select().from(applications).where(eq(applications.appId, appId)).get();

        if (!existingApp) {
            return { success: false, error: 'Application manifest not found.' };
        }

        const manifest: Manifest = JSON.parse(existingApp.rawData as string);
        const applicantEmail = manifest.applicant.email.trim().toLowerCase();
        const applicantNationalId = manifest.applicant.nationalId.trim();
        const applicantName =
            manifest.applicant.fullName?.trim() ||
            `${manifest.applicant.firstName} ${manifest.applicant.lastName}`.trim();

        // Only update if the status is different
        const normalizedStatus = manifest.status ?? { completeness: "incomplete", verification: "pending" };
        normalizedStatus.completeness = normalizedStatus.completeness ?? "incomplete";
        normalizedStatus.verification = normalizedStatus.verification ?? "pending";
        manifest.status = normalizedStatus;

        if (manifest.status.verification !== status) {
            if (status === 'approved') {
                if (!applicantEmail) {
                    return { success: false, error: 'ไม่พบอีเมลของผู้สมัครสำหรับสร้างบัญชีพนักงาน' };
                }

                if (!/^\d{13}$/.test(applicantNationalId)) {
                    return { success: false, error: 'เลขบัตรประชาชนของผู้สมัครไม่ถูกต้อง ไม่สามารถสร้างรหัสผ่านเริ่มต้นได้' };
                }

                const existingUser = await fetchUserByEmail(applicantEmail);
                if (!existingUser) {
                    const initialPassword = applicantNationalId.slice(-6);
                    const createdUser = await createUser({
                        email: applicantEmail,
                        name: applicantName || applicantEmail,
                        role: 'employee',
                        password: initialPassword,
                        phone: manifest.applicant.mobilePhone || manifest.applicant.homePhone,
                    });

                    if (createdUser.error) {
                        return { success: false, error: `สร้างบัญชีพนักงานไม่สำเร็จ: ${createdUser.error}` };
                    }
                }
            }

            manifest.status.verification = status;

            // Update both JSON and Columns
            await db.update(applications)
                .set({
                    verificationStatus: status,
                    rawData: JSON.stringify(manifest),
                    updatedAt: new Date().toISOString()
                })
                .where(eq(applications.appId, appId));
        }

        // --- Step 3: Revalidate caches ---
        // We revalidate both tags to ensure all data is fresh across the app.
        revalidateTag(`r2-app-${appId}`);
        revalidateTag('r2-index');

        return { success: true };

    } catch (error: any) {
        console.error(`[Update Status Error for App ${appId}]`, error);
        return { success: false, error: error.message || 'An unknown error occurred.' };
    }
}
