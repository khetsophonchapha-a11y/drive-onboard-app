// src/app/api/applications/submit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Manifest } from '@/lib/types';
import { revalidateTag } from 'next/cache';
import { getDb } from '@/lib/db';
import { applications } from '@/db/schema';
import { findApplicationByEmail, normalizeEmail } from '@/lib/applications';

// We don't use the ManifestSchema directly because it has derived/read-only fields
const SubmitBodySchema = z.object({
  appId: z.string(),
  manifest: z.any(), // In a real app, you would validate the manifest with a more specific Zod schema
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { appId, manifest } = SubmitBodySchema.parse(body) as { appId: string; manifest: Manifest };

    console.log(`[Submit API] Received submission for appId: ${appId}`);

    // Ensure fullName is correctly assembled before saving
    manifest.applicant.fullName = `${manifest.applicant.firstName} ${manifest.applicant.lastName}`.trim();
    if (manifest.guarantor) {
      manifest.guarantor.fullName = `${manifest.guarantor.firstName || ''} ${manifest.guarantor.lastName || ''}`.trim() || undefined;
    }

    const normalizedStatus = manifest.status ?? { completeness: 'incomplete', verification: 'pending' };
    normalizedStatus.completeness = normalizedStatus.completeness ?? 'incomplete';
    normalizedStatus.verification = normalizedStatus.verification ?? 'pending';
    manifest.status = normalizedStatus;

    // Get DB Connection
    const db = await getDb();
    if (!db) {
      console.error('[Submit API] Database connection failed: getDb() returned undefined.');
      return NextResponse.json({ error: 'Database connection unavailable.' }, { status: 503 });
    }

    const normalizedEmail = normalizeEmail(manifest.applicant.email);
    const duplicateApplication = await findApplicationByEmail(normalizedEmail, { excludeAppId: appId });
    if (duplicateApplication) {
      return NextResponse.json(
        {
          error: `อีเมล ${normalizedEmail} ถูกใช้สมัครไปแล้วในใบสมัคร ${duplicateApplication.row.appId}`,
        },
        { status: 409 }
      );
    }

    const safeCreatedAt = manifest.createdAt ?? new Date().toISOString();
    const updatedAt = new Date().toISOString();
    const phone = manifest.applicant.mobilePhone || manifest.applicant.homePhone || '';
    const persistedApplication = {
      appId,
      fullName: manifest.applicant.fullName,
      nationalId: manifest.applicant.nationalId,
      verificationStatus: manifest.status.verification,
      completenessStatus: manifest.status.completeness,
      createdAt: safeCreatedAt,
      updatedAt,
      phone,
      rawData: JSON.stringify(manifest),
    };

    console.log(`[Submit API] Upserting application ${appId}...`);
    await db
      .insert(applications)
      .values(persistedApplication)
      .onConflictDoUpdate({
        target: applications.appId,
        set: {
          fullName: persistedApplication.fullName,
          nationalId: persistedApplication.nationalId,
          verificationStatus: persistedApplication.verificationStatus,
          completenessStatus: persistedApplication.completenessStatus,
          updatedAt: persistedApplication.updatedAt,
          phone: persistedApplication.phone,
          rawData: persistedApplication.rawData,
        },
      });

    // --- Step 3: Revalidate caches ---
    console.log('[Submit API] Revalidating cache tags...');
    revalidateTag('r2-index');
    revalidateTag(`r2-app-${appId}`);

    console.log('[Submit API] Submission successful.');
    return NextResponse.json({ ok: true, appId });

  } catch (error) {
    console.error('[Submit API] Critical Error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request body', details: error.issues }, { status: 400 });
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to submit application.', details: errorMessage }, { status: 500 });
  }
}
