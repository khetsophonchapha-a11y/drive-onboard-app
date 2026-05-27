'use server'

// import { r2 } from '@/app/api/r2/_client';
import { auth } from '@/auth';
import type { Manifest, VerificationStatus } from '@/lib/types';
import { revalidateTag } from 'next/cache';
import { getDb } from '@/lib/db';
import { applications } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { createUser, deleteUserById, fetchUserByEmail, updateUserById } from '@/lib/d1-users';
import { applicationsSupportSoftDelete, getApplicationById } from '@/lib/applications';
import type { User } from '@/lib/types';
import { getR2Binding } from '@/lib/r2/binding';

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

async function syncUserArchiveStatus(email: string, status: User['status']): Promise<void> {
    try {
        const user = await fetchUserByEmail(email);
        if (user && user.role === 'employee') {
            await updateUserById(user.id, { status });
        }
    } catch (error) {
        console.warn(`[Sync User Status Error for ${email}]`, error);
    }
}

function collectManifestR2Keys(value: unknown, keys = new Set<string>()): Set<string> {
    if (!value) return keys;

    if (Array.isArray(value)) {
        for (const item of value) {
            collectManifestR2Keys(item, keys);
        }
        return keys;
    }

    if (typeof value === 'object') {
        const record = value as Record<string, unknown>;

        if (typeof record.r2Key === 'string' && record.r2Key.trim()) {
            keys.add(record.r2Key.trim());
        }

        for (const nestedValue of Object.values(record)) {
            collectManifestR2Keys(nestedValue, keys);
        }
    }

    return keys;
}


export async function updateApplicationStatus(appId: string, status: VerificationStatus, hubId?: string): Promise<{ success: boolean; error?: string }> {
    try {
        const db = await getDb();
        const existingApplication = await getApplicationById(appId);
        const existingApp = existingApplication?.row;

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
                        hubId: hubId || null,
                    });

                    if (createdUser.error) {
                        return { success: false, error: `สร้างบัญชีพนักงานไม่สำเร็จ: ${createdUser.error}` };
                    }
                } else if (existingUser.status === 'archived') {
                    // Reactivate existing user if they were archived
                    await syncUserArchiveStatus(applicantEmail, 'active');
                }
            }

            manifest.status.verification = status;
            if (status === 'terminated') {
                manifest.status.terminatedAt = new Date().toISOString();
            } else {
                delete manifest.status.terminatedAt;
            }

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

export async function fetchDriverHub(email: string): Promise<string | null> {
    try {
        const user = await fetchUserByEmail(email.toLowerCase());
        return (user as any)?.hubId || (user as any)?.hub_id || null;
    } catch (e) {
        console.error('[fetchDriverHub] Error:', e);
        return null;
    }
}

export async function updateDriverHub(email: string, hubId: string | null): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await fetchUserByEmail(email.toLowerCase());
        if (!user) return { success: false, error: 'ไม่พบบัญชีพนักงานที่เชื่อมโยงกับใบสมัครนี้' };
        await updateUserById(user.id, { hubId: hubId });
        revalidateTag('r2-index');
        return { success: true };
    } catch (e: any) {
        console.error('[updateDriverHub] Error:', e);
        return { success: false, error: e.message };
    }
}

export async function softDeleteApplication(appId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const softDeleteSupported = await applicationsSupportSoftDelete();
        if (!softDeleteSupported) {
            return { success: false, error: 'ฐานข้อมูล production ยังไม่พร้อมสำหรับถังขยะ กรุณารัน migration ของ applications ก่อน' };
        }

        const db = await getDb();
        const existingApplication = await getApplicationById(appId);
        const existingApp = existingApplication?.row;

        if (!existingApp) {
            return { success: false, error: 'ไม่พบใบสมัครที่ต้องการลบ' };
        }

        if (existingApp.deletedAt) {
            return { success: false, error: 'ใบสมัครนี้ถูกลบไปแล้ว' };
        }

        await db.update(applications)
            .set({
                deletedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            })
            .where(eq(applications.appId, appId));

        // Archive associated user
        const manifest: Manifest = JSON.parse(existingApp.rawData as string);
        const email = manifest.applicant?.email?.trim().toLowerCase();
        if (email) {
            await syncUserArchiveStatus(email, 'archived');
        }

        revalidateTag(`r2-app-${appId}`);
        revalidateTag('r2-index');

        return { success: true };
    } catch (error: any) {
        console.error(`[Soft Delete Error for App ${appId}]`, error);
        return { success: false, error: error.message || 'เกิดข้อผิดพลาดในการลบใบสมัคร' };
    }
}

export async function restoreApplication(appId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const softDeleteSupported = await applicationsSupportSoftDelete();
        if (!softDeleteSupported) {
            return { success: false, error: 'ฐานข้อมูล production ยังไม่พร้อมสำหรับถังขยะ กรุณารัน migration ของ applications ก่อน' };
        }

        const db = await getDb();
        const existingApplication = await getApplicationById(appId);
        const existingApp = existingApplication?.row;

        if (!existingApp) {
            return { success: false, error: 'ไม่พบใบสมัครที่ต้องการกู้คืน' };
        }

        if (!existingApp.deletedAt) {
            return { success: false, error: 'ใบสมัครนี้ยังไม่ถูกลบ' };
        }

        await db.update(applications)
            .set({
                deletedAt: null,
                updatedAt: new Date().toISOString(),
            })
            .where(eq(applications.appId, appId));

        // If the application is restored AND it's already approved, reactivate the user
        const manifest: Manifest = JSON.parse(existingApp.rawData as string);
        const email = manifest.applicant?.email?.trim().toLowerCase();
        const verificationStatus = manifest.status?.verification || existingApp.verificationStatus;
        if (email && verificationStatus === 'approved') {
            await syncUserArchiveStatus(email, 'active');
        }

        revalidateTag(`r2-app-${appId}`);
        revalidateTag('r2-index');

        return { success: true };
    } catch (error: any) {
        console.error(`[Restore Error for App ${appId}]`, error);
        return { success: false, error: error.message || 'เกิดข้อผิดพลาดในการกู้คืนใบสมัคร' };
    }
}

export async function hardDeleteApplication(appId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await auth();
        const currentUserRole = (session?.user as { role?: string } | undefined)?.role;

        if (currentUserRole !== 'god') {
            return { success: false, error: 'เฉพาะผู้ใช้ระดับ god เท่านั้นที่ลบถาวรได้' };
        }

        const softDeleteSupported = await applicationsSupportSoftDelete();
        if (!softDeleteSupported) {
            return { success: false, error: 'ฐานข้อมูล production ยังไม่พร้อมสำหรับ hard delete กรุณารัน migration ของ applications ก่อน' };
        }

        const db = await getDb();
        const existingApplication = await getApplicationById(appId);
        const existingApp = existingApplication?.row;

        if (!existingApp) {
            return { success: false, error: 'ไม่พบใบสมัครที่ต้องการลบถาวร' };
        }

        if (!existingApp.deletedAt) {
            return { success: false, error: 'ต้องย้ายใบสมัครไปที่ถังขยะก่อน จึงจะลบถาวรได้' };
        }

        const manifest: Manifest = JSON.parse(existingApp.rawData as string);
        const applicantEmail = manifest.applicant?.email?.trim().toLowerCase();
        const r2Keys = Array.from(collectManifestR2Keys(manifest.docs));

        if (r2Keys.length > 0) {
            try {
                const r2 = await getR2Binding();
                await r2?.delete(r2Keys);
            } catch (error) {
                console.warn(`[Hard Delete] Failed to delete R2 objects for ${appId}`, error);
            }
        }

        if (applicantEmail) {
            const user = await fetchUserByEmail(applicantEmail);
            if (user?.role === 'employee') {
                await deleteUserById(user.id);
            }
        }

        await db.delete(applications).where(eq(applications.appId, appId));

        revalidateTag(`r2-app-${appId}`);
        revalidateTag('r2-index');

        return { success: true };
    } catch (error: any) {
        console.error(`[Hard Delete Error for App ${appId}]`, error);
        return { success: false, error: error.message || 'เกิดข้อผิดพลาดในการลบถาวร' };
    }
}
